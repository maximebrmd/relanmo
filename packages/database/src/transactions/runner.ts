import { randomUUID } from "node:crypto";

import type {
  PersistenceConnectionId,
  PersistenceIsolationLevel,
  PersistenceResult,
  PersistenceTransaction,
  PersistenceTransactionWork,
  TenantTransactionScope,
} from "@relanmo/domain/ports/persistence";
import { sql, TransactionRollbackError } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";

import { requireTrustedTenantAccess } from "../security/context";
import type { TenantSqlAccess } from "../security/context";
import { UntrustedSqlAccessError } from "../security/errors";
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
  access: TenantSqlAccess;
  isolationLevel?: PersistenceIsolationLevel;
  work: PersistenceTransactionWork<Value>;
}>;

export interface TrustedPersistenceTransactionRunner {
  run: <Value>(input: RunInput<Value>) => Promise<PersistenceResult<Value>>;
}

async function runTransaction<Value>(
  db: NodePgDatabase,
  input: RunInput<Value>
): Promise<PersistenceResult<Value>> {
  const scope = requireTrustedTenantAccess(input.access);
  const isolationLevel = input.isolationLevel ?? "READ_COMMITTED";
  const connectionId = brandConnectionId(randomUUID());
  const persistenceTx = toPersistenceTransaction(
    connectionId,
    isolationLevel,
    scope
  );

  let settled: PersistenceResult<Value> | undefined;

  try {
    await db.transaction(
      async (tx) => {
        registerExecutor(connectionId, tx);
        await setTenantContext(tx, scope);
        if (scope.principal.kind === "MEMBER") {
          const membership = await tx.execute(
            sql`select 1
                  from memberships
                 where tenant_id = ${scope.tenantId}
                   and user_id = ${scope.principal.userId}
                   and status = 'ACTIVE'
                   for update`
          );
          if (membership.rows.length !== 1) {
            throw new UntrustedSqlAccessError(
              "active membership is required for tenant SQL access"
            );
          }
        }
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
 * The trusted database transaction runner: one checked-out pg connection per
 * `run` call, tenant context set transaction-locally right after BEGIN, active
 * member access revalidated under lock, and rollback on either a thrown error
 * or an `ok: false` work result.
 */
export function createPersistenceTransactionRunner(
  db: NodePgDatabase
): TrustedPersistenceTransactionRunner {
  return {
    run: (input) => runTransaction(db, input),
  };
}
