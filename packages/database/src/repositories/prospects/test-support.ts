import {
  parseAccountId,
  parseTenantId,
  parseUserId,
} from "@relanmo/domain/contracts";
import type { TenantId, UserId } from "@relanmo/domain/contracts";
import type {
  PersistenceWorkerId,
  TenantTransactionScope,
} from "@relanmo/domain/ports/persistence";

import {
  dropRuntimeRoleLogins,
  ISOLATION_ROLE_PASSWORDS,
  provisionRuntimeRoleLogins,
  runtimeRoleUrl,
  withClient,
} from "../../../tests/isolation/support";
import { stopLocalPostgresAdmin } from "../../../tests/support/local-postgres";
import type { IsolatedTestDatabase } from "../../../tests/support/test-database";
import { createIsolatedTestDatabase } from "../../../tests/support/test-database";
import type { DatabaseEnv, DatabaseRuntimeClient } from "../../client";
import { createDatabaseRuntimeClient } from "../../client";
import { applyDatabaseMigrations } from "../../schema/apply-migrations";
import {
  AUTH_DATABASE_ROLE,
  mintTrustedWorkerAccess,
  RUNTIME_DATABASE_ROLES,
} from "../../security";
import { createPersistenceTransactionRunner } from "../../transactions";
import type { TrustedPersistenceTransactionRunner } from "../../transactions";

export const TENANT_A = parseTenantId("prospect-tenant-a");
export const TENANT_B = parseTenantId("prospect-tenant-b");
export const USER_A = parseUserId("prospect-user-a");
export const USER_B = parseUserId("prospect-user-b");
export const ACCOUNT_A = parseAccountId("prospect-account-a");
export const ACCOUNT_B = parseAccountId("prospect-account-b");

export const SETUP_TIMEOUT_MS = 60_000;
export const TEST_TIMEOUT_MS = 30_000;

export type ProspectStoreHarness = Readonly<{
  appClient: DatabaseRuntimeClient;
  authEnv: DatabaseEnv;
  close: () => Promise<void>;
  database: IsolatedTestDatabase;
  workerClient: DatabaseRuntimeClient;
  workerRunner: TrustedPersistenceTransactionRunner;
}>;

function workerScope(tenantId: TenantId): TenantTransactionScope {
  return {
    principal: {
      kind: "WORKER",
      // SAFETY: synthetic test worker id, never used outside this fixture.
      workerId: "prospect-store-worker" as PersistenceWorkerId,
    },
    requestId: null,
    tenantId,
  };
}

function memberScope(
  tenantId: TenantId,
  userId: UserId
): TenantTransactionScope {
  return {
    principal: { kind: "MEMBER", userId },
    requestId: null,
    tenantId,
  };
}

export function workerAccess(tenantId: TenantId) {
  return mintTrustedWorkerAccess(workerScope(tenantId));
}

export function memberAccessInput(tenantId: TenantId, userId: UserId) {
  return memberScope(tenantId, userId);
}

async function seedTenants(target: IsolatedTestDatabase): Promise<void> {
  await withClient(target.migrationUrl, async (client) => {
    await client.query(
      `insert into "user" (id, name, email)
       values ($1, 'Prospect tenant A', 'prospect-a@example.test'),
              ($2, 'Prospect tenant B', 'prospect-b@example.test')`,
      [USER_A, USER_B]
    );
    await client.query(
      `insert into tenants (id, display_name, status)
       values ($1, 'Prospect A', 'ACTIVE'),
              ($2, 'Prospect B', 'ACTIVE')`,
      [TENANT_A, TENANT_B]
    );
    await client.query(
      `insert into memberships (id, tenant_id, user_id, role, status)
       values ('prospect-membership-a', $1, $2, 'OWNER', 'ACTIVE'),
              ('prospect-membership-b', $3, $4, 'OWNER', 'ACTIVE')`,
      [TENANT_A, USER_A, TENANT_B, USER_B]
    );
    await client.query(
      `insert into provider_accounts
         (id, tenant_id, provider_account_id, status, health_observed_at)
       values ($1, $2, 'linkedin-a', 'HEALTHY', now()),
              ($3, $4, 'linkedin-b', 'HEALTHY', now())`,
      [ACCOUNT_A, TENANT_A, ACCOUNT_B, TENANT_B]
    );
  });
}

export async function createProspectStoreHarness(
  label: string
): Promise<ProspectStoreHarness | null> {
  const database = await createIsolatedTestDatabase(label);
  if (!database) {
    return null;
  }

  await applyDatabaseMigrations({ migrationUrl: database.migrationUrl });
  await provisionRuntimeRoleLogins(database);
  await seedTenants(database);

  const workerEnv: DatabaseEnv = {
    migrationUrl: database.migrationUrl,
    poolConnectionTimeoutMs: 5000,
    poolIdleTimeoutMs: 10_000,
    poolMax: 4,
    runtimeUrl: runtimeRoleUrl(
      database,
      RUNTIME_DATABASE_ROLES.worker,
      ISOLATION_ROLE_PASSWORDS.worker
    ),
  };
  const appEnv: DatabaseEnv = {
    migrationUrl: database.migrationUrl,
    poolConnectionTimeoutMs: 5000,
    poolIdleTimeoutMs: 10_000,
    poolMax: 4,
    runtimeUrl: runtimeRoleUrl(
      database,
      RUNTIME_DATABASE_ROLES.app,
      ISOLATION_ROLE_PASSWORDS.app
    ),
  };
  const authEnv: DatabaseEnv = {
    migrationUrl: database.migrationUrl,
    poolConnectionTimeoutMs: 5000,
    poolIdleTimeoutMs: 10_000,
    poolMax: 1,
    runtimeUrl: runtimeRoleUrl(
      database,
      AUTH_DATABASE_ROLE,
      ISOLATION_ROLE_PASSWORDS.auth
    ),
  };

  const workerClient = createDatabaseRuntimeClient(workerEnv);
  const appClient = createDatabaseRuntimeClient(appEnv);

  return {
    appClient,
    authEnv,
    database,
    workerClient,
    workerRunner: createPersistenceTransactionRunner(workerClient.db),
    close: async () => {
      await workerClient.close();
      await appClient.close();
      try {
        await dropRuntimeRoleLogins(database);
      } finally {
        await database.drop();
      }
    },
  };
}

export async function shutdownProspectStoreTests(): Promise<void> {
  await stopLocalPostgresAdmin();
}

export { createDatabaseRuntimeClient } from "../../client";
export { mintTrustedTenantAccess } from "../../security";
export { createPersistenceTransactionRunner } from "../../transactions";
