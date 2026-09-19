import { createHash, randomUUID } from "node:crypto";

import { Client } from "pg";

import { getLocalPostgresAdmin } from "./local-postgres";

export type IsolatedTestDatabase = Readonly<{
  databaseName: string;
  drop: () => Promise<void>;
  migrationUrl: string;
  runtimeUrl: string;
}>;

const POSTGRES_IDENTIFIER_MAX_LENGTH = 63;

function worktreeTag(): string {
  return createHash("sha1").update(process.cwd()).digest("hex").slice(0, 8);
}

function sanitizeIdentifier(name: string): string {
  return name.toLowerCase().replaceAll(/[^a-z0-9_]/gu, "_");
}

/**
 * Unique per worktree, process and call, so parallel runs never collide.
 * The random suffix is what actually guarantees uniqueness, so its width
 * (and the fixed prefix's) is reserved first; only the label is truncated
 * to fit the remaining budget. Truncating the assembled string instead
 * would silently eat into the suffix for long labels and let two calls
 * collide.
 */
export function generateTestDatabaseName(label: string): string {
  const suffix = randomUUID().replaceAll("-", "").slice(0, 12);
  const prefix = `relanmo_test_${worktreeTag()}_${process.pid}_`;
  const suffixSegment = `_${suffix}`;
  const labelBudget = Math.max(
    POSTGRES_IDENTIFIER_MAX_LENGTH - prefix.length - suffixSegment.length,
    0
  );
  const safeLabel = sanitizeIdentifier(label).slice(0, labelBudget);
  return `${prefix}${safeLabel}${suffixSegment}`;
}

function withDatabase(
  adminUrl: string,
  databaseName: string,
  applicationName: string
): string {
  const url = new URL(adminUrl);
  url.pathname = `/${databaseName}`;
  url.searchParams.set("application_name", applicationName);
  return url.toString();
}

/**
 * Creates a uniquely named database on the local/isolated admin Postgres
 * and returns distinct pooled/migration-style URLs into it. Resolves to
 * null when no local Postgres is available (see local-postgres.ts); callers
 * must skip in that case rather than fabricate a passing result.
 */
export async function createIsolatedTestDatabase(
  label: string
): Promise<IsolatedTestDatabase | null> {
  const admin = await getLocalPostgresAdmin();
  if (!admin) {
    return null;
  }

  const databaseName = generateTestDatabaseName(label);
  const adminClient = new Client({ connectionString: admin.adminUrl });
  await adminClient.connect();
  try {
    // Postgres has no parameterized identifier for CREATE DATABASE; the
    // name is generated internally and sanitized to [a-z0-9_] above.
    await adminClient.query(`create database "${databaseName}"`);
  } finally {
    await adminClient.end();
  }

  return {
    databaseName,
    drop: async () => {
      const dropClient = new Client({ connectionString: admin.adminUrl });
      await dropClient.connect();
      try {
        await dropClient.query(
          "select pg_terminate_backend(pid) from pg_stat_activity where datname = $1 and pid <> pg_backend_pid()",
          [databaseName]
        );
        await dropClient.query(`drop database if exists "${databaseName}"`);
      } finally {
        await dropClient.end();
      }
    },
    migrationUrl: withDatabase(
      admin.adminUrl,
      databaseName,
      "relanmo-migration"
    ),
    runtimeUrl: withDatabase(admin.adminUrl, databaseName, "relanmo-app"),
  };
}
