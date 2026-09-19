import { randomUUID } from "node:crypto";

import type {
  PersistenceConnectionId,
  PersistenceIsolationLevel,
  PersistenceResult,
  PersistenceTransaction,
  PersistenceTransactionRunner,
  PersistenceTransactionWork,
  TenantTransactionScope,
} from "@relanmo/domain/ports/persistence";
import { TransactionRollbackError } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";

import { setTenantContext } from "./context";
import { mapUnexpectedError } from "./errors";
import { mapIsolationLevel } from "./isolation";
import { registerExecutor, unregisterExecutor } from "./registry";

function brandConnectionId(value: string): PersistenceConnectionId {
  // SAFETY: generated locally as an opaque per-transaction identifier.
  return value as PersistenceConnectionId;
}

function toPersistenceTransaction(
  connectionId: PersistenceConnectionId,
  isolationLevel: PersistenceIsolationLevel,
  scope: TenantTransactionScope
): PersistenceTransaction {
  // SAFETY: PersistenceTransaction's brand key is private to its defining
  // module; every implementation constructs the public fields and asserts
  // the opaque shape, mirroring the domain package's own test fixtures.
  return { connectionId, isolationLevel, scope } as PersistenceTransaction;
}

type RunInput<Value> = Readonly<{
  isolationLevel?: PersistenceIsolationLevel;
  scope: TenantTransactionScope;
  work: PersistenceTransactionWork<Value>;
}>;

async function runTransaction<Value>(
  db: NodePgDatabase,
  input: RunInput<Value>
): Promise<PersistenceResult<Value>> {
  const isolationLevel = input.isolationLevel ?? "READ_COMMITTED";
  const connectionId = brandConnectionId(randomUUID());
  const persistenceTx = toPersistenceTransaction(
    connectionId,
    isolationLevel,
    input.scope
  );

  let settled: PersistenceResult<Value> | undefined;

  try {
    await db.transaction(
      async (tx) => {
        registerExecutor(connectionId, tx);
        await setTenantContext(tx, input.scope);
        const result = await input.work(persistenceTx);
        settled = result;
        if (!result.ok) {
          // Throws TransactionRollbackError; drizzle rolls back and
          // releases the connection in its own `finally` before rethrowing.
          tx.rollback();
        }
      },
      { isolationLevel: mapIsolationLevel(isolationLevel) }
    );
  } catch (error) {
    if (!(error instanceof TransactionRollbackError)) {
      return { error: mapUnexpectedError(error), ok: false };
    }
  } finally {
    unregisterExecutor(connectionId);
  }

  return (
    settled ?? {
      error: {
        code: "UNAVAILABLE",
        detail: "transaction settled without a recorded result",
        retryable: false,
      },
      ok: false,
    }
  );
}

/**
 * The concrete PersistenceTransactionRunner: one checked-out pg connection
 * per `run` call, tenant context set transaction-locally right after BEGIN,
 * and rollback on either a thrown error or an `ok: false` work result.
 */
export function createPersistenceTransactionRunner(
  db: NodePgDatabase
): PersistenceTransactionRunner {
  return {
    run: (input) => runTransaction(db, input),
  };
}
