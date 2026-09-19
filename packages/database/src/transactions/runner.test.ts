import { randomUUID } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";

import { parseTenantId } from "@relanmo/domain/contracts";
import type {
  PersistenceTransaction,
  PersistenceWorkerId,
  TenantTransactionScope,
} from "@relanmo/domain/ports/persistence";
import { sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { stopLocalPostgresAdmin } from "../../tests/support/local-postgres";
import type { IsolatedTestDatabase } from "../../tests/support/test-database";
import { createIsolatedTestDatabase } from "../../tests/support/test-database";
import { createDatabaseRuntimeClient } from "../client";
import type { DatabaseEnv, DatabaseRuntimeClient } from "../client";
import type { TransactionExecutor } from "./registry";
import { resolveTransactionExecutor } from "./registry";
import { createPersistenceTransactionRunner } from "./runner";

const SETUP_TIMEOUT_MS = 45_000;

let database: IsolatedTestDatabase | null = null;

beforeAll(async () => {
  database = await createIsolatedTestDatabase("txn-runner");
}, SETUP_TIMEOUT_MS);

afterAll(async () => {
  await database?.drop();
  await stopLocalPostgresAdmin();
});

function scopeFor(tenant: string): TenantTransactionScope {
  return {
    principal: {
      kind: "WORKER",
      // SAFETY: synthetic test worker id, never used outside this fixture.
      workerId: "test-worker" as PersistenceWorkerId,
    },
    requestId: null,
    tenantId: parseTenantId(tenant),
  };
}

/**
 * Builds a DatabaseEnv directly rather than through `parseDatabaseEnv`.
 * The isolated test database's runtime/migration URLs point at the same
 * disposable local Postgres (there is no separate privileged role to
 * model), so they share connection identity by design; `parseDatabaseEnv`'s
 * separation guard is unit-tested on its own in `env.test.ts`, including
 * this exact equivalent-endpoint scenario.
 */
function makeClient(
  target: IsolatedTestDatabase,
  poolMax: number
): DatabaseRuntimeClient {
  const env: DatabaseEnv = {
    migrationUrl: target.migrationUrl,
    poolConnectionTimeoutMs: 5000,
    poolIdleTimeoutMs: 10_000,
    poolMax,
    runtimeUrl: target.runtimeUrl,
  };
  return createDatabaseRuntimeClient(env);
}

async function readTenantSetting(
  db: TransactionExecutor
): Promise<string | null> {
  const result = await db.execute<{ tenant_id: string | null }>(
    sql`select current_setting('app.tenant_id', true) as tenant_id`
  );
  const value = result.rows[0]?.tenant_id;
  return value && value.length > 0 ? value : null;
}

describe("persistence transaction runner (live local Postgres)", () => {
  it("does not leak tenant context to the next transaction on a reused connection", async (ctx) => {
    if (!database) {
      ctx.skip();
      return;
    }
    const client = makeClient(database, 1);
    try {
      const runner = createPersistenceTransactionRunner(client.db);

      const first = await runner.run({
        scope: scopeFor("tenant-a"),
        work: async (tx) => {
          const seenInsideTx = await readTenantSetting(
            resolveTransactionExecutor(tx)
          );
          expect(seenInsideTx).toBe("tenant-a");
          return { ok: true as const, value: null };
        },
      });
      expect(first.ok).toBe(true);

      // Pool max is 1, so this next raw query reuses the exact same
      // physical connection the prior transaction used. set_config's
      // is_local=true means Postgres discarded the value at commit.
      const leaked = await readTenantSetting(client.db);
      expect(leaked).toBeNull();
    } finally {
      await client.close();
    }
  });

  it("never lets concurrent transactions observe each other's tenant context", async (ctx) => {
    if (!database) {
      ctx.skip();
      return;
    }
    const client = makeClient(database, 2);
    try {
      const runner = createPersistenceTransactionRunner(client.db);
      const tenantIds = Array.from(
        { length: 6 },
        (_unused, index) => `tenant-${index}`
      );

      const results = await Promise.all(
        tenantIds.map((tenant) =>
          runner.run({
            scope: scopeFor(tenant),
            work: async (tx) => {
              const db = resolveTransactionExecutor(tx);
              const firstRead = await readTenantSetting(db);
              await delay(Math.random() * 20);
              const secondRead = await readTenantSetting(db);
              if (firstRead !== tenant || secondRead !== tenant) {
                return {
                  error: {
                    code: "CONFLICT" as const,
                    detail: `saw ${firstRead}/${secondRead} while running as ${tenant}`,
                    retryable: false,
                  },
                  ok: false as const,
                };
              }
              return { ok: true as const, value: tenant };
            },
          })
        )
      );

      const failures = results.filter((result) => !result.ok);
      expect(failures).toEqual([]);
    } finally {
      await client.close();
    }
  });

  it("rolls back a failed transaction and releases its connection", async (ctx) => {
    if (!database) {
      ctx.skip();
      return;
    }
    const client = makeClient(database, 1);
    try {
      await client.pool.query(
        "create table if not exists _txn_probe (marker text primary key)"
      );
      const runner = createPersistenceTransactionRunner(client.db);
      const marker = randomUUID();

      const failed = await runner.run({
        scope: scopeFor("tenant-rollback"),
        work: async (tx) => {
          const db = resolveTransactionExecutor(tx);
          await db.execute(
            sql`insert into _txn_probe (marker) values (${marker})`
          );
          return {
            error: {
              code: "VALIDATION" as const,
              detail: "reject on purpose",
              retryable: false,
            },
            ok: false as const,
          };
        },
      });
      expect(failed.ok).toBe(false);
      if (!failed.ok) {
        expect(failed.error.detail).toBe("reject on purpose");
      }

      const rows = await client.pool.query(
        "select 1 from _txn_probe where marker = $1",
        [marker]
      );
      expect(rows.rowCount).toBe(0);

      // Pool max is 1: a second transaction only succeeds promptly if the
      // failed one actually released its connection back to the pool.
      const second = await runner.run({
        scope: scopeFor("tenant-after-rollback"),
        work: () => Promise.resolve({ ok: true as const, value: null }),
      });
      expect(second.ok).toBe(true);
    } finally {
      await client.close();
    }
  });

  it("stops exposing the executor once a transaction has settled", async (ctx) => {
    if (!database) {
      ctx.skip();
      return;
    }
    const client = makeClient(database, 1);
    try {
      const runner = createPersistenceTransactionRunner(client.db);
      let capturedTx: PersistenceTransaction | undefined;

      await runner.run({
        scope: scopeFor("tenant-settled"),
        work: (tx) => {
          capturedTx = tx;
          return Promise.resolve({ ok: true as const, value: null });
        },
      });

      if (!capturedTx) {
        throw new Error("expected work callback to capture a transaction");
      }
      const settledTx = capturedTx;
      expect(() => resolveTransactionExecutor(settledTx)).toThrow(
        /not active/u
      );
    } finally {
      await client.close();
    }
  });
});
