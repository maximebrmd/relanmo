import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { stopLocalPostgresAdmin } from "../../tests/support/local-postgres";
import type { IsolatedTestDatabase } from "../../tests/support/test-database";
import { createIsolatedTestDatabase } from "../../tests/support/test-database";
import { createMigrationClient } from "../client";
import type { DatabaseEnv } from "../client";
import { applyDatabaseMigrations } from "./apply-migrations";

const SETUP_TIMEOUT_MS = 45_000;
const APPLY_TIMEOUT_MS = 60_000;

const EXPECTED_TABLES = [
  "user",
  "session",
  "login_account",
  "verification",
  "rate_limit",
  "tenants",
  "memberships",
  "freelancer_profiles",
  "campaigns",
  "campaign_versions",
  "style_profiles",
  "style_profile_versions",
  "prompt_overrides",
  "prompt_override_versions",
  "provider_accounts",
  "prospects",
  "evidence",
  "conversations",
  "messages",
  "suppression_entries",
  "actions",
  "send_attempts",
  "send_receipts",
  "account_leases",
  "quota_reservations",
  "webhook_events",
  "outbox_events",
  "action_events",
  "billing_customers",
  "subscriptions",
  "billing_entitlements",
  "billing_events",
  "usage_events",
  "audit_events",
] as const;

let database: IsolatedTestDatabase | null = null;

beforeAll(async () => {
  database = await createIsolatedTestDatabase("p020-migrate");
}, SETUP_TIMEOUT_MS);

afterAll(async () => {
  await database?.drop();
  await stopLocalPostgresAdmin();
});

function migrationEnv(target: IsolatedTestDatabase): DatabaseEnv {
  return {
    migrationUrl: target.migrationUrl,
    poolConnectionTimeoutMs: 5000,
    poolIdleTimeoutMs: 10_000,
    poolMax: 1,
    runtimeUrl: target.runtimeUrl,
  };
}

async function publicTables(env: DatabaseEnv): Promise<string[]> {
  const client = createMigrationClient(env);
  await client.connect();
  try {
    const result = await client.query<{ table_name: string }>(
      `select table_name
         from information_schema.tables
        where table_schema = 'public'
          and table_type = 'BASE TABLE'
        order by table_name`
    );
    return result.rows.map((row) => row.table_name);
  } finally {
    await client.end();
  }
}

async function foreignKey(
  env: DatabaseEnv,
  tableName: string,
  columnName: string
): Promise<{ foreignTable: string; foreignColumn: string } | undefined> {
  const client = createMigrationClient(env);
  await client.connect();
  try {
    const result = await client.query<{
      foreign_column: string;
      foreign_table: string;
    }>(
      `select ccu.table_name as foreign_table,
              ccu.column_name as foreign_column
         from information_schema.table_constraints as tc
         join information_schema.key_column_usage as kcu
           on tc.constraint_name = kcu.constraint_name
          and tc.table_schema = kcu.table_schema
         join information_schema.constraint_column_usage as ccu
           on ccu.constraint_name = tc.constraint_name
          and ccu.table_schema = tc.table_schema
        where tc.constraint_type = 'FOREIGN KEY'
          and tc.table_schema = 'public'
          and tc.table_name = $1
          and kcu.column_name = $2`,
      [tableName, columnName]
    );
    const [row] = result.rows;
    if (!row) {
      return undefined;
    }
    return {
      foreignColumn: row.foreign_column,
      foreignTable: row.foreign_table,
    };
  } finally {
    await client.end();
  }
}

async function appliedMigrationCount(env: DatabaseEnv): Promise<number> {
  const client = createMigrationClient(env);
  await client.connect();
  try {
    const result = await client.query<{ count: string }>(
      `select count(*)::text as count from drizzle.__drizzle_migrations`
    );
    return Number(result.rows[0]?.count ?? 0);
  } finally {
    await client.end();
  }
}

describe("initial Drizzle migration lineage (live local Postgres)", () => {
  it(
    "creates the agreed schema on a fresh database and is idempotent on re-run",
    async (ctx) => {
      if (!database) {
        ctx.skip();
        return;
      }
      const env = migrationEnv(database);

      await applyDatabaseMigrations(env);
      const tablesAfterFirst = await publicTables(env);
      expect(tablesAfterFirst).toEqual(
        expect.arrayContaining([...EXPECTED_TABLES])
      );
      expect(await foreignKey(env, "campaigns", "tenant_id")).toEqual({
        foreignColumn: "id",
        foreignTable: "tenants",
      });
      expect(await foreignKey(env, "actions", "account_id")).toEqual({
        foreignColumn: "id",
        foreignTable: "provider_accounts",
      });
      expect(await foreignKey(env, "conversations", "owner_user_id")).toEqual({
        foreignColumn: "id",
        foreignTable: "user",
      });
      expect(await foreignKey(env, "memberships", "user_id")).toEqual({
        foreignColumn: "id",
        foreignTable: "user",
      });
      const appliedAfterFirst = await appliedMigrationCount(env);
      expect(appliedAfterFirst).toBeGreaterThan(0);

      await applyDatabaseMigrations(env);
      expect(await publicTables(env)).toEqual(tablesAfterFirst);
      expect(await appliedMigrationCount(env)).toBe(appliedAfterFirst);
    },
    APPLY_TIMEOUT_MS
  );
});
