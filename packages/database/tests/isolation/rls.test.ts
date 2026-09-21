import { parseTenantId, parseUserId } from "@relanmo/domain/contracts";
import type {
  PersistenceWorkerId,
  TenantTransactionScope,
} from "@relanmo/domain/ports/persistence";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { applyDatabaseMigrations } from "../../src/schema/apply-migrations";
import {
  applyTrustedSqlContext,
  AUTH_SECRET_TABLES,
  mintAuthPreSessionAccess,
  mintTrustedTenantAccess,
  RUNTIME_DATABASE_ROLES,
} from "../../src/security";
import { TENANT_CONTEXT_GUC } from "../../src/transactions";
import { stopLocalPostgresAdmin } from "../support/local-postgres";
import type { IsolatedTestDatabase } from "../support/test-database";
import { createIsolatedTestDatabase } from "../support/test-database";
import {
  ISOLATION_ROLE_PASSWORDS,
  provisionRuntimeRoleLogins,
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
  await database?.drop();
  await stopLocalPostgresAdmin();
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
          rolname: string;
          rolsuper: boolean;
        }>(
          `select rolname, rolbypassrls, rolsuper
             from pg_roles
            where rolname = any($1::text[])
            order by rolname`,
          [[RUNTIME_DATABASE_ROLES.app, RUNTIME_DATABASE_ROLES.worker]]
        );
        expect(roles.rows).toEqual([
          {
            rolbypassrls: false,
            rolname: RUNTIME_DATABASE_ROLES.app,
            rolsuper: false,
          },
          {
            rolbypassrls: false,
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
          expect(row.owner).not.toBe(RUNTIME_DATABASE_ROLES.worker);
        }
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
            current_user: RUNTIME_DATABASE_ROLES.app,
            rolbypassrls: false,
          });
          await expect(
            app.query("alter table campaigns disable row level security")
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
          await app.query("begin");
          try {
            await applyTrustedSqlContext(
              app,
              mintTrustedTenantAccess(memberScope(TENANT_A))
            );
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

            await applyTrustedSqlContext(
              app,
              mintAuthPreSessionAccess({ userId: null })
            );
            const sessions = await app.query<{ token: string }>(
              "select token from session where id = $1",
              ["session-a"]
            );
            expect(sessions.rows[0]?.token).toBe("session-token-a");
            const tenantSetting = await app.query<{
              tenant_id: string | null;
            }>(`select current_setting($1, true) as tenant_id`, [
              TENANT_CONTEXT_GUC,
            ]);
            expect(tenantSetting.rows[0]?.tenant_id).toBe("");

            await applyTrustedSqlContext(
              app,
              mintAuthPreSessionAccess({ userId: parseUserId(USER_A) })
            );
            const memberships = await app.query<{ tenant_id: string }>(
              "select tenant_id from memberships order by tenant_id"
            );
            expect(memberships.rows.map((row) => row.tenant_id)).toEqual([
              TENANT_A,
            ]);
            const tenants = await app.query<{ id: string }>(
              "select id from tenants order by id"
            );
            expect(tenants.rows.map((row) => row.id)).toEqual([TENANT_A]);
          } finally {
            await app.query("rollback");
          }
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

          await worker.query("begin");
          try {
            await applyTrustedSqlContext(
              worker,
              mintTrustedTenantAccess(workerScope(TENANT_A))
            );
            const campaigns = await worker.query<{ id: string }>(
              "select id from campaigns order by id"
            );
            expect(campaigns.rows.map((row) => row.id)).toEqual(["campaign-a"]);
          } finally {
            await worker.query("rollback");
          }
        }
      );
    },
    TEST_TIMEOUT_MS
  );
});
