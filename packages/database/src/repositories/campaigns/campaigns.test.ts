import { randomUUID } from "node:crypto";

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
  parseAccountId,
  parseActionId,
  parseCampaignId,
  parseCampaignVersionId,
  parseConversationId,
  parseModelVersion,
  parsePromptVersionId,
  parseProspectId,
  parseTenantId,
  parseUserId,
  parseUtcTimestamp,
} from "@relanmo/domain/contracts";
import {
  DEFAULT_BUSINESS_WINDOW_CONFIGURATION,
  DEFAULT_SEQUENCE_CLOSURE,
  DEFAULT_SEQUENCE_PLAN,
} from "@relanmo/domain/contracts/values";
import type {
  CampaignDefinition,
  CampaignRecord,
  CreateCampaignInput,
  PersistenceTransaction,
  PersistenceWorkerId,
  SaveCampaignVersionInput,
  TenantTransactionScope,
} from "@relanmo/domain/ports/persistence";
import { emptyCurrentVersionSetFixture } from "@relanmo/domain/ports/persistence";
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
} from "../../../tests/isolation/support";
import { stopLocalPostgresAdmin } from "../../../tests/support/local-postgres";
import type { IsolatedTestDatabase } from "../../../tests/support/test-database";
import { createIsolatedTestDatabase } from "../../../tests/support/test-database";
import { applyDatabaseMigrations } from "../../schema/apply-migrations";
import { actions } from "../../schema/delivery";
import { conversations, prospects, providerAccounts } from "../../schema/leads";
import { resolveTransactionExecutor } from "../../transactions/registry";
import { createCampaignRepository } from "./index";

const SETUP_TIMEOUT_MS = 60_000;
const TEST_TIMEOUT_MS = 30_000;
const CREATED_AT = parseUtcTimestamp("2026-09-17T10:00:00.000Z");
const PAUSED_AT = parseUtcTimestamp("2026-09-17T11:00:00.000Z");
const ACTIVATED_AT = parseUtcTimestamp("2026-09-17T10:30:00.000Z");
const EDITED_AT = parseUtcTimestamp("2026-09-17T12:00:00.000Z");

const definition = {
  businessWindow: DEFAULT_BUSINESS_WINDOW_CONFIGURATION,
  dailyInvitationQuota: 8,
  dailyMessageQuota: 12,
  exclusions: ["Agences concurrentes"],
  icpDescription: "Fondateurs et heads of sales SaaS B2B en France",
  name: "Campagne SaaS France",
  sequenceClosure: DEFAULT_SEQUENCE_CLOSURE,
  sequencePlan: DEFAULT_SEQUENCE_PLAN,
} satisfies CampaignDefinition;

let database: IsolatedTestDatabase | null = null;

function workerScope(tenant: string): TenantTransactionScope {
  return {
    principal: {
      kind: "WORKER",
      // SAFETY: synthetic test worker id, never used outside this fixture.
      workerId: "p023-worker" as PersistenceWorkerId,
    },
    requestId: null,
    tenantId: parseTenantId(tenant),
  };
}

function memberScope(tenant: string, userId: string): TenantTransactionScope {
  return {
    principal: { kind: "MEMBER", userId: parseUserId(userId) },
    requestId: null,
    tenantId: parseTenantId(tenant),
  };
}

function makeClient(
  target: IsolatedTestDatabase,
  runtimeUrl = target.runtimeUrl
) {
  const env: DatabaseEnv = {
    migrationUrl: target.migrationUrl,
    poolConnectionTimeoutMs: 5000,
    poolIdleTimeoutMs: 10_000,
    poolMax: 4,
    runtimeUrl,
  };
  return createDatabaseRuntimeClient(env);
}

async function seedUsersAndTenants(
  target: IsolatedTestDatabase
): Promise<void> {
  const client = makeClient(target);
  try {
    await client.pool.query(
      `insert into "user" (id, name, email)
       values ($1, 'Propriétaire A', 'a-p023@example.test'),
              ($2, 'Propriétaire B', 'b-p023@example.test')`,
      [USER_A, USER_B]
    );
    await client.pool.query(
      `insert into tenants (id, display_name, status)
       values ($1, 'Tenant A', 'ACTIVE'),
              ($2, 'Tenant B', 'ACTIVE')`,
      [TENANT_A, TENANT_B]
    );
    await client.pool.query(
      `insert into memberships (id, tenant_id, user_id, role, status)
       values ('membership-p023-a', $1, $2, 'OWNER', 'ACTIVE'),
              ('membership-p023-b', $3, $4, 'OWNER', 'ACTIVE')`,
      [TENANT_A, USER_A, TENANT_B, USER_B]
    );
  } finally {
    await client.close();
  }
}

async function establishMemberAccess(
  target: IsolatedTestDatabase,
  tenant: string,
  userId: string
) {
  const authClient = makeClient(
    target,
    runtimeRoleUrl(target, AUTH_DATABASE_ROLE, ISOLATION_ROLE_PASSWORDS.auth)
  );
  try {
    return await mintTrustedTenantAccess(
      authClient.pool,
      memberScope(tenant, userId)
    );
  } finally {
    await authClient.close();
  }
}

function createInput(tenant: string, suffix: string): CreateCampaignInput {
  return {
    campaignId: parseCampaignId(`campaign_${suffix}`),
    createdAt: CREATED_AT,
    createdBy: parseUserId(tenant === TENANT_A ? USER_A : USER_B),
    definition,
    initialVersionId: parseCampaignVersionId(`campaign_version_${suffix}_1`),
    tenantId: parseTenantId(tenant),
  };
}

function guardFor(campaign: CampaignRecord) {
  return {
    expected: {
      ...emptyCurrentVersionSetFixture,
      campaign: campaign.currentVersion?.version ?? null,
    },
  };
}

beforeAll(async () => {
  database = await createIsolatedTestDatabase("p023-campaigns");
  if (!database) {
    return;
  }
  await applyDatabaseMigrations({ migrationUrl: database.migrationUrl });
  await provisionRuntimeRoleLogins(database);
  await seedUsersAndTenants(database);
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

describe("campaign version persistence", () => {
  it(
    "creates an immutable first version and round-trips it",
    async (ctx) => {
      if (!database) {
        ctx.skip();
        return;
      }
      const client = makeClient(database);
      const campaigns = createCampaignRepository();
      const runner = createPersistenceTransactionRunner(client.db);
      const input = createInput(TENANT_A, `create_${randomUUID().slice(0, 8)}`);
      try {
        const created = await runner.run({
          access: mintTrustedWorkerAccess(workerScope(TENANT_A)),
          work: (tx) => campaigns.create(input, tx),
        });
        expect(created.ok).toBe(true);
        if (!created.ok || created.value.outcome !== "CREATED") {
          throw new Error("expected CREATED campaign");
        }
        expect(created.value.campaign.status).toBe("DRAFT");
        expect(created.value.campaign.currentVersion?.definition).toEqual(
          definition
        );
        expect(created.value.campaign.currentVersion?.version.revision).toBe(1);

        const loaded = await runner.run({
          access: mintTrustedWorkerAccess(workerScope(TENANT_A)),
          work: (tx) =>
            campaigns.get(
              { campaignId: input.campaignId, tenantId: input.tenantId },
              tx
            ),
        });
        expect(loaded.ok).toBe(true);
        if (!loaded.ok) {
          throw new Error("expected get success");
        }
        expect(loaded.value.campaign?.currentVersion?.version.id).toBe(
          input.initialVersionId
        );
      } finally {
        await client.close();
      }
    },
    TEST_TIMEOUT_MS
  );

  it(
    "rejects a stale version guard and rolls back so no outbox row is written",
    async (ctx) => {
      if (!database) {
        ctx.skip();
        return;
      }
      const client = makeClient(database);
      const campaigns = createCampaignRepository();
      const runner = createPersistenceTransactionRunner(client.db);
      const input = createInput(
        TENANT_A,
        `conflict_${randomUUID().slice(0, 8)}`
      );
      try {
        const created = await runner.run({
          access: mintTrustedWorkerAccess(workerScope(TENANT_A)),
          work: (tx) => campaigns.create(input, tx),
        });
        if (!created.ok) {
          throw new Error("expected CREATED campaign");
        }
        if (created.value.outcome !== "CREATED") {
          throw new Error("expected CREATED campaign");
        }
        const { campaign } = created.value;
        const staleGuard = {
          expected: {
            ...emptyCurrentVersionSetFixture,
            campaign: campaign.currentVersion && {
              ...campaign.currentVersion.version,
              id: parseCampaignVersionId("campaign_version_stale"),
            },
          },
        };

        const conflict = await runner.run({
          access: mintTrustedWorkerAccess(workerScope(TENANT_A)),
          work: async (tx) => {
            const paused = await campaigns.pause(
              {
                campaignId: input.campaignId,
                expectedCurrent: staleGuard,
                pausedAt: PAUSED_AT,
                tenantId: input.tenantId,
              },
              tx
            );
            if (!paused.ok) {
              return paused;
            }
            if (paused.value.outcome === "REVISION_CONFLICT") {
              return paused;
            }
            throw new Error("stale pause must not mutate");
          },
        });
        expect(conflict.ok).toBe(true);
        if (!conflict.ok) {
          throw new Error("expected revision conflict result");
        }
        expect(conflict.value.outcome).toBe("REVISION_CONFLICT");

        const events = await client.pool.query<{ count: string }>(
          "select count(*)::text as count from outbox_events where payload->>'tenantId' = $1 and payload->>'type' in ('PAUSE_WORKFLOW', 'START_WORKFLOW') and dedupe_key like $2",
          [TENANT_A, `campaign:${input.campaignId}:%`]
        );
        expect(events.rows[0]?.count).toBe("0");

        const status = await client.pool.query<{
          outbound_paused: boolean;
          status: string;
        }>("select status, outbound_paused from campaigns where id = $1", [
          input.campaignId,
        ]);
        expect(status.rows[0]).toEqual({
          outbound_paused: false,
          status: "DRAFT",
        });
      } finally {
        await client.close();
      }
    },
    TEST_TIMEOUT_MS
  );

  it(
    "pauses on the campaign row immediately and enqueues PAUSE_WORKFLOW in the same transaction",
    async (ctx) => {
      if (!database) {
        ctx.skip();
        return;
      }
      const client = makeClient(database);
      const campaigns = createCampaignRepository();
      const runner = createPersistenceTransactionRunner(client.db);
      const input = createInput(TENANT_A, `pause_${randomUUID().slice(0, 8)}`);
      try {
        const created = await runner.run({
          access: mintTrustedWorkerAccess(workerScope(TENANT_A)),
          work: (tx) => campaigns.create(input, tx),
        });
        if (!created.ok) {
          throw new Error("expected CREATED campaign");
        }
        if (created.value.outcome !== "CREATED") {
          throw new Error("expected CREATED campaign");
        }
        const createdCampaign = created.value.campaign;
        const activated = await runner.run({
          access: mintTrustedWorkerAccess(workerScope(TENANT_A)),
          work: (tx) =>
            campaigns.activate(
              {
                campaignId: input.campaignId,
                expectedCurrent: guardFor(createdCampaign),
                requestedAt: ACTIVATED_AT,
                tenantId: input.tenantId,
                versionId: input.initialVersionId,
              },
              tx
            ),
        });
        if (!activated.ok) {
          throw new Error("expected activated campaign");
        }
        if (activated.value.outcome !== "UPDATED") {
          throw new Error("expected activated campaign");
        }
        const activatedCampaign = activated.value.value;

        const paused = await runner.run({
          access: mintTrustedWorkerAccess(workerScope(TENANT_A)),
          work: (tx) =>
            campaigns.pause(
              {
                campaignId: input.campaignId,
                expectedCurrent: activatedCampaign.current.campaign
                  ? { expected: activatedCampaign.current }
                  : guardFor(activatedCampaign.campaign),
                pausedAt: PAUSED_AT,
                tenantId: input.tenantId,
              },
              tx
            ),
        });
        expect(paused.ok).toBe(true);
        if (!paused.ok || paused.value.outcome !== "UPDATED") {
          throw new Error("expected pause UPDATED");
        }
        expect(paused.value.value.campaign.status).toBe("PAUSED");

        const row = await client.pool.query<{
          outbound_paused: boolean;
          pause_reason: string | null;
          status: string;
        }>(
          "select status, outbound_paused, pause_reason from campaigns where id = $1",
          [input.campaignId]
        );
        expect(row.rows[0]).toEqual({
          outbound_paused: true,
          pause_reason: "CAMPAIGN_PAUSED",
          status: "PAUSED",
        });

        const pending = await client.pool.query<{
          kind: string;
          state: string;
        }>(
          "select kind, state from outbox_events where tenant_id = $1 and payload->>'type' = 'PAUSE_WORKFLOW' and dedupe_key like $2",
          [TENANT_A, `campaign:${input.campaignId}:%`]
        );
        expect(pending.rows).toEqual([
          { kind: "PAUSE_WORKFLOW", state: "PENDING" },
        ]);
      } finally {
        await client.close();
      }
    },
    TEST_TIMEOUT_MS
  );

  it(
    "keeps completed actions and human ownership when a new immutable version is saved",
    async (ctx) => {
      if (!database) {
        ctx.skip();
        return;
      }
      const client = makeClient(database);
      const campaigns = createCampaignRepository();
      const runner = createPersistenceTransactionRunner(client.db);
      const suffix = randomUUID().slice(0, 8);
      const input = createInput(TENANT_A, `progress_${suffix}`);
      const accountId = parseAccountId(`provider_account_${suffix}`);
      const prospectId = parseProspectId(`prospect_${suffix}`);
      try {
        const created = await runner.run({
          access: mintTrustedWorkerAccess(workerScope(TENANT_A)),
          work: (tx) => campaigns.create(input, tx),
        });
        if (!created.ok) {
          throw new Error("expected CREATED campaign");
        }
        if (created.value.outcome !== "CREATED") {
          throw new Error("expected CREATED campaign");
        }
        const createdCampaign = created.value.campaign;

        const saved = await runner.run({
          access: mintTrustedWorkerAccess(workerScope(TENANT_A)),
          work: async (tx) => {
            const db = resolveTransactionExecutor(tx);
            await db.insert(providerAccounts).values([
              {
                healthObservedAt: new Date(CREATED_AT),
                id: accountId,
                providerAccountId: `provider-${suffix}`,
                status: "HEALTHY",
                tenantId: input.tenantId,
              },
            ]);
            await db.insert(prospects).values([
              {
                accountId,
                id: prospectId,
                providerProfileId: `profile-${suffix}`,
                status: "ACTIVE",
                tenantId: input.tenantId,
              },
            ]);
            await db.insert(conversations).values([
              {
                accountId,
                id: parseConversationId(`conversation_${suffix}`),
                ownershipKind: "HUMAN_OWNED",
                ownershipReason: "INCOMING_MESSAGE",
                ownershipRecordedAt: new Date(CREATED_AT),
                prospectId,
                status: "ACTIVE",
                tenantId: input.tenantId,
              },
            ]);
            const { currentVersion } = createdCampaign;
            if (!currentVersion) {
              throw new Error("created campaign must have a current version");
            }
            await db.insert(actions).values([
              {
                accountId,
                campaignId: input.campaignId,
                campaignVersionId: input.initialVersionId,
                createdAt: CREATED_AT,
                evidenceIds: [],
                id: parseActionId(`action_${suffix}`),
                payload: {
                  kind: "INVITATION_WITHOUT_NOTE",
                  note: null,
                  step: "INVITATION",
                },
                prospectId,
                sourceVersions: {
                  acceptedInferredStyle: null,
                  campaign: currentVersion.version,
                  defaultPrompt: {
                    createdAt: CREATED_AT,
                    id: parsePromptVersionId("prompt_default_1"),
                    kind: "PROMPT_DEFAULT",
                    revision: 1,
                  },
                  explicitStyle: null,
                  model: parseModelVersion("claude-sonnet-4-6"),
                  profile: null,
                },
                state: "CONFIRMED",
                stateAt: CREATED_AT,
                step: "INVITATION",
                tenantId: input.tenantId,
              },
            ]);

            return campaigns.saveVersion(
              {
                campaignId: input.campaignId,
                createdAt: EDITED_AT,
                createdBy: parseUserId(USER_A),
                definition: {
                  ...definition,
                  name: "Campagne SaaS France — révision",
                },
                expectedCurrent: guardFor(createdCampaign),
                tenantId: input.tenantId,
                versionId: parseCampaignVersionId(
                  `campaign_version_progress_${suffix}_2`
                ),
              } satisfies SaveCampaignVersionInput,
              tx
            );
          },
        });
        expect(saved.ok).toBe(true);
        if (!saved.ok || saved.value.outcome !== "UPDATED") {
          throw new Error("expected saved version");
        }
        expect(saved.value.value.version.definition.name).toBe(
          "Campagne SaaS France — révision"
        );
        expect(saved.value.value.version.version.revision).toBe(2);
        expect(saved.value.value.campaign.currentVersion?.version.id).toBe(
          parseCampaignVersionId(`campaign_version_progress_${suffix}_2`)
        );

        const action = await client.pool.query<{
          campaign_version_id: string;
          state: string;
        }>("select state, campaign_version_id from actions where id = $1", [
          `action_${suffix}`,
        ]);
        expect(action.rows[0]).toEqual({
          campaign_version_id: input.initialVersionId,
          state: "CONFIRMED",
        });
        const ownership = await client.pool.query<{
          ownership_kind: string;
        }>("select ownership_kind from conversations where id = $1", [
          `conversation_${suffix}`,
        ]);
        expect(ownership.rows[0]?.ownership_kind).toBe("HUMAN_OWNED");

        const versions = await client.pool.query<{ count: string }>(
          "select count(*)::text as count from campaign_versions where campaign_id = $1",
          [input.campaignId]
        );
        expect(versions.rows[0]?.count).toBe("2");
        const original = await client.pool.query<{ name: string }>(
          "select name from campaign_versions where id = $1",
          [input.initialVersionId]
        );
        expect(original.rows[0]?.name).toBe("Campagne SaaS France");
      } finally {
        await client.close();
      }
    },
    TEST_TIMEOUT_MS
  );

  it(
    "returns FORBIDDEN on tenant scope mismatch before reading another tenant's campaign",
    async (ctx) => {
      if (!database) {
        ctx.skip();
        return;
      }
      const client = makeClient(database);
      const campaigns = createCampaignRepository();
      const runner = createPersistenceTransactionRunner(client.db);
      const input = createInput(TENANT_A, `scope_${randomUUID().slice(0, 8)}`);
      try {
        const created = await runner.run({
          access: mintTrustedWorkerAccess(workerScope(TENANT_A)),
          work: (tx) => campaigns.create(input, tx),
        });
        expect(created.ok).toBe(true);

        const mismatched = await runner.run({
          access: mintTrustedWorkerAccess(workerScope(TENANT_A)),
          work: (tx: PersistenceTransaction) =>
            campaigns.get(
              {
                campaignId: input.campaignId,
                tenantId: parseTenantId(TENANT_B),
              },
              tx
            ),
        });
        expect(mismatched.ok).toBe(false);
        if (mismatched.ok) {
          throw new Error("expected tenant scope mismatch");
        }
        expect(mismatched.error).toEqual({
          code: "FORBIDDEN",
          detail: "TENANT_SCOPE_MISMATCH",
          retryable: false,
        });
      } finally {
        await client.close();
      }
    },
    TEST_TIMEOUT_MS
  );

  it(
    "fails closed so tenant B cannot read or pause tenant A's campaign through the repository",
    async (ctx) => {
      if (!database) {
        ctx.skip();
        return;
      }
      const target = database;
      const appClient = makeClient(
        target,
        runtimeRoleUrl(
          target,
          RUNTIME_DATABASE_ROLES.app,
          ISOLATION_ROLE_PASSWORDS.app
        )
      );
      const campaigns = createCampaignRepository();
      const runner = createPersistenceTransactionRunner(appClient.db);
      const input = createInput(TENANT_A, `iso_${randomUUID().slice(0, 8)}`);
      try {
        const accessA = await establishMemberAccess(target, TENANT_A, USER_A);
        const accessB = await establishMemberAccess(target, TENANT_B, USER_B);

        const created = await runner.run({
          access: accessA,
          work: (tx) => campaigns.create(input, tx),
        });
        expect(created.ok).toBe(true);

        const hidden = await runner.run({
          access: accessB,
          work: (tx) =>
            campaigns.get(
              {
                campaignId: input.campaignId,
                tenantId: parseTenantId(TENANT_B),
              },
              tx
            ),
        });
        expect(hidden.ok).toBe(true);
        if (!hidden.ok) {
          throw new Error("expected empty get for the other tenant");
        }
        expect(hidden.value.campaign).toBeNull();

        const paused = await runner.run({
          access: accessB,
          work: (tx) =>
            campaigns.pause(
              {
                campaignId: input.campaignId,
                expectedCurrent: { expected: emptyCurrentVersionSetFixture },
                pausedAt: PAUSED_AT,
                tenantId: parseTenantId(TENANT_B),
              },
              tx
            ),
        });
        expect(paused.ok).toBe(false);
        if (paused.ok) {
          throw new Error(
            "expected pause of another tenant's campaign to fail"
          );
        }
        expect(paused.error.code).toBe("NOT_FOUND");

        const listed = await runner.run({
          access: accessB,
          work: (tx) =>
            campaigns.list(
              { includeCompleted: true, tenantId: parseTenantId(TENANT_B) },
              tx
            ),
        });
        expect(listed.ok).toBe(true);
        if (!listed.ok) {
          throw new Error("expected list success");
        }
        expect(
          listed.value.campaigns.some(
            (campaign) => campaign.campaignId === input.campaignId
          )
        ).toBe(false);
      } finally {
        await appClient.close();
      }
    },
    TEST_TIMEOUT_MS
  );
});
