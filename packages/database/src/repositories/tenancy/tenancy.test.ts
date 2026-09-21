import { createDatabaseRuntimeClient } from "@relanmo/database/client";
import type { DatabaseEnv } from "@relanmo/database/client";
import {
  AUTH_DATABASE_ROLE,
  mintTrustedTenantAccess,
  mintTrustedWorkerAccess,
  RUNTIME_DATABASE_ROLES,
} from "@relanmo/database/security";
import { createPersistenceTransactionRunner } from "@relanmo/database/transactions";
import {
  parseProfileVersionId,
  parseTenantId,
  parseUserId,
  parseUtcTimestamp,
} from "@relanmo/domain/contracts";
import type {
  PersistenceResult,
  PersistenceTransactionWork,
  PersistenceWorkerId,
  SaveProfileRevisionInput,
  TenantTransactionScope,
} from "@relanmo/domain/ports/persistence";
import {
  emptyCurrentVersionSetFixture,
  profileFactsFixture,
} from "@relanmo/domain/ports/persistence";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  dropRuntimeRoleLogins,
  ISOLATION_ROLE_PASSWORDS,
  provisionRuntimeRoleLogins,
  runtimeRoleUrl,
  TENANT_A,
  TENANT_B,
  USER_A,
  USER_B,
  withClient,
} from "../../../tests/isolation/support";
import { stopLocalPostgresAdmin } from "../../../tests/support/local-postgres";
import type { IsolatedTestDatabase } from "../../../tests/support/test-database";
import { createIsolatedTestDatabase } from "../../../tests/support/test-database";
import { applyDatabaseMigrations } from "../../schema/apply-migrations";
import { createTenancyRepositories } from "./index";

const SETUP_TIMEOUT_MS = 60_000;
const TEST_TIMEOUT_MS = 30_000;
const SHARED_DISPLAY_NAME = "Atelier Lumière";
const CREATED_AT = parseUtcTimestamp("2026-09-21T10:00:00.000Z");

let database: IsolatedTestDatabase | null = null;
let appEnv: DatabaseEnv | null = null;
let authEnv: DatabaseEnv | null = null;
let workerEnv: DatabaseEnv | null = null;

const repos = createTenancyRepositories();

function runtimeEnv(
  target: IsolatedTestDatabase,
  runtimeUrl: string
): DatabaseEnv {
  return {
    migrationUrl: target.migrationUrl,
    poolConnectionTimeoutMs: 5000,
    poolIdleTimeoutMs: 10_000,
    poolMax: 2,
    runtimeUrl,
  };
}

function memberScope(tenant: string, userId: string): TenantTransactionScope {
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
      workerId: "p022-worker" as PersistenceWorkerId,
    },
    requestId: null,
    tenantId: parseTenantId(tenant),
  };
}

async function seedOverlappingTenants(
  target: IsolatedTestDatabase
): Promise<void> {
  await withClient(target.migrationUrl, async (client) => {
    await client.query(
      `insert into "user" (id, name, email)
       values ($1, 'Membre A', 'a@atelier.test'),
              ($2, 'Membre B', 'b@atelier.test')`,
      [USER_A, USER_B]
    );
    await client.query(
      `insert into tenants (id, display_name, status)
       values ($1, $3, 'ACTIVE'),
              ($2, $3, 'ACTIVE')`,
      [TENANT_A, TENANT_B, SHARED_DISPLAY_NAME]
    );
    await client.query(
      `insert into memberships (id, tenant_id, user_id, role, status)
       values ('membership-a', $1, $2, 'OWNER', 'ACTIVE'),
              ('membership-b', $3, $4, 'OWNER', 'ACTIVE'),
              ('membership-a-revoked', $1, $4, 'MEMBER', 'REVOKED')`,
      [TENANT_A, USER_A, TENANT_B, USER_B]
    );
  });
}

beforeAll(async () => {
  database = await createIsolatedTestDatabase("p022-tenancy");
  if (!database) {
    return;
  }
  await applyDatabaseMigrations({ migrationUrl: database.migrationUrl });
  await provisionRuntimeRoleLogins(database);
  await seedOverlappingTenants(database);
  appEnv = runtimeEnv(
    database,
    runtimeRoleUrl(
      database,
      RUNTIME_DATABASE_ROLES.app,
      ISOLATION_ROLE_PASSWORDS.app
    )
  );
  authEnv = runtimeEnv(
    database,
    runtimeRoleUrl(database, AUTH_DATABASE_ROLE, ISOLATION_ROLE_PASSWORDS.auth)
  );
  workerEnv = runtimeEnv(
    database,
    runtimeRoleUrl(
      database,
      RUNTIME_DATABASE_ROLES.worker,
      ISOLATION_ROLE_PASSWORDS.worker
    )
  );
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

async function runAsMember<Value>(
  tenant: string,
  userId: string,
  work: PersistenceTransactionWork<Value>
): Promise<PersistenceResult<Value>> {
  if (!(appEnv && authEnv)) {
    throw new Error("runtime clients were not initialized");
  }
  const authClient = createDatabaseRuntimeClient(authEnv);
  const appClient = createDatabaseRuntimeClient(appEnv);
  try {
    const access = await mintTrustedTenantAccess(
      authClient.pool,
      memberScope(tenant, userId)
    );
    return await createPersistenceTransactionRunner(appClient.db).run({
      access,
      work,
    });
  } finally {
    await appClient.close();
    await authClient.close();
  }
}

async function runAsWorker<Value>(
  tenant: string,
  work: PersistenceTransactionWork<Value>
): Promise<PersistenceResult<Value>> {
  if (!workerEnv) {
    throw new Error("worker client was not initialized");
  }
  const workerClient = createDatabaseRuntimeClient(workerEnv);
  try {
    return await createPersistenceTransactionRunner(workerClient.db).run({
      access: mintTrustedWorkerAccess(workerScope(tenant)),
      work,
    });
  } finally {
    await workerClient.close();
  }
}

function saveInput(
  tenant: string,
  userId: string,
  profileVersionId: string,
  expected = emptyCurrentVersionSetFixture
): SaveProfileRevisionInput {
  return {
    createdAt: CREATED_AT,
    createdBy: parseUserId(userId),
    expectedCurrent: { expected },
    facts: profileFactsFixture,
    profileVersionId: parseProfileVersionId(profileVersionId),
    tenantId: parseTenantId(tenant),
  };
}

function expectOk<Value>(result: PersistenceResult<Value>): Value {
  expect(result.ok).toBe(true);
  if (!result.ok) {
    throw new Error(result.error.detail ?? result.error.code);
  }
  return result.value;
}

describe("membership and freelancer profile repositories (live local Postgres)", () => {
  it(
    "resolves membership from the server scope and hides the other tenant",
    async (ctx) => {
      if (!database) {
        ctx.skip();
        return;
      }

      const seenByA = expectOk(
        await runAsMember(TENANT_A, USER_A, async (tx) => {
          const tenant = await repos.tenants.get(
            { tenantId: parseTenantId(TENANT_A) },
            tx
          );
          const memberships = await repos.tenants.listMemberships(
            { includeRevoked: false, tenantId: parseTenantId(TENANT_A) },
            tx
          );
          const self = await repos.tenants.getMembership(
            {
              tenantId: parseTenantId(TENANT_A),
              userId: parseUserId(USER_A),
            },
            tx
          );
          const revoked = await repos.tenants.getMembership(
            {
              tenantId: parseTenantId(TENANT_A),
              userId: parseUserId(USER_B),
            },
            tx
          );
          if (!(tenant.ok && memberships.ok && self.ok && revoked.ok)) {
            return {
              error: {
                code: "INTEGRITY" as const,
                detail: "nested tenant read failed",
                retryable: false,
              },
              ok: false as const,
            };
          }
          return {
            ok: true as const,
            value: {
              memberships: memberships.value.memberships,
              revoked: revoked.value.membership,
              self: self.value.membership,
              tenant: tenant.value.tenant,
            },
          };
        })
      );

      expect(seenByA.tenant?.displayName).toBe(SHARED_DISPLAY_NAME);
      expect(seenByA.tenant?.tenantId).toBe(TENANT_A);
      expect(seenByA.self?.role).toBe("OWNER");
      expect(seenByA.self?.status).toBe("ACTIVE");
      expect(seenByA.memberships.map((row) => row.userId)).toEqual([USER_A]);
      expect(seenByA.revoked?.status).toBe("REVOKED");

      const includingRevoked = expectOk(
        await runAsMember(TENANT_A, USER_A, (tx) =>
          repos.tenants.listMemberships(
            { includeRevoked: true, tenantId: parseTenantId(TENANT_A) },
            tx
          )
        )
      );
      expect(
        new Set(includingRevoked.memberships.map((row) => row.userId))
      ).toEqual(new Set([USER_A, USER_B]));

      const seenByB = expectOk(
        await runAsMember(TENANT_B, USER_B, (tx) =>
          repos.tenants.get({ tenantId: parseTenantId(TENANT_B) }, tx)
        )
      );
      expect(seenByB.tenant?.displayName).toBe(SHARED_DISPLAY_NAME);
      expect(seenByB.tenant?.tenantId).toBe(TENANT_B);

      const crossTenant = await runAsMember(TENANT_A, USER_A, (tx) =>
        repos.tenants.get({ tenantId: parseTenantId(TENANT_B) }, tx)
      );
      expect(crossTenant).toEqual({
        error: {
          code: "FORBIDDEN",
          detail: "TENANT_SCOPE_MISMATCH",
          retryable: false,
        },
        ok: false,
      });

      if (!authEnv) {
        throw new Error("auth client was not initialized");
      }
      const authClient = createDatabaseRuntimeClient(authEnv);
      try {
        await expect(
          mintTrustedTenantAccess(
            authClient.pool,
            memberScope(TENANT_B, USER_A)
          )
        ).rejects.toThrow("active membership is required");
      } finally {
        await authClient.close();
      }
    },
    TEST_TIMEOUT_MS
  );

  it(
    "keeps identical freelancer offers tenant-scoped and rejects a stale revision",
    async (ctx) => {
      if (!database) {
        ctx.skip();
        return;
      }

      const savedA = expectOk(
        await runAsMember(TENANT_A, USER_A, (tx) =>
          repos.profiles.saveRevision(
            saveInput(TENANT_A, USER_A, "profile-a-1"),
            tx
          )
        )
      );
      const savedB = expectOk(
        await runAsMember(TENANT_B, USER_B, (tx) =>
          repos.profiles.saveRevision(
            saveInput(TENANT_B, USER_B, "profile-b-1"),
            tx
          )
        )
      );
      expect(savedA.outcome).toBe("UPDATED");
      expect(savedB.outcome).toBe("UPDATED");

      const profileA = expectOk(
        await runAsMember(TENANT_A, USER_A, (tx) =>
          repos.profiles.get({ tenantId: parseTenantId(TENANT_A) }, tx)
        )
      );
      const profileB = expectOk(
        await runAsMember(TENANT_B, USER_B, (tx) =>
          repos.profiles.get({ tenantId: parseTenantId(TENANT_B) }, tx)
        )
      );
      expect(profileA.profile?.facts).toEqual(profileFactsFixture);
      expect(profileB.profile?.facts).toEqual(profileFactsFixture);
      expect(profileA.profile?.tenantId).toBe(TENANT_A);
      expect(profileB.profile?.tenantId).toBe(TENANT_B);
      expect(profileA.profile?.version.id).toBe("profile-a-1");
      expect(profileB.profile?.version.id).toBe("profile-b-1");

      const stale = expectOk(
        await runAsMember(TENANT_A, USER_A, (tx) =>
          repos.profiles.saveRevision(
            saveInput(TENANT_A, USER_A, "profile-a-stale"),
            tx
          )
        )
      );
      expect(stale.outcome).toBe("REVISION_CONFLICT");
      if (stale.outcome !== "REVISION_CONFLICT") {
        throw new Error("expected a revision conflict");
      }
      expect(stale.actual.profile?.id).toBe("profile-a-1");
      expect(stale.expected.profile).toBeNull();

      const unchanged = expectOk(
        await runAsMember(TENANT_A, USER_A, (tx) =>
          repos.profiles.get({ tenantId: parseTenantId(TENANT_A) }, tx)
        )
      );
      expect(unchanged.profile?.version.id).toBe("profile-a-1");
      expect(unchanged.profile?.facts.offer).toBe(profileFactsFixture.offer);

      const updated = expectOk(
        await runAsMember(TENANT_A, USER_A, (tx) =>
          repos.profiles.saveRevision(
            {
              ...saveInput(TENANT_A, USER_A, "profile-a-2", stale.actual),
              facts: {
                ...profileFactsFixture,
                offer: "J’accompagne les équipes produit sur la prospection.",
              },
            },
            tx
          )
        )
      );
      expect(updated.outcome).toBe("UPDATED");
      if (updated.outcome !== "UPDATED") {
        throw new Error("expected an updated profile");
      }
      expect(updated.value.profile.version.id).toBe("profile-a-2");
      expect(updated.value.profile.version.revision).toBe(2);
      expect(updated.value.profile.facts.offer).toBe(
        "J’accompagne les équipes produit sur la prospection."
      );

      const current = expectOk(
        await runAsMember(TENANT_A, USER_A, (tx) =>
          repos.currentVersions.getCurrent(
            { tenantId: parseTenantId(TENANT_A) },
            tx
          )
        )
      );
      expect(current.versions.profile?.id).toBe("profile-a-2");
      expect(current.tenantId).toBe(TENANT_A);

      const otherTenantUnchanged = expectOk(
        await runAsMember(TENANT_B, USER_B, (tx) =>
          repos.profiles.get({ tenantId: parseTenantId(TENANT_B) }, tx)
        )
      );
      expect(otherTenantUnchanged.profile?.version.id).toBe("profile-b-1");
      expect(otherTenantUnchanged.profile?.facts.offer).toBe(
        profileFactsFixture.offer
      );
    },
    TEST_TIMEOUT_MS
  );

  it(
    "scopes profile snapshots across multiple campaigns and detects style drift",
    async (ctx) => {
      if (!database) {
        ctx.skip();
        return;
      }

      const before = expectOk(
        await runAsMember(TENANT_A, USER_A, (tx) =>
          repos.currentVersions.getCurrent(
            { tenantId: parseTenantId(TENANT_A) },
            tx
          )
        )
      );

      await withClient(database.migrationUrl, async (client) => {
        await client.query(
          `insert into campaigns (id, tenant_id, status)
           values ('campaign-a', $1, 'ACTIVE')`,
          [TENANT_A]
        );
        await client.query(
          `insert into campaign_versions (
             id, campaign_id, tenant_id, revision, name, offer,
             icp_description, daily_quota, daily_invitation_quota,
             daily_message_quota, exclusions, targeting, sequence,
             sequence_closure, business_window, created_by
           ) values (
             'campaign-version-a-1', 'campaign-a', $1, 1, 'Campagne A',
             'Offre A', 'ICP A', 10, 5, 5, '[]', '{}', '[]', '{}', '{}', $2
           )`,
          [TENANT_A, USER_A]
        );
        await client.query(
          `update campaigns
           set active_version_id = 'campaign-version-a-1'
           where id = 'campaign-a'`,
          []
        );
        await client.query(
          `insert into campaigns (id, tenant_id, status)
           values ('campaign-a-2', $1, 'ACTIVE')`,
          [TENANT_A]
        );
        await client.query(
          `insert into campaign_versions (
             id, campaign_id, tenant_id, revision, name, offer,
             icp_description, daily_quota, daily_invitation_quota,
             daily_message_quota, exclusions, targeting, sequence,
             sequence_closure, business_window, created_by
           ) values (
             'campaign-version-a-2', 'campaign-a-2', $1, 1, 'Campagne A2',
             'Offre A2', 'ICP A2', 10, 5, 5, '[]', '{}', '[]', '{}', '{}', $2
           )`,
          [TENANT_A, USER_A]
        );
        await client.query(
          `update campaigns
           set active_version_id = 'campaign-version-a-2'
           where id = 'campaign-a-2'`,
          []
        );
        await client.query(
          `insert into style_profiles (id, tenant_id)
           values ('style-profile-a', $1)`,
          [TENANT_A]
        );
        await client.query(
          `insert into style_profile_versions (
             id, style_profile_id, tenant_id, kind, revision, tone,
             formality, model, created_by
           ) values
             ('style-explicit-a-1', 'style-profile-a', $1,
              'STYLE_EXPLICIT', 1, 'FORMAL', 'FORMAL', null, $2),
             ('style-inferred-a-1', 'style-profile-a', $1,
              'STYLE_INFERRED', 2, null, null, 'writer-a-1', null)`,
          [TENANT_A, USER_A]
        );
        await client.query(
          `update style_profiles
           set explicit_version_id = 'style-explicit-a-1',
               accepted_inferred_version_id = 'style-inferred-a-1'
           where id = 'style-profile-a'`,
          []
        );
        await client.query(
          `insert into prompt_overrides (id, tenant_id, campaign_id)
           values ('prompt-override-a', $1, 'campaign-a')`,
          [TENANT_A]
        );
        await client.query(
          `insert into prompt_override_versions (
             id, prompt_override_id, tenant_id, revision, created_by
           ) values (
             'prompt-version-a-1', 'prompt-override-a', $1, 1, $2
           )`,
          [TENANT_A, USER_A]
        );
        await client.query(
          `update prompt_overrides
           set active_version_id = 'prompt-version-a-1'
           where id = 'prompt-override-a'`,
          []
        );
        await client.query(
          `insert into prompt_overrides (id, tenant_id, campaign_id)
           values ('prompt-override-a-2', $1, 'campaign-a-2')`,
          [TENANT_A]
        );
        await client.query(
          `insert into prompt_override_versions (
             id, prompt_override_id, tenant_id, revision, created_by
           ) values (
             'prompt-version-a-2', 'prompt-override-a-2', $1, 1, $2
           )`,
          [TENANT_A, USER_A]
        );
        await client.query(
          `update prompt_overrides
           set active_version_id = 'prompt-version-a-2'
           where id = 'prompt-override-a-2'`,
          []
        );
      });

      const current = expectOk(
        await runAsMember(TENANT_A, USER_A, (tx) =>
          repos.currentVersions.getCurrent(
            { tenantId: parseTenantId(TENANT_A) },
            tx
          )
        )
      );
      expect(current.versions).toMatchObject({
        acceptedInferredStyle: {
          id: "style-inferred-a-1",
          kind: "STYLE_INFERRED",
          revision: 2,
        },
        campaign: null,
        defaultPrompt: null,
        explicitStyle: {
          id: "style-explicit-a-1",
          kind: "STYLE_EXPLICIT",
          revision: 1,
        },
        model: null,
      });

      const profile = expectOk(
        await runAsMember(TENANT_A, USER_A, (tx) =>
          repos.profiles.get({ tenantId: parseTenantId(TENANT_A) }, tx)
        )
      );
      expect(profile.current).toEqual(current.versions);

      const tenant = expectOk(
        await runAsMember(TENANT_A, USER_A, (tx) =>
          repos.tenants.get({ tenantId: parseTenantId(TENANT_A) }, tx)
        )
      );
      expect(tenant.tenant?.currentVersions).toEqual(current.versions);

      const stale = expectOk(
        await runAsMember(TENANT_A, USER_A, (tx) =>
          repos.profiles.saveRevision(
            saveInput(
              TENANT_A,
              USER_A,
              "profile-version-drift",
              before.versions
            ),
            tx
          )
        )
      );
      expect(stale.outcome).toBe("REVISION_CONFLICT");
      if (stale.outcome !== "REVISION_CONFLICT") {
        throw new Error("expected active-version drift to conflict");
      }
      expect(stale.actual).toEqual(current.versions);
      expect(stale.expected).toEqual(before.versions);
    },
    TEST_TIMEOUT_MS
  );

  it(
    "does not let a worker replace the customer profile",
    async (ctx) => {
      if (!database) {
        ctx.skip();
        return;
      }

      const result = await runAsWorker(TENANT_A, (tx) =>
        repos.profiles.saveRevision(
          saveInput(TENANT_A, USER_A, "profile-worker-1"),
          tx
        )
      );
      expect(result).toEqual({
        error: {
          code: "FORBIDDEN",
          detail: "profile revisions require an active member principal",
          retryable: false,
        },
        ok: false,
      });
    },
    TEST_TIMEOUT_MS
  );
});
