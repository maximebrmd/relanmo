import { drizzle } from "drizzle-orm/node-postgres";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { Client, Pool } from "pg";

import type { DatabaseEnv } from "./env";

export type RuntimeDatabase = NodePgDatabase<Record<string, never>>;

/** Bounded pool for ordinary runtime transactions, sized from validated env. */
export function createRuntimePool(env: DatabaseEnv): Pool {
  return new Pool({
    connectionString: env.runtimeUrl,
    connectionTimeoutMillis: env.poolConnectionTimeoutMs,
    idleTimeoutMillis: env.poolIdleTimeoutMs,
    max: env.poolMax,
  });
}

/**
 * A single unpooled client on the direct migration URL. This module only
 * manages the connection; running migration SQL is a later task's job.
 */
export function createMigrationClient(env: DatabaseEnv): Client {
  return new Client({ connectionString: env.migrationUrl });
}

export function createRuntimeDrizzle(pool: Pool): RuntimeDatabase {
  return drizzle({ client: pool });
}

export type DatabaseRuntimeClient = Readonly<{
  close: () => Promise<void>;
  db: RuntimeDatabase;
  env: DatabaseEnv;
  pool: Pool;
}>;

export function createDatabaseRuntimeClient(
  env: DatabaseEnv
): DatabaseRuntimeClient {
  const pool = createRuntimePool(env);
  const db = createRuntimeDrizzle(pool);
  return Object.freeze({
    close: () => pool.end(),
    db,
    env,
    pool,
  });
}
