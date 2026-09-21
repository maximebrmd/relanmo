import { createHash } from "node:crypto";

import { Client } from "pg";

import {
  AUTH_DATABASE_ROLE,
  RUNTIME_DATABASE_ROLES,
} from "../../src/security";
import type { IsolatedTestDatabase } from "../support/test-database";

export const ISOLATION_ROLE_PASSWORDS = {
  app: "isolation-app",
  auth: "isolation-auth",
  worker: "isolation-worker",
} as const;

function sqlLiteral(value: string): string {
  return `'${value.replaceAll("'", "''")}'`;
}

function sqlIdentifier(value: string): string {
  return `"${value.replaceAll('"', '""')}"`;
}

export const TENANT_A = "isolation-tenant-a";
export const TENANT_B = "isolation-tenant-b";
export const USER_A = "isolation-user-a";
export const USER_B = "isolation-user-b";

function connectionUrl(
  base: string,
  databaseName: string,
  username: string,
  password: string
): string {
  const url = new URL(base);
  url.username = username;
  url.password = password;
  url.pathname = `/${databaseName}`;
  url.searchParams.set("application_name", `relanmo-${username}`);
  return url.toString();
}

export function runtimeRoleUrl(
  target: IsolatedTestDatabase,
  role:
    | (typeof RUNTIME_DATABASE_ROLES)[keyof typeof RUNTIME_DATABASE_ROLES]
    | typeof AUTH_DATABASE_ROLE,
  password: string
): string {
  return connectionUrl(
    target.migrationUrl,
    target.databaseName,
    runtimeLoginName(target, role),
    password
  );
}

export function runtimeLoginName(
  target: IsolatedTestDatabase,
  role:
    | (typeof RUNTIME_DATABASE_ROLES)[keyof typeof RUNTIME_DATABASE_ROLES]
    | typeof AUTH_DATABASE_ROLE
): string {
  const databaseHash = createHash("sha256")
    .update(target.databaseName)
    .digest("hex")
    .slice(0, 12);
  return `${role}_test_${databaseHash}`;
}

export async function withClient<Value>(
  connectionString: string,
  work: (client: Client) => Promise<Value>
): Promise<Value> {
  const client = new Client({ connectionString });
  await client.connect();
  try {
    return await work(client);
  } finally {
    await client.end();
  }
}

export async function provisionRuntimeRoleLogins(
  target: IsolatedTestDatabase
): Promise<void> {
  await withClient(target.migrationUrl, async (client) => {
    const principals = [
      [RUNTIME_DATABASE_ROLES.app, ISOLATION_ROLE_PASSWORDS.app],
      [AUTH_DATABASE_ROLE, ISOLATION_ROLE_PASSWORDS.auth],
      [RUNTIME_DATABASE_ROLES.worker, ISOLATION_ROLE_PASSWORDS.worker],
    ] as const;
    const statements = principals.flatMap(([role, password]) => {
      const login = sqlIdentifier(runtimeLoginName(target, role));
      return [
        `create role ${login} login nosuperuser nocreatedb nocreaterole inherit nobypassrls password ${sqlLiteral(password)}`,
        `grant ${sqlIdentifier(role)} to ${login}`,
      ];
    });
    await client.query(statements.join(";\n"));
  });
}

export async function dropRuntimeRoleLogins(
  target: IsolatedTestDatabase
): Promise<void> {
  await withClient(target.migrationUrl, async (client) => {
    const roles = [
      RUNTIME_DATABASE_ROLES.app,
      AUTH_DATABASE_ROLE,
      RUNTIME_DATABASE_ROLES.worker,
    ] as const;
    await client.query(
      roles
        .map(
          (role) =>
            `drop role if exists ${sqlIdentifier(runtimeLoginName(target, role))}`
        )
        .join(";\n")
    );
  });
}

export async function seedIsolationFixtures(
  target: IsolatedTestDatabase
): Promise<void> {
  await withClient(target.migrationUrl, async (client) => {
    await client.query(
      `insert into "user" (id, name, email)
       values ($1, 'Tenant A owner', 'a@example.test'),
              ($2, 'Tenant B owner', 'b@example.test')`,
      [USER_A, USER_B]
    );
    await client.query(
      `insert into tenants (id, display_name, status)
       values ($1, 'Tenant A', 'ACTIVE'),
              ($2, 'Tenant B', 'ACTIVE')`,
      [TENANT_A, TENANT_B]
    );
    await client.query(
      `insert into memberships (id, tenant_id, user_id, role, status)
       values ('membership-a', $1, $2, 'OWNER', 'ACTIVE'),
              ('membership-b', $3, $4, 'OWNER', 'ACTIVE')`,
      [TENANT_A, USER_A, TENANT_B, USER_B]
    );
    await client.query(
      `insert into campaigns (id, tenant_id)
       values ('campaign-a', $1),
              ('campaign-b', $2)`,
      [TENANT_A, TENANT_B]
    );
    await client.query(
      `insert into provider_accounts
         (id, tenant_id, provider_account_id, status, health_observed_at)
       values ('provider-account-a', $1, 'provider-a', 'HEALTHY', now()),
              ('provider-account-b', $2, 'provider-b', 'HEALTHY', now())`,
      [TENANT_A, TENANT_B]
    );
    await client.query(
      `insert into login_account (id, account_id, provider_id, user_id, password, updated_at)
       values ('login-a', 'account-a', 'credential', $1, 'hashed-secret-a', now()),
              ('login-b', 'account-b', 'credential', $2, 'hashed-secret-b', now())`,
      [USER_A, USER_B]
    );
    await client.query(
      `insert into session (id, expires_at, token, user_id, updated_at)
       values ('session-a', now() + interval '1 day', 'session-token-a', $1, now()),
              ('session-b', now() + interval '1 day', 'session-token-b', $2, now())`,
      [USER_A, USER_B]
    );
  });
}
