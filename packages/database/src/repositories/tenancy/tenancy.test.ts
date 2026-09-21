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
  parseCampaignId,
  parseModelVersion,
  parseProfileVersionId,
  parsePromptVersionId,
  parseTenantId,
  parseUserId,
  parseUtcTimestamp,
} from "@relanmo/domain/contracts";
import type { PromptVersionRef } from "@relanmo/domain/contracts";
import type {
  PersistenceResult,
  PersistenceTransactionWork,
  PersistenceWorkerId,
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
import type {
  CampaignScopedSaveProfileRevisionInput,
  SaveOnboardingProfileRevisionInput,
} from "./index";

const SETUP_TIMEOUT_MS = 60_000;
const TEST_TIMEOUT_MS = 30_000;
const SHARED_DISPLAY_NAME = "Atelier Lumière";
const CREATED_AT = parseUtcTimestamp("2026-09-21T10:00:00.000Z");
const DEFAULT_PROMPT_V1: PromptVersionRef = {
  createdAt: CREATED_AT,
  id: parsePromptVersionId("prompt-default-test-v1"),
  kind: "PROMPT_DEFAULT",
  revision: 1,
};
const DEFAULT_PROMPT_V2: PromptVersionRef = {
  createdAt: parseUtcTimestamp("2026-09-21T11:00:00.000Z"),
  id: parsePromptVersionId("prompt-default-test-v2"),
  kind: "PROMPT_DEFAULT",
  revision: 2,
};
const WRITING_MODEL_V1 = parseModelVersion("writer-test-v1");
const WRITING_MODEL_V2 = parseModelVersion("writer-test-v2");

let database: IsolatedTestDatabase | null = null;
let appEnv: DatabaseEnv | null = null;
let authEnv: DatabaseEnv | null = null;
let workerEnv: DatabaseEnv | null = null;
let activeDefaultPrompt = DEFAULT_PROMPT_V1;
let activeWritingModel = WRITING_MODEL_V1;

const repos = createTenancyRepositories({
  defaultPromptVersion: () => activeDefaultPrompt,
  writingModelVersion: () => activeWritingModel,
});

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

function onboardingInput(
  tenant: string,
  userId: string,
  profileVersionId: string,
  expectedProfile: SaveOnboardingProfileRevisionInput["expectedProfile"] = null
): SaveOnboardingProfileRevisionInput {
  return {
    createdAt: CREATED_AT,
    createdBy: parseUserId(userId),
    expectedProfile,
    facts: profileFactsFixture,
    profileVersionId: parseProfileVersionId(profileVersionId),
    tenantId: parseTenantId(tenant),
  };
}

function saveInput(
  tenant: string,
  userId: string,
  profileVersionId: string,
  expected: CampaignScopedSaveProfileRevisionInput["expectedCurrent"]["expected"],
  campaignId: string
): CampaignScopedSaveProfileRevisionInput {
  return {
    campaignId: parseCampaignId(campaignId),
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
          if (!(memberships.ok && self.ok && revoked.ok)) {
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
            },
          };
        })
      );

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
          repos.tenants.getMembership(
            {
              tenantId: parseTenantId(TENANT_B),
              userId: parseUserId(USER_B),
            },
            tx
          )
        )
      );
      expect(seenByB.membership?.tenantId).toBe(TENANT_B);

      const crossTenant = await runAsMember(TENANT_A, USER_A, (tx) =>
        repos.tenants.getMembership(
          {
            tenantId: parseTenantId(TENANT_B),
            userId: parseUserId(USER_B),
          },
          tx
        )
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
          repos.profiles.saveForOnboarding(
            onboardingInput(TENANT_A, USER_A, "profile-a-1"),
            tx
          )
        )
      );
      const savedB = expectOk(
        await runAsMember(TENANT_B, USER_B, (tx) =>
          repos.profiles.saveForOnboarding(
            onboardingInput(TENANT_B, USER_B, "profile-b-1"),
            tx
          )
        )
      );
      expect(savedA.outcome).toBe("UPDATED");
      expect(savedB.outcome).toBe("UPDATED");
      if (savedA.outcome !== "UPDATED" || savedB.outcome !== "UPDATED") {
        throw new Error("expected initialized profiles");
      }
      expect(savedA.value.profile.facts).toEqual(profileFactsFixture);
      expect(savedB.value.profile.facts).toEqual(profileFactsFixture);
      expect(savedA.value.profile.tenantId).toBe(TENANT_A);
      expect(savedB.value.profile.tenantId).toBe(TENANT_B);
      expect(savedA.value.profile.version.id).toBe("profile-a-1");
      expect(savedB.value.profile.version.id).toBe("profile-b-1");

      const currentA = expectOk(
        await runAsMember(TENANT_A, USER_A, (tx) =>
          repos.profiles.getForOnboarding(
            { tenantId: parseTenantId(TENANT_A) },
            tx
          )
        )
      );
      const revisedA = expectOk(
        await runAsMember(TENANT_A, USER_A, (tx) =>
          repos.profiles.saveForOnboarding(
            {
              ...onboardingInput(
                TENANT_A,
                USER_A,
                "profile-a-onboarding-2",
                currentA.version
              ),
              facts: {
                ...profileFactsFixture,
                offer: "J’accompagne les équipes produit.",
              },
            },
            tx
          )
        )
      );
      expect(revisedA.outcome).toBe("UPDATED");
      if (revisedA.outcome !== "UPDATED") {
        throw new Error("expected an onboarding profile revision");
      }
      expect(revisedA.value.version?.revision).toBe(2);

      const stale = expectOk(
        await runAsMember(TENANT_A, USER_A, (tx) =>
          repos.profiles.saveForOnboarding(
            onboardingInput(TENANT_A, USER_A, "profile-a-stale"),
            tx
          )
        )
      );
      expect(stale.outcome).toBe("REVISION_CONFLICT");
      if (stale.outcome !== "REVISION_CONFLICT") {
        throw new Error("expected a revision conflict");
      }
      expect(stale.actual?.id).toBe("profile-a-onboarding-2");
      expect(stale.expected).toBeNull();
    },
    TEST_TIMEOUT_MS
  );

  it(
    "scopes profile guards across multiple campaigns and detects campaign drift",
    async (ctx) => {
      if (!database) {
        ctx.skip();
        return;
      }

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

      const lateInitialization = await runAsMember(
        TENANT_A,
        USER_A,
        (tx) =>
          repos.profiles.saveForOnboarding(
            onboardingInput(TENANT_A, USER_A, "profile-late-onboarding"),
            tx
          )
      );
      expect(lateInitialization).toEqual({
        error: {
          code: "VALIDATION",
          detail: "profile onboarding requires a tenant without campaigns",
          retryable: false,
        },
        ok: false,
      });

      const current = expectOk(
        await runAsMember(TENANT_A, USER_A, (tx) =>
          repos.currentVersions.getCurrent(
            {
              campaignId: parseCampaignId("campaign-a"),
              tenantId: parseTenantId(TENANT_A),
            },
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
        campaign: {
          id: "campaign-version-a-1",
          kind: "CAMPAIGN",
          revision: 1,
        },
        defaultPrompt: DEFAULT_PROMPT_V1,
        explicitStyle: {
          id: "style-explicit-a-1",
          kind: "STYLE_EXPLICIT",
          revision: 1,
        },
        model: WRITING_MODEL_V1,
      });

      const secondCampaign = expectOk(
        await runAsMember(TENANT_A, USER_A, (tx) =>
          repos.currentVersions.getCurrent(
            {
              campaignId: parseCampaignId("campaign-a-2"),
              tenantId: parseTenantId(TENANT_A),
            },
            tx
          )
        )
      );
      expect(secondCampaign.versions.campaign?.id).toBe(
        "campaign-version-a-2"
      );

      const profile = expectOk(
        await runAsMember(TENANT_A, USER_A, (tx) =>
          repos.profiles.get(
            {
              campaignId: parseCampaignId("campaign-a"),
              tenantId: parseTenantId(TENANT_A),
            },
            tx
          )
        )
      );
      expect(profile.current).toEqual(current.versions);

      const tenant = expectOk(
        await runAsMember(TENANT_A, USER_A, (tx) =>
          repos.tenants.get(
            {
              campaignId: parseCampaignId("campaign-a"),
              tenantId: parseTenantId(TENANT_A),
            },
            tx
          )
        )
      );
      expect(tenant.tenant?.currentVersions).toEqual(current.versions);

      activeDefaultPrompt = DEFAULT_PROMPT_V2;
      const promptStale = expectOk(
        await runAsMember(TENANT_A, USER_A, (tx) =>
          repos.profiles.saveRevision(
            saveInput(
              TENANT_A,
              USER_A,
              "profile-prompt-drift",
              current.versions,
              "campaign-a"
            ),
            tx
          )
        )
      );
      expect(promptStale.outcome).toBe("REVISION_CONFLICT");
      if (promptStale.outcome !== "REVISION_CONFLICT") {
        throw new Error("expected default-prompt drift to conflict");
      }
      expect(promptStale.actual.campaign).toEqual(current.versions.campaign);
      expect(promptStale.actual.defaultPrompt).toEqual(DEFAULT_PROMPT_V2);

      activeWritingModel = WRITING_MODEL_V2;
      const modelStale = expectOk(
        await runAsMember(TENANT_A, USER_A, (tx) =>
          repos.profiles.saveRevision(
            saveInput(
              TENANT_A,
              USER_A,
              "profile-model-drift",
              promptStale.actual,
              "campaign-a"
            ),
            tx
          )
        )
      );
      expect(modelStale.outcome).toBe("REVISION_CONFLICT");
      if (modelStale.outcome !== "REVISION_CONFLICT") {
        throw new Error("expected writing-model drift to conflict");
      }
      expect(modelStale.actual.defaultPrompt).toEqual(DEFAULT_PROMPT_V2);
      expect(modelStale.actual.model).toBe(WRITING_MODEL_V2);

      await withClient(database.migrationUrl, async (client) => {
        await client.query(
          `insert into campaign_versions (
             id, campaign_id, tenant_id, revision, name, offer,
             icp_description, daily_quota, daily_invitation_quota,
             daily_message_quota, exclusions, targeting, sequence,
             sequence_closure, business_window, created_by
           ) values (
             'campaign-version-a-1-revised', 'campaign-a', $1, 2,
             'Campagne A révisée', 'Offre A', 'ICP A', 10, 5, 5,
             '[]', '{}', '[]', '{}', '{}', $2
           )`,
          [TENANT_A, USER_A]
        );
        await client.query(
          `update campaigns
           set active_version_id = 'campaign-version-a-1-revised'
           where id = 'campaign-a'`,
          []
        );
      });

      const stale = expectOk(
        await runAsMember(TENANT_A, USER_A, (tx) =>
          repos.profiles.saveRevision(
            saveInput(
              TENANT_A,
              USER_A,
              "profile-version-drift",
              modelStale.actual,
              "campaign-a"
            ),
            tx
          )
        )
      );
      expect(stale.outcome).toBe("REVISION_CONFLICT");
      if (stale.outcome !== "REVISION_CONFLICT") {
        throw new Error("expected active-version drift to conflict");
      }
      expect(stale.actual.campaign?.id).toBe("campaign-version-a-1-revised");
      expect(stale.expected).toEqual(modelStale.actual);

      const updated = expectOk(
        await runAsMember(TENANT_A, USER_A, (tx) =>
          repos.profiles.saveRevision(
            {
              ...saveInput(
                TENANT_A,
                USER_A,
                "profile-a-3",
                stale.actual,
                "campaign-a"
              ),
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
      expect(updated.value.profile.version.id).toBe("profile-a-3");
      expect(updated.value.profile.version.revision).toBe(3);
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
          saveInput(
            TENANT_A,
            USER_A,
            "profile-worker-1",
            emptyCurrentVersionSetFixture,
            "campaign-a"
          ),
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
