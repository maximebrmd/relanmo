import {
  createDatabaseRuntimeClient,
  type DatabaseEnv,
} from "@relanmo/database/client";
import {
  applyTrustedSqlContext,
  AUTH_DATABASE_ROLE,
  AUTH_SECRET_TABLES,
  mintAuthPreSessionAccess,
  mintTrustedTenantAccess,
  mintTrustedWorkerAccess,
  RUNTIME_DATABASE_ROLES,
} from "@relanmo/database/security";
import { createPersistenceTransactionRunner } from "@relanmo/database/transactions";
import { parseTenantId, parseUserId } from "@relanmo/domain/contracts";
import type {
  PersistenceWorkerId,
  TenantTransactionScope,
} from "@relanmo/domain/ports/persistence";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { applyDatabaseMigrations } from "../../src/schema/apply-migrations";
import { TENANT_CONTEXT_GUC } from "../../src/transactions";
import { stopLocalPostgresAdmin } from "../support/local-postgres";
import type { IsolatedTestDatabase } from "../support/test-database";
import { createIsolatedTestDatabase } from "../support/test-database";
import {
  ISOLATION_ROLE_PASSWORDS,
  dropRuntimeRoleLogins,
  provisionRuntimeRoleLogins,
  runtimeLoginName,
  runtimeRoleUrl,
  seedIsolationFixtures,
  TENANT_A,
  TENANT_B,
  USER_A,
  withClient,
} from "./support";

const SETUP_TIMEOUT_MS = 60_000;
const TEST_TIMEOUT_MS = 30_000;

let database: IsolatedTestDatabase | null = null;

beforeAll(async () => {
  database = await createIsolatedTestDatabase("p021-rls");
  if (!database) {
    return;
  }
  await applyDatabaseMigrations({ migrationUrl: database.migrationUrl });
  await provisionRuntimeRoleLogins(database);
  await seedIsolationFixtures(database);
}, SETUP_TIMEOUT_MS);

afterAll(async () => {
  try {
    if (database) {
      await dropRuntimeRoleLogins(database);
    }
  } finally {
    await database?.drop();
    await stopLocalPostgresAdmin();
  }
});

function memberScope(tenant: string, userId = USER_A): TenantTransactionScope {
  return {
    principal: { kind: "MEMBER", userId: parseUserId(userId) },
    requestId: null,
    tenantId: parseTenantId(tenant),
  };
}

function workerScope(tenant: string): TenantTransactionScope {
  return {
    principal: {
      kind: "WORKER",
      // SAFETY: synthetic test worker id, never used outside this fixture.
      workerId: "isolation-worker" as PersistenceWorkerId,
    },
    requestId: null,
    tenantId: parseTenantId(tenant),
  };
}

async function establishMemberAccess(
  target: IsolatedTestDatabase,
  tenant: string,
  userId = USER_A
) {
  return withClient(
    runtimeRoleUrl(target, AUTH_DATABASE_ROLE, ISOLATION_ROLE_PASSWORDS.auth),
    async (auth) => {
      await auth.query("begin");
      try {
        return await mintTrustedTenantAccess(auth, memberScope(tenant, userId));
      } finally {
        await auth.query("rollback");
      }
    }
  );
}

describe("tenant isolation with runtime database roles (live local Postgres)", () => {
  it(
    "connects runtime roles as non-owners without BYPASSRLS",
    async (ctx) => {
      if (!database) {
        ctx.skip();
        return;
      }

      await withClient(database.migrationUrl, async (owner) => {
        const roles = await owner.query<{
          rolbypassrls: boolean;
          rolcanlogin: boolean;
          rolname: string;
          rolsuper: boolean;
        }>(
          `select rolname, rolbypassrls, rolcanlogin, rolsuper
             from pg_roles
            where rolname = any($1::text[])
            order by rolname`,
          [
            [
              RUNTIME_DATABASE_ROLES.app,
              AUTH_DATABASE_ROLE,
              RUNTIME_DATABASE_ROLES.worker,
            ],
          ]
        );
        expect(roles.rows).toEqual([
          {
            rolbypassrls: false,
            rolcanlogin: false,
            rolname: RUNTIME_DATABASE_ROLES.app,
            rolsuper: false,
          },
          {
            rolbypassrls: false,
            rolcanlogin: false,
            rolname: AUTH_DATABASE_ROLE,
            rolsuper: false,
          },
          {
            rolbypassrls: false,
            rolcanlogin: false,
            rolname: RUNTIME_DATABASE_ROLES.worker,
            rolsuper: false,
          },
        ]);

        const owners = await owner.query<{ owner: string; relname: string }>(
          `select c.relname, pg_catalog.pg_get_userbyid(c.relowner) as owner
             from pg_class as c
             join pg_namespace as n on n.oid = c.relnamespace
            where n.nspname = 'public'
              and c.relkind = 'r'
              and c.relname in ('campaigns', 'session', 'login_account')`
        );
        for (const row of owners.rows) {
          expect(row.owner).not.toBe(RUNTIME_DATABASE_ROLES.app);
          expect(row.owner).not.toBe(AUTH_DATABASE_ROLE);
          expect(row.owner).not.toBe(RUNTIME_DATABASE_ROLES.worker);
        }

        await owner.query(
          "create table _unreviewed_tenant_rows (id text primary key, tenant_id text not null)"
        );
      });

      await withClient(
        runtimeRoleUrl(
          database,
          RUNTIME_DATABASE_ROLES.app,
          ISOLATION_ROLE_PASSWORDS.app
        ),
        async (app) => {
          const identity = await app.query<{
            current_user: string;
            rolbypassrls: boolean;
          }>(
            `select current_user,
                    (select rolbypassrls from pg_roles where rolname = current_user) as rolbypassrls`
          );
          expect(identity.rows[0]).toEqual({
            current_user: runtimeLoginName(
              database,
              RUNTIME_DATABASE_ROLES.app
            ),
            rolbypassrls: false,
          });
          await expect(
            app.query("alter table campaigns disable row level security")
          ).rejects.toMatchObject({ code: "42501" });
          await expect(
            app.query("select * from _unreviewed_tenant_rows")
          ).rejects.toMatchObject({ code: "42501" });
        }
      );
    },
    TEST_TIMEOUT_MS
  );

  it(
    "blocks cross-tenant reads and writes on a non-owner app connection",
    async (ctx) => {
      if (!database) {
        ctx.skip();
        return;
      }

      await withClient(
        runtimeRoleUrl(
          database,
          RUNTIME_DATABASE_ROLES.app,
          ISOLATION_ROLE_PASSWORDS.app
        ),
        async (app) => {
          const access = await establishMemberAccess(database, TENANT_A);
          await expect(
            app.query("update campaign_versions set name = name where false")
          ).rejects.toMatchObject({ code: "42501" });
          await expect(
            app.query("update send_attempts set payload = payload where false")
          ).rejects.toMatchObject({ code: "42501" });
          await expect(
            app.query("update actions set payload = payload where false")
          ).rejects.toMatchObject({ code: "42501" });
          await expect(
            app.query("delete from audit_events where false")
          ).rejects.toMatchObject({ code: "42501" });
          await app.query("begin");
          try {
            await applyTrustedSqlContext(app, access);
            const visible = await app.query<{ id: string }>(
              "select id from campaigns order by id"
            );
            expect(visible.rows.map((row) => row.id)).toEqual(["campaign-a"]);

            const other = await app.query(
              "update campaigns set revision = revision + 1 where id = $1",
              ["campaign-b"]
            );
            expect(other.rowCount).toBe(0);

            await expect(
              app.query(
                "insert into campaigns (id, tenant_id) values ($1, $2)",
                ["campaign-forged", TENANT_B]
              )
            ).rejects.toMatchObject({ code: "42501" });
          } finally {
            await app.query("rollback");
          }
        }
      );

      await expect(
        establishMemberAccess(database, TENANT_B, USER_A)
      ).rejects.toThrow("active membership is required");

      const staleAccess = await establishMemberAccess(database, TENANT_A);
      await withClient(database.migrationUrl, (owner) =>
        owner.query(
          "update memberships set status = 'REVOKED' where tenant_id = $1 and user_id = $2",
          [TENANT_A, USER_A]
        )
      );
      const runtimeEnv: DatabaseEnv = {
        migrationUrl: database.migrationUrl,
        poolConnectionTimeoutMs: 5000,
        poolIdleTimeoutMs: 10_000,
        poolMax: 1,
        runtimeUrl: runtimeRoleUrl(
          database,
          RUNTIME_DATABASE_ROLES.app,
          ISOLATION_ROLE_PASSWORDS.app
        ),
      };
      const runtimeClient = createDatabaseRuntimeClient(runtimeEnv);
      try {
        let workCalled = false;
        const result = await createPersistenceTransactionRunner(
          runtimeClient.db
        ).run({
          access: staleAccess,
          work: () => {
            workCalled = true;
            return Promise.resolve({ ok: true as const, value: null });
          },
        });
        expect(result).toMatchObject({
          error: { code: "FORBIDDEN", retryable: false },
          ok: false,
        });
        expect(workCalled).toBe(false);
      } finally {
        await runtimeClient.close();
        await withClient(database.migrationUrl, (owner) =>
          owner.query(
            "update memberships set status = 'ACTIVE' where tenant_id = $1 and user_id = $2",
            [TENANT_A, USER_A]
          )
        );
      }
    },
    TEST_TIMEOUT_MS
  );

  it(
    "hides tenant rows when no tenant context is set, while auth pre-session still works",
    async (ctx) => {
      if (!database) {
        ctx.skip();
        return;
      }

      await withClient(
        runtimeRoleUrl(
          database,
          RUNTIME_DATABASE_ROLES.app,
          ISOLATION_ROLE_PASSWORDS.app
        ),
        async (app) => {
          await app.query("begin");
          try {
            const leaked = await app.query<{ id: string }>(
              "select id from campaigns"
            );
            expect(leaked.rows).toEqual([]);
            await app.query("savepoint no_context_write");
            await expect(
              app.query(
                "insert into campaigns (id, tenant_id) values ($1, $2)",
                ["campaign-no-context", TENANT_A]
              )
            ).rejects.toMatchObject({ code: "42501" });
            await app.query("rollback to savepoint no_context_write");

            await expect(
              app.query("select token from session where id = $1", [
                "session-a",
              ])
            ).rejects.toMatchObject({ code: "42501" });
            await app.query("rollback to savepoint no_context_write");

            await applyTrustedSqlContext(
              app,
              mintAuthPreSessionAccess({ userId: null })
            );
            await app.query("savepoint auth_secret_denial");
            await expect(
              app.query("select token from session where id = $1", [
                "session-a",
              ])
            ).rejects.toMatchObject({ code: "42501" });
            await app.query("rollback to savepoint auth_secret_denial");
            const tenantSetting = await app.query<{
              tenant_id: string | null;
            }>(`select current_setting($1, true) as tenant_id`, [
              TENANT_CONTEXT_GUC,
            ]);
            expect(tenantSetting.rows[0]?.tenant_id).toBe("");
          } finally {
            await app.query("rollback");
          }
        }
      );

      await withClient(
        runtimeRoleUrl(
          database,
          AUTH_DATABASE_ROLE,
          ISOLATION_ROLE_PASSWORDS.auth
        ),
        async (auth) => {
          const sessions = await auth.query<{ token: string }>(
            "select token from session where id = $1",
            ["session-a"]
          );
          expect(sessions.rows[0]?.token).toBe("session-token-a");
          await auth.query("begin");
          try {
            await applyTrustedSqlContext(
              auth,
              mintAuthPreSessionAccess({ userId: parseUserId(USER_A) })
            );
            const memberships = await auth.query<{ tenant_id: string }>(
              "select tenant_id from memberships order by tenant_id"
            );
            expect(memberships.rows.map((row) => row.tenant_id)).toEqual([
              TENANT_A,
            ]);
            const tenants = await auth.query<{ id: string }>(
              "select id from tenants order by id"
            );
            expect(tenants.rows.map((row) => row.id)).toEqual([TENANT_A]);
          } finally {
            await auth.query("rollback");
          }
          await expect(
            auth.query("select id from campaigns")
          ).rejects.toMatchObject({ code: "42501" });
        }
      );
    },
    TEST_TIMEOUT_MS
  );

  it(
    "denies the worker role authentication secrets while allowing tenant-scoped product rows",
    async (ctx) => {
      if (!database) {
        ctx.skip();
        return;
      }

      await withClient(
        runtimeRoleUrl(
          database,
          RUNTIME_DATABASE_ROLES.worker,
          ISOLATION_ROLE_PASSWORDS.worker
        ),
        async (worker) => {
          /* oxlint-disable no-await-in-loop -- A single pg Client cannot issue overlapping queries; secret-table denials are checked one table at a time. */
          for (const tableName of AUTH_SECRET_TABLES) {
            await expect(
              worker.query(`select * from ${tableName}`)
            ).rejects.toMatchObject({ code: "42501" });
          }
          /* oxlint-enable no-await-in-loop */
          await expect(
            worker.query("select * from rate_limit")
          ).rejects.toMatchObject({ code: "42501" });
          await expect(
            worker.query('select * from "user"')
          ).rejects.toMatchObject({ code: "42501" });
          await expect(
            worker.query("delete from audit_events where false")
          ).rejects.toMatchObject({ code: "42501" });
          await expect(
            worker.query("delete from billing_entitlements where false")
          ).rejects.toMatchObject({ code: "42501" });
          await expect(
            worker.query(
              "insert into campaigns (id, tenant_id) values ($1, $2)",
              ["worker-campaign", TENANT_A]
            )
          ).rejects.toMatchObject({ code: "42501" });
          await expect(
            worker.query(
              "update style_profile_versions set tone = tone where false"
            )
          ).rejects.toMatchObject({ code: "42501" });
          await expect(
            worker.query(
              "update send_attempts set payload = payload where false"
            )
          ).rejects.toMatchObject({ code: "42501" });
          await expect(
            worker.query("update actions set payload = payload where false")
          ).rejects.toMatchObject({ code: "42501" });

          await worker.query("begin");
          try {
            await applyTrustedSqlContext(
              worker,
              mintTrustedWorkerAccess(workerScope(TENANT_A))
            );
            const campaigns = await worker.query<{ id: string }>(
              "select id from campaigns order by id"
            );
            expect(campaigns.rows.map((row) => row.id)).toEqual(["campaign-a"]);
            const lifecycleUpdate = await worker.query(
              "update actions set state = state where false"
            );
            expect(lifecycleUpdate.rowCount).toBe(0);
          } finally {
            await worker.query("rollback");
          }
        }
      );
    },
    TEST_TIMEOUT_MS
  );
});
