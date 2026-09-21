import { existsSync } from "node:fs";
import path from "node:path";

import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";

import { createMigrationClient } from "../client";
import type { DatabaseEnv } from "../client";

export function resolveMigrationsFolder(start = process.cwd()): string {
  const candidates = [
    path.resolve(start, "packages/database/drizzle"),
    path.resolve(start, "drizzle"),
  ];
  for (const candidate of candidates) {
    if (existsSync(path.join(candidate, "meta/_journal.json"))) {
      return candidate;
    }
  }
  throw new Error(
    "Committed Drizzle journal not found at packages/database/drizzle"
  );
}

/**
 * Applies the committed Drizzle journal through a direct (unpooled)
 * connection. Callers must pass the migration URL, never the pooled
 * runtime URL.
 */
export async function applyDatabaseMigrations(
  env: Pick<DatabaseEnv, "migrationUrl">,
  migrationsFolder = resolveMigrationsFolder()
): Promise<void> {
  const client = createMigrationClient({
    migrationUrl: env.migrationUrl,
    poolConnectionTimeoutMs: 5000,
    poolIdleTimeoutMs: 10_000,
    poolMax: 1,
    runtimeUrl: "postgres://relanmo-runtime.invalid/unused",
  });
  await client.connect();
  try {
    const db = drizzle({ client });
    await migrate(db, { migrationsFolder });
  } finally {
    await client.end();
  }
}
