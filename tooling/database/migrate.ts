import path from "node:path";

import { parseDatabaseEnv } from "../../packages/database/src/client";
import { applyDatabaseMigrations } from "../../packages/database/src/schema/apply-migrations";

/**
 * Apply committed Drizzle SQL through the unpooled migration role.
 *
 * Requires `DATABASE_URL` (pooled runtime) and `DATABASE_URL_UNPOOLED`
 * (direct migration connection). Only `DATABASE_URL_UNPOOLED` is used
 * to apply SQL.
 *
 * Generate reviewed SQL from `packages/database`:
 * `bun x --no-install drizzle-kit generate`
 *
 * Then apply from the repository root:
 * `bun tooling/database/migrate.ts`
 */
const [, entry] = process.argv;
if (entry !== undefined && import.meta.filename === path.resolve(entry)) {
  const env = parseDatabaseEnv();
  await applyDatabaseMigrations(env);
}
