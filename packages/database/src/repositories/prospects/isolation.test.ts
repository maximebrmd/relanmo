import {
  parseEvidenceId,
  parseProspectId,
  parseUtcTimestamp,
} from "@relanmo/domain/contracts";
import type { PersistenceResult } from "@relanmo/domain/ports/persistence";
import { TENANT_SCOPE_MISMATCH_ERROR } from "@relanmo/domain/ports/persistence";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  createEvidenceRepository,
  createProspectRepository,
  createSuppressionRepository,
} from "./index";
import {
  ACCOUNT_A,
  ACCOUNT_B,
  SETUP_TIMEOUT_MS,
  TENANT_A,
  TENANT_B,
  TEST_TIMEOUT_MS,
  USER_A,
  createDatabaseRuntimeClient,
  createPersistenceTransactionRunner,
  createProspectStoreHarness,
  memberAccessInput,
  mintTrustedTenantAccess,
  shutdownProspectStoreTests,
  workerAccess,
} from "./test-support";
import type { ProspectStoreHarness } from "./test-support";

const observedAt = parseUtcTimestamp("2026-09-21T09:30:00.000Z");
const evidence = createEvidenceRepository();
const prospects = createProspectRepository();
const suppression = createSuppressionRepository();

let harness: ProspectStoreHarness | null = null;

beforeAll(async () => {
  harness = await createProspectStoreHarness("p025-isolation");
}, SETUP_TIMEOUT_MS);

afterAll(async () => {
  await harness?.close();
  await shutdownProspectStoreTests();
});

describe("prospect persistence tenant isolation", () => {
  it(
    "hides another tenant's candidate, evidence and suppression even when IDs are guessed",
    async (ctx) => {
      if (!harness) {
        ctx.skip();
        return;
      }

      const prospectA = parseProspectId("isolation-prospect-a");
      const prospectB = parseProspectId("isolation-prospect-b");
      const evidenceB = parseEvidenceId("isolation-evidence-b");

      const seededB = await harness.workerRunner.run({
        access: workerAccess(TENANT_B),
        work: async (tx) => {
          const created = await prospects.upsert(
            {
              accountId: ACCOUNT_B,
              observedAt,
              profile: {
                company: "Tenant B",
                displayName: "Secret Prospect",
                headline: "Hidden",
                location: null,
                profileUrl: "https://www.linkedin.com/in/secret-prospect",
              },
              prospectId: prospectB,
              providerProfileId: "urn:li:member:secret",
              tenantId: TENANT_B,
            },
            tx
          );
          if (!created.ok) {
            return created;
          }
          const fact = await evidence.upsert(
            {
              evidence: {
                accountId: ACCOUNT_B,
                capturedAt: observedAt,
                contentHash: null,
                evidenceId: evidenceB,
                normalizedClaim: "fait secret tenant B",
                prospectId: prospectB,
                provenance: "PROVIDER_PROFILE",
                sourceId: "linkedin.profile",
                sourceUrl: "https://www.linkedin.com/in/secret-prospect",
                tenantId: TENANT_B,
              },
            },
            tx
          );
          if (!fact.ok) {
            return fact;
          }
          return suppression.add(
            {
              accountId: ACCOUNT_B,
              prospectId: prospectB,
              reason: "POLICY_REVIEW",
              recordedAt: observedAt,
              tenantId: TENANT_B,
            },
            tx
          );
        },
      });
      expect(seededB.ok).toBe(true);

      const fromA = await harness.workerRunner.run({
        access: workerAccess(TENANT_A),
        work: async (tx) => {
          const created = await prospects.upsert(
            {
              accountId: ACCOUNT_A,
              observedAt,
              profile: {
                company: "Tenant A",
                displayName: "Visible Prospect",
                headline: "Visible",
                location: null,
                profileUrl: "https://www.linkedin.com/in/visible-prospect",
              },
              prospectId: prospectA,
              providerProfileId: "urn:li:member:visible",
              tenantId: TENANT_A,
            },
            tx
          );
          if (!created.ok) {
            return created;
          }
          const guessed = await prospects.get(
            {
              accountId: ACCOUNT_B,
              prospectId: prospectB,
              tenantId: TENANT_A,
            },
            tx
          );
          if (!guessed.ok) {
            return guessed;
          }
          const listed = await prospects.list(
            {
              accountId: ACCOUNT_A,
              cursor: null,
              includeArchived: true,
              limit: 50,
              tenantId: TENANT_A,
            },
            tx
          );
          if (!listed.ok) {
            return listed;
          }
          const guessedEvidence = await evidence.get(
            { evidenceId: evidenceB, tenantId: TENANT_A },
            tx
          );
          if (!guessedEvidence.ok) {
            return guessedEvidence;
          }
          const guessedSuppression = await suppression.get(
            {
              accountId: ACCOUNT_B,
              prospectId: prospectB,
              tenantId: TENANT_A,
            },
            tx
          );
          if (!guessedSuppression.ok) {
            return guessedSuppression;
          }
          const forgedWrite: PersistenceResult<{
            guessed: typeof guessed.value;
            guessedEvidence: typeof guessedEvidence.value;
            guessedSuppression: typeof guessedSuppression.value;
            listedIds: readonly string[];
            mismatch: PersistenceResult<unknown>;
          }> = {
            ok: true,
            value: {
              guessed: guessed.value,
              guessedEvidence: guessedEvidence.value,
              guessedSuppression: guessedSuppression.value,
              listedIds: listed.value.prospects.map((row) => row.prospectId),
              mismatch: await prospects.upsert(
                {
                  accountId: ACCOUNT_B,
                  observedAt,
                  profile: {
                    company: null,
                    displayName: "Forged",
                    headline: null,
                    location: null,
                    profileUrl: null,
                  },
                  prospectId: parseProspectId("isolation-forged"),
                  providerProfileId: "urn:li:member:forged",
                  tenantId: TENANT_B,
                },
                tx
              ),
            },
          };
          return forgedWrite;
        },
      });

      expect(fromA.ok).toBe(true);
      if (!fromA.ok) {
        return;
      }
      expect(fromA.value.guessed.prospect).toBeNull();
      expect(fromA.value.guessedEvidence.evidence).toBeNull();
      expect(fromA.value.guessedSuppression.suppression).toBeNull();
      expect(fromA.value.listedIds).toEqual([prospectA]);
      expect(fromA.value.listedIds).not.toContain(prospectB);
      expect(fromA.value.mismatch).toEqual({
        error: TENANT_SCOPE_MISMATCH_ERROR,
        ok: false,
      });
    },
    TEST_TIMEOUT_MS
  );

  it(
    "fails closed on an app-role member connection: tenant A cannot load tenant B",
    async (ctx) => {
      if (!harness) {
        ctx.skip();
        return;
      }

      const prospectB = parseProspectId("isolation-prospect-b");
      const authClient = createDatabaseRuntimeClient(harness.authEnv);
      try {
        const access = await mintTrustedTenantAccess(
          authClient.pool,
          memberAccessInput(TENANT_A, USER_A)
        );
        const runner = createPersistenceTransactionRunner(harness.appClient.db);
        const result = await runner.run({
          access,
          work: async (tx) => {
            const guessed = await prospects.get(
              {
                accountId: ACCOUNT_B,
                prospectId: prospectB,
                tenantId: TENANT_A,
              },
              tx
            );
            if (!guessed.ok) {
              return guessed;
            }
            const listed = await prospects.list(
              {
                accountId: ACCOUNT_B,
                cursor: null,
                includeArchived: true,
                limit: 20,
                tenantId: TENANT_A,
              },
              tx
            );
            if (!listed.ok) {
              return listed;
            }
            return {
              ok: true as const,
              value: {
                guessed: guessed.value.prospect,
                listedIds: listed.value.prospects.map((row) => row.prospectId),
              },
            };
          },
        });
        expect(result.ok).toBe(true);
        if (!result.ok) {
          return;
        }
        expect(result.value.guessed).toBeNull();
        expect(result.value.listedIds).toEqual([]);
      } finally {
        await authClient.close();
      }
    },
    TEST_TIMEOUT_MS
  );
});
