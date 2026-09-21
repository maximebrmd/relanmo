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
  parseCampaignVersionId,
  parseEvidenceId,
  parseExplicitStyleVersionId,
  parseInferredStyleVersionId,
  parseModelVersion,
  parsePromptVersionId,
  parseTenantId,
  parseUserId,
  parseUtcTimestamp,
} from "@relanmo/domain/contracts";
import type {
  CurrentVersionSet,
  DraftSourceVersions,
} from "@relanmo/domain/contracts";
import type {
  ExplicitStyleSettings,
  PersistenceResult,
  PersistenceTransaction,
  PersistenceWorkerId,
  StyleRepository,
  TenantTransactionScope,
} from "@relanmo/domain/ports/persistence";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  dropRuntimeRoleLogins,
  ISOLATION_ROLE_PASSWORDS,
  provisionRuntimeRoleLogins,
  runtimeRoleUrl,
  seedIsolationFixtures,
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
import { createStyleRepository } from "./index";

const SETUP_TIMEOUT_MS = 60_000;
const TEST_TIMEOUT_MS = 30_000;
const CREATED_AT = parseUtcTimestamp("2026-09-17T10:00:00.000Z");

const EXPLICIT_SETTINGS: ExplicitStyleSettings = {
  closing: "Cordialement",
  examples: ["Bonjour, je vous contacte au sujet de votre recrutement."],
  forbiddenPhrases: ["j'espère que vous allez bien"],
  formality: "FORMAL",
  greeting: "Bonjour",
  maxCharacters: 280,
  tone: "DIRECT",
};

let database: IsolatedTestDatabase | null = null;
let appClient: ReturnType<typeof createDatabaseRuntimeClient> | null = null;
const styles: StyleRepository = createStyleRepository();

beforeAll(async () => {
  database = await createIsolatedTestDatabase("p024-styles");
  if (!database) {
    return;
  }
  await applyDatabaseMigrations({ migrationUrl: database.migrationUrl });
  await provisionRuntimeRoleLogins(database);
  await seedIsolationFixtures(database);
  await withClient(database.migrationUrl, async (client) => {
    await client.query(
      `insert into actions
         (id, tenant_id, account_id, prospect_id, campaign_id,
          campaign_version_id, step, payload, evidence_ids, source_versions,
          created_at, state, state_at, unknown_reason)
       values
         ('action-a-inflight', $1, 'provider-account-a', 'prospect-a', 'campaign-a',
          'campaign-version-a', 'DM1',
          '{"kind":"DIRECT_MESSAGE","step":"DM1","text":"Bonjour"}',
          '[]', '{}', now(), 'IN_FLIGHT', now(), null),
         ('action-a-unknown', $1, 'provider-account-a', 'prospect-a', 'campaign-a',
          'campaign-version-a', 'DM2',
          '{"kind":"DIRECT_MESSAGE","step":"DM2","text":"Bonjour"}',
          '[]', '{}', now(), 'UNKNOWN', now(), 'TIMEOUT'),
         ('action-a-confirmed', $1, 'provider-account-a', 'prospect-a', 'campaign-a',
          'campaign-version-a', 'DM3',
          '{"kind":"DIRECT_MESSAGE","step":"DM3","text":"Bonjour"}',
          '[]', '{}', now(), 'CONFIRMED', now(), null)`,
      [TENANT_A]
    );
  });
  const env: DatabaseEnv = {
    migrationUrl: database.migrationUrl,
    poolConnectionTimeoutMs: 5000,
    poolIdleTimeoutMs: 10_000,
    poolMax: 2,
    runtimeUrl: runtimeRoleUrl(
      database,
      RUNTIME_DATABASE_ROLES.app,
      ISOLATION_ROLE_PASSWORDS.app
    ),
  };
  appClient = createDatabaseRuntimeClient(env);
}, SETUP_TIMEOUT_MS);

afterAll(async () => {
  try {
    await appClient?.close();
    if (database) {
      await dropRuntimeRoleLogins(database);
    }
  } finally {
    await database?.drop();
    await stopLocalPostgresAdmin();
  }
});

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
      workerId: "style-worker" as PersistenceWorkerId,
    },
    requestId: null,
    tenantId: parseTenantId(tenant),
  };
}

async function establishMemberAccess(tenant: string, userId: string) {
  if (!database) {
    throw new Error("test database is not available");
  }
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
  const authClient = createDatabaseRuntimeClient(authEnv);
  try {
    return await mintTrustedTenantAccess(
      authClient.pool,
      memberScope(tenant, userId)
    );
  } finally {
    await authClient.close();
  }
}

async function runAsMember<Value>(
  tenant: string,
  userId: string,
  work: (tx: PersistenceTransaction) => Promise<PersistenceResult<Value>>
): Promise<PersistenceResult<Value>> {
  if (!appClient) {
    throw new Error("app client is not available");
  }
  const access = await establishMemberAccess(tenant, userId);
  return createPersistenceTransactionRunner(appClient.db).run({
    access,
    work,
  });
}

function expectOk<Value>(result: PersistenceResult<Value>): Value {
  expect(result.ok).toBe(true);
  if (!result.ok) {
    throw new Error(`expected ok result, got ${result.error.detail}`);
  }
  return result.value;
}

async function readActionSnapshot(actionId: string): Promise<{
  id: string;
  state: string;
  sourceVersions: DraftSourceVersions | Record<string, never>;
}> {
  if (!database) {
    throw new Error("test database is not available");
  }
  return await withClient(database.migrationUrl, async (client) => {
    const result = await client.query<{
      id: string;
      source_versions: DraftSourceVersions | Record<string, never>;
      state: string;
    }>("select id, state, source_versions from actions where id = $1", [
      actionId,
    ]);
    const [row] = result.rows;
    if (!row) {
      throw new Error(`action ${actionId} is missing`);
    }
    return {
      id: row.id,
      sourceVersions: row.source_versions,
      state: row.state,
    };
  });
}

describe("style and prompt version persistence (live local Postgres)", () => {
  it(
    "starts from code defaults, versions explicit style, and fail-closes tenant scope",
    async (ctx) => {
      if (!database || !appClient) {
        ctx.skip();
        return;
      }
      const tenantId = parseTenantId(TENANT_A);
      const empty = expectOk(
        await runAsMember(TENANT_A, USER_A, (tx) =>
          styles.get({ tenantId }, tx)
        )
      );
      expect(empty.explicit).toBeNull();
      expect(empty.acceptedInferred).toBeNull();
      expect(empty.overrides).toEqual([]);
      expect(empty.current.explicitStyle).toBeNull();
      expect(empty.current.acceptedInferredStyle).toBeNull();

      const mismatched = await runAsMember(TENANT_A, USER_A, (tx) =>
        styles.get({ tenantId: parseTenantId(TENANT_B) }, tx)
      );
      expect(mismatched).toEqual({
        error: {
          code: "FORBIDDEN",
          detail: "TENANT_SCOPE_MISMATCH",
          retryable: false,
        },
        ok: false,
      });

      const saved = expectOk(
        await runAsMember(TENANT_A, USER_A, (tx) =>
          styles.saveExplicit(
            {
              createdAt: CREATED_AT,
              createdBy: parseUserId(USER_A),
              expectedCurrent: { expected: empty.current },
              settings: EXPLICIT_SETTINGS,
              tenantId,
              versionId: parseExplicitStyleVersionId("style-explicit-1"),
            },
            tx
          )
        )
      );
      expect(saved.outcome).toBe("UPDATED");
      if (saved.outcome !== "UPDATED") {
        throw new Error("expected explicit style to be created");
      }
      expect(saved.value.style.settings).toMatchObject({
        closing: "Cordialement",
        formality: "FORMAL",
        greeting: "Bonjour",
        tone: "DIRECT",
      });
      expect(saved.value.style.version.id).toBe("style-explicit-1");
      expect(saved.value.current.explicitStyle?.id).toBe("style-explicit-1");

      const stale = expectOk(
        await runAsMember(TENANT_A, USER_A, (tx) =>
          styles.saveExplicit(
            {
              createdAt: CREATED_AT,
              createdBy: parseUserId(USER_A),
              expectedCurrent: { expected: empty.current },
              settings: { ...EXPLICIT_SETTINGS, greeting: "Salut" },
              tenantId,
              versionId: parseExplicitStyleVersionId("style-explicit-stale"),
            },
            tx
          )
        )
      );
      expect(stale.outcome).toBe("REVISION_CONFLICT");

      const otherTenant = expectOk(
        await runAsMember(TENANT_B, USER_B, (tx) =>
          styles.get({ tenantId: parseTenantId(TENANT_B) }, tx)
        )
      );
      expect(otherTenant.explicit).toBeNull();
      expect(otherTenant.current.explicitStyle).toBeNull();
    },
    TEST_TIMEOUT_MS
  );

  it(
    "versions inferred suggestions, accepts them, and stores campaign override resets",
    async (ctx) => {
      if (!database || !appClient) {
        ctx.skip();
        return;
      }
      const tenantId = parseTenantId(TENANT_A);
      const before = expectOk(
        await runAsMember(TENANT_A, USER_A, (tx) =>
          styles.get({ tenantId }, tx)
        )
      );
      const inferredId = parseInferredStyleVersionId("style-inferred-1");
      const created = expectOk(
        await runAsMember(TENANT_A, USER_A, (tx) =>
          styles.saveInferred(
            {
              createdAt: CREATED_AT,
              model: parseModelVersion("claude-sonnet-test"),
              settings: {
                confidence: 0.8,
                formality: "NEUTRAL",
                tone: "CONCISE",
              },
              sourceEvidenceIds: [parseEvidenceId("evidence-style-1")],
              tenantId,
              versionId: inferredId,
            },
            tx
          )
        )
      );
      expect(created.outcome).toBe("CREATED");
      const duplicate = expectOk(
        await runAsMember(TENANT_A, USER_A, (tx) =>
          styles.saveInferred(
            {
              createdAt: CREATED_AT,
              model: parseModelVersion("claude-sonnet-test"),
              settings: {
                confidence: 0.1,
                formality: "CASUAL",
                tone: "WARM",
              },
              sourceEvidenceIds: [parseEvidenceId("evidence-style-1")],
              tenantId,
              versionId: inferredId,
            },
            tx
          )
        )
      );
      expect(duplicate.outcome).toBe("ALREADY_EXISTS");

      const afterSuggestion = expectOk(
        await runAsMember(TENANT_A, USER_A, (tx) =>
          styles.get({ tenantId }, tx)
        )
      );
      expect(afterSuggestion.acceptedInferred).toBeNull();
      expect(afterSuggestion.explicit?.version.id).toBe(
        before.explicit?.version.id
      );

      const accepted = expectOk(
        await runAsMember(TENANT_A, USER_A, (tx) =>
          styles.acceptInferred(
            {
              expectedCurrent: { expected: afterSuggestion.current },
              tenantId,
              versionId: inferredId,
            },
            tx
          )
        )
      );
      expect(accepted.outcome).toBe("UPDATED");
      if (accepted.outcome !== "UPDATED") {
        throw new Error("expected inferred style to be accepted");
      }
      expect(accepted.value.style.version.id).toBe(inferredId);
      expect(accepted.value.current.acceptedInferredStyle?.id).toBe(inferredId);

      const hidden = await runAsMember(TENANT_B, USER_B, (tx) =>
        styles.acceptInferred(
          {
            expectedCurrent: { expected: accepted.value.current },
            tenantId: parseTenantId(TENANT_B),
            versionId: inferredId,
          },
          tx
        )
      );
      expect(hidden.ok).toBe(false);
      if (hidden.ok) {
        throw new Error("cross-tenant inferred accept must fail closed");
      }
      expect(hidden.error.code).toBe("NOT_FOUND");

      const current = expectOk(
        await runAsMember(TENANT_A, USER_A, (tx) =>
          styles.get({ tenantId }, tx)
        )
      );
      const override = expectOk(
        await runAsMember(TENANT_A, USER_A, (tx) =>
          styles.saveOverride(
            {
              campaignId: parseCampaignId("campaign-a"),
              createdAt: CREATED_AT,
              createdBy: parseUserId(USER_A),
              expectedCurrent: { expected: current.current },
              settings: { greeting: "Bonjour à tous", tone: "WARM" },
              tenantId,
              versionId: parseExplicitStyleVersionId("style-override-1"),
            },
            tx
          )
        )
      );
      expect(override.outcome).toBe("UPDATED");
      if (override.outcome !== "UPDATED") {
        throw new Error("expected campaign override to be saved");
      }
      expect(override.value.override.settings).toEqual({
        greeting: "Bonjour à tous",
        tone: "WARM",
      });

      const afterOverride = expectOk(
        await runAsMember(TENANT_A, USER_A, (tx) =>
          styles.get({ tenantId }, tx)
        )
      );
      const reset = expectOk(
        await runAsMember(TENANT_A, USER_A, (tx) =>
          styles.saveOverride(
            {
              campaignId: parseCampaignId("campaign-a"),
              createdAt: CREATED_AT,
              createdBy: parseUserId(USER_A),
              expectedCurrent: { expected: afterOverride.current },
              settings: {},
              tenantId,
              versionId: parseExplicitStyleVersionId("style-override-reset"),
            },
            tx
          )
        )
      );
      expect(reset.outcome).toBe("UPDATED");
      if (reset.outcome !== "UPDATED") {
        throw new Error("expected campaign override reset");
      }
      expect(reset.value.override.settings).toEqual({});
      const listed = expectOk(
        await runAsMember(TENANT_A, USER_A, (tx) =>
          styles.get({ tenantId }, tx)
        )
      );
      expect(listed.overrides).toHaveLength(1);
      expect(listed.overrides[0]?.settings).toEqual({});
    },
    TEST_TIMEOUT_MS
  );

  it(
    "keeps READY drafts stale via the version guard and leaves in-flight history untouched",
    async (ctx) => {
      if (!database || !appClient) {
        ctx.skip();
        return;
      }
      const tenantId = parseTenantId(TENANT_A);
      const before = expectOk(
        await runAsMember(TENANT_A, USER_A, (tx) =>
          styles.get({ tenantId }, tx)
        )
      );
      const previousExplicit = before.current.explicitStyle;
      if (!previousExplicit) {
        throw new Error(
          "expected an explicit style version before regeneration"
        );
      }
      const snapshot: DraftSourceVersions = {
        acceptedInferredStyle: before.current.acceptedInferredStyle,
        campaign: {
          createdAt: CREATED_AT,
          id: parseCampaignVersionId("campaign-version-a"),
          kind: "CAMPAIGN",
          revision: 1,
        },
        defaultPrompt: {
          createdAt: CREATED_AT,
          id: parsePromptVersionId("prompt-default-1"),
          kind: "PROMPT_DEFAULT",
          revision: 1,
        },
        explicitStyle: previousExplicit,
        model: parseModelVersion("claude-sonnet-test"),
        profile: null,
      };
      await withClient(database.migrationUrl, async (client) => {
        await client.query(
          "update actions set source_versions = $1::jsonb where tenant_id = $2",
          [JSON.stringify(snapshot), TENANT_A]
        );
      });

      const next = expectOk(
        await runAsMember(TENANT_A, USER_A, (tx) =>
          styles.saveExplicit(
            {
              createdAt: CREATED_AT,
              createdBy: parseUserId(USER_A),
              expectedCurrent: { expected: before.current },
              settings: { ...EXPLICIT_SETTINGS, greeting: "Bonjour à nouveau" },
              tenantId,
              versionId: parseExplicitStyleVersionId("style-explicit-2"),
            },
            tx
          )
        )
      );
      expect(next.outcome).toBe("UPDATED");
      if (next.outcome !== "UPDATED") {
        throw new Error("expected a new explicit style version");
      }
      const { current } = next.value;
      expect(current.explicitStyle?.id).toBe("style-explicit-2");
      expect(current.explicitStyle?.id).not.toBe(previousExplicit?.id);

      const ready = await readActionSnapshot("action-a");
      expect(ready.state).toBe("READY");
      expect(ready.id).toBe("action-a");
      expect(ready.sourceVersions).toMatchObject({
        explicitStyle: previousExplicit,
      });
      if (!("explicitStyle" in ready.sourceVersions)) {
        throw new Error("READY action is missing source versions");
      }
      expect(ready.sourceVersions.explicitStyle?.id).not.toBe(
        current.explicitStyle?.id
      );

      const inflight = await readActionSnapshot("action-a-inflight");
      const unknown = await readActionSnapshot("action-a-unknown");
      const confirmed = await readActionSnapshot("action-a-confirmed");
      expect(inflight.state).toBe("IN_FLIGHT");
      expect(unknown.state).toBe("UNKNOWN");
      expect(confirmed.state).toBe("CONFIRMED");
      expect(inflight.sourceVersions).toMatchObject({
        explicitStyle: previousExplicit,
      });
      expect(unknown.sourceVersions).toMatchObject({
        explicitStyle: previousExplicit,
      });
      expect(confirmed.sourceVersions).toMatchObject({
        explicitStyle: previousExplicit,
      });
    },
    TEST_TIMEOUT_MS
  );

  it(
    "resolves a racing style save with the shared current-version guard",
    async (ctx) => {
      if (!database || !appClient) {
        ctx.skip();
        return;
      }
      const tenantId = parseTenantId(TENANT_A);
      const before = expectOk(
        await runAsMember(TENANT_A, USER_A, (tx) =>
          styles.get({ tenantId }, tx)
        )
      );
      const expected: CurrentVersionSet = before.current;
      const access = await establishMemberAccess(TENANT_A, USER_A);
      const runner = createPersistenceTransactionRunner(appClient.db);
      const results = await Promise.all([
        runner.run({
          access,
          work: (tx) =>
            styles.saveExplicit(
              {
                createdAt: CREATED_AT,
                createdBy: parseUserId(USER_A),
                expectedCurrent: { expected },
                settings: { ...EXPLICIT_SETTINGS, greeting: "Course A" },
                tenantId,
                versionId: parseExplicitStyleVersionId("style-race-a"),
              },
              tx
            ),
        }),
        runner.run({
          access,
          work: (tx) =>
            styles.saveExplicit(
              {
                createdAt: CREATED_AT,
                createdBy: parseUserId(USER_A),
                expectedCurrent: { expected },
                settings: { ...EXPLICIT_SETTINGS, greeting: "Course B" },
                tenantId,
                versionId: parseExplicitStyleVersionId("style-race-b"),
              },
              tx
            ),
        }),
      ]);
      const values = results.map((result) => expectOk(result));
      const updated = values.filter((value) => value.outcome === "UPDATED");
      const conflicts = values.filter(
        (value) => value.outcome === "REVISION_CONFLICT"
      );
      expect(updated).toHaveLength(1);
      expect(conflicts).toHaveLength(1);
    },
    TEST_TIMEOUT_MS
  );

  it(
    "does not let a worker accept or replace customer style",
    async (ctx) => {
      if (!database || !appClient) {
        ctx.skip();
        return;
      }
      const workerEnv: DatabaseEnv = {
        migrationUrl: database.migrationUrl,
        poolConnectionTimeoutMs: 5000,
        poolIdleTimeoutMs: 10_000,
        poolMax: 1,
        runtimeUrl: runtimeRoleUrl(
          database,
          RUNTIME_DATABASE_ROLES.worker,
          ISOLATION_ROLE_PASSWORDS.worker
        ),
      };
      const workerClient = createDatabaseRuntimeClient(workerEnv);
      try {
        const tenantId = parseTenantId(TENANT_A);
        const current = expectOk(
          await runAsMember(TENANT_A, USER_A, (tx) =>
            styles.get({ tenantId }, tx)
          )
        );
        const result = await createPersistenceTransactionRunner(
          workerClient.db
        ).run({
          access: mintTrustedWorkerAccess(workerScope(TENANT_A)),
          work: (tx) =>
            styles.saveExplicit(
              {
                createdAt: CREATED_AT,
                createdBy: parseUserId(USER_A),
                expectedCurrent: { expected: current.current },
                settings: EXPLICIT_SETTINGS,
                tenantId,
                versionId: parseExplicitStyleVersionId("style-worker-blocked"),
              },
              tx
            ),
        });
        expect(result.ok).toBe(false);
      } finally {
        await workerClient.close();
      }
    },
    TEST_TIMEOUT_MS
  );
});
