import {
  parseEvidenceId,
  parseProspectId,
  parseUtcTimestamp,
} from "@relanmo/domain/contracts";
import type {
  Evidence,
  EvidenceId,
  ProspectId,
  TenantId,
} from "@relanmo/domain/contracts";
import type {
  PersistenceResult,
  PersistenceTransaction,
  ProspectProfileSnapshot,
  UpsertProspectInput,
} from "@relanmo/domain/ports/persistence";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { withClient } from "../../../tests/isolation/support";
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
  createProspectStoreHarness,
  shutdownProspectStoreTests,
  workerAccess,
} from "./test-support";
import type { ProspectStoreHarness } from "./test-support";

const observedAt = parseUtcTimestamp("2026-09-21T09:00:00.000Z");
const laterAt = parseUtcTimestamp("2026-09-21T10:00:00.000Z");

const evidence = createEvidenceRepository();
const prospects = createProspectRepository();
const suppression = createSuppressionRepository();

let harness: ProspectStoreHarness | null = null;

beforeAll(async () => {
  harness = await createProspectStoreHarness("p025-prospects");
}, SETUP_TIMEOUT_MS);

afterAll(async () => {
  await harness?.close();
  await shutdownProspectStoreTests();
});

function profile(
  overrides: Partial<ProspectProfileSnapshot> = {}
): ProspectProfileSnapshot {
  return {
    company: "Nordwave",
    displayName: "Camille Durand",
    headline: "Talent Acquisition Partner",
    location: "Paris",
    profileUrl: "https://www.linkedin.com/in/camille-durand-42",
    ...overrides,
  };
}

function upsertInput(
  prospectId: ProspectId,
  overrides: Partial<UpsertProspectInput> = {}
): UpsertProspectInput {
  return {
    accountId: ACCOUNT_A,
    observedAt,
    profile: profile(),
    prospectId,
    providerProfileId: "urn:li:member:camille",
    tenantId: TENANT_A,
    ...overrides,
  };
}

function evidenceInput(
  prospectId: ProspectId,
  evidenceId: EvidenceId,
  overrides: Partial<Evidence> = {}
): Evidence {
  return {
    accountId: ACCOUNT_A,
    assertions: [],
    capturedAt: observedAt,
    contentHash: "sha256:claim-1",
    evidenceId,
    normalizedClaim: "Talent Acquisition Partner chez Nordwave",
    prospectId,
    provenance: "PROVIDER_PROFILE",
    sourceId: "linkedin.profile.headline",
    sourceUrl: "https://www.linkedin.com/in/camille-durand-42",
    tenantId: TENANT_A,
    ...overrides,
  };
}

async function runWorker<Value>(
  tenantId: TenantId,
  work: (tx: PersistenceTransaction) => Promise<PersistenceResult<Value>>
): Promise<PersistenceResult<Value>> {
  if (!harness) {
    throw new Error("prospect store harness was not initialized");
  }
  return await harness.workerRunner.run({
    access: workerAccess(tenantId),
    work,
  });
}

describe("prospect candidate, evidence and suppression persistence", () => {
  it(
    "upserts a candidate and keeps a repeated discovery from creating a second eligible row",
    async (ctx) => {
      if (!harness) {
        ctx.skip();
        return;
      }

      const firstId = parseProspectId("prospect-camille-first");
      const rediscoveryId = parseProspectId("prospect-camille-rediscovery");

      const result = await runWorker(TENANT_A, async (tx) => {
        const created = await prospects.upsert(upsertInput(firstId), tx);
        if (!created.ok) {
          return created;
        }
        const fact = await evidence.upsert(
          {
            evidence: evidenceInput(
              firstId,
              parseEvidenceId("evidence-camille-headline")
            ),
          },
          tx
        );
        if (!fact.ok) {
          return fact;
        }
        const rediscovered = await prospects.upsert(
          upsertInput(rediscoveryId, {
            observedAt: laterAt,
            profile: profile({
              headline: "Talent Acquisition Partner @ Nordwave SaaS",
              profileUrl: "https://m.linkedin.com/in/Camille-Durand-42/",
            }),
          }),
          tx
        );
        if (!rediscovered.ok) {
          return rediscovered;
        }
        const stored = await prospects.get(
          { accountId: ACCOUNT_A, prospectId: firstId, tenantId: TENANT_A },
          tx
        );
        if (!stored.ok) {
          return stored;
        }
        const listed = await prospects.list(
          {
            accountId: ACCOUNT_A,
            cursor: null,
            includeArchived: false,
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
            created: created.value,
            listed: listed.value,
            rediscovered: rediscovered.value,
            stored: stored.value,
          },
        };
      });

      expect(result.ok).toBe(true);
      if (!result.ok) {
        return;
      }
      expect(result.value.created.outcome).toBe("CREATED");
      expect(result.value.rediscovered).toMatchObject({
        outcome: "UPDATED",
        prospect: { prospectId: firstId },
      });
      if (result.value.rediscovered.outcome !== "UPDATED") {
        return;
      }
      expect(result.value.rediscovered.prospect.profile.headline).toBe(
        "Talent Acquisition Partner @ Nordwave SaaS"
      );
      expect(result.value.stored.prospect?.evidenceIds).toEqual([
        "evidence-camille-headline",
      ]);
      expect(
        result.value.listed.prospects.filter(
          (row) => row.providerProfileId === "urn:li:member:camille"
        )
      ).toHaveLength(1);
    },
    TEST_TIMEOUT_MS
  );

  it(
    "returns an explicit unresolved collision when the same public identifier disagrees on provider member IDs",
    async (ctx) => {
      if (!harness) {
        ctx.skip();
        return;
      }

      const existingId = parseProspectId("prospect-alias-existing");
      const collidingId = parseProspectId("prospect-alias-colliding");

      const result = await runWorker(TENANT_A, async (tx) => {
        const created = await prospects.upsert(
          upsertInput(existingId, {
            profile: profile({
              displayName: "Alex Martin",
              profileUrl: "https://www.linkedin.com/in/shared-slug",
            }),
            prospectId: existingId,
            providerProfileId: "urn:li:member:alex-1",
          }),
          tx
        );
        if (!created.ok) {
          return created;
        }
        return prospects.upsert(
          upsertInput(collidingId, {
            profile: profile({
              displayName: "Alex Martin",
              profileUrl: "https://linkedin.com/in/SHARED-SLUG",
            }),
            prospectId: collidingId,
            providerProfileId: "urn:li:member:alex-2",
          }),
          tx
        );
      });

      expect(result.ok).toBe(true);
      if (!result.ok) {
        return;
      }
      expect(result.value).toEqual({
        conflictingProspectId: existingId,
        outcome: "IDENTITY_COLLISION",
      });
    },
    TEST_TIMEOUT_MS
  );

  it(
    "dedupes qualification evidence and keeps suppression durable across rediscovery",
    async (ctx) => {
      if (!harness) {
        ctx.skip();
        return;
      }

      const prospectId = parseProspectId("prospect-suppressed-camille");
      const evidenceId = parseEvidenceId("evidence-suppressed-headline");

      const result = await runWorker(TENANT_A, async (tx) => {
        const created = await prospects.upsert(
          upsertInput(prospectId, {
            profile: profile({
              displayName: "Personne exclue",
              profileUrl: "https://www.linkedin.com/in/personne-exclue",
            }),
            providerProfileId: "urn:li:member:suppressed",
          }),
          tx
        );
        if (!created.ok) {
          return created;
        }
        const firstFact = await evidence.upsert(
          { evidence: evidenceInput(prospectId, evidenceId) },
          tx
        );
        if (!firstFact.ok) {
          return firstFact;
        }
        const secondFact = await evidence.upsert(
          {
            evidence: evidenceInput(
              prospectId,
              parseEvidenceId("evidence-dup"),
              {
                sourceId: "linkedin.profile.headline",
                normalizedClaim: "Talent Acquisition Partner chez Nordwave",
              }
            ),
          },
          tx
        );
        if (!secondFact.ok) {
          return secondFact;
        }
        const added = await suppression.add(
          {
            accountId: ACCOUNT_A,
            prospectId,
            reason: "DO_NOT_CONTACT",
            recordedAt: laterAt,
            tenantId: TENANT_A,
          },
          tx
        );
        if (!added.ok) {
          return added;
        }
        const again = await suppression.add(
          {
            accountId: ACCOUNT_A,
            prospectId,
            reason: "CUSTOMER_REQUEST",
            recordedAt: laterAt,
            tenantId: TENANT_A,
          },
          tx
        );
        if (!again.ok) {
          return again;
        }
        const listed = await prospects.list(
          {
            accountId: ACCOUNT_A,
            cursor: null,
            includeArchived: false,
            limit: 50,
            tenantId: TENANT_A,
          },
          tx
        );
        if (!listed.ok) {
          return listed;
        }
        const storedSuppression = await suppression.get(
          { accountId: ACCOUNT_A, prospectId, tenantId: TENANT_A },
          tx
        );
        if (!storedSuppression.ok) {
          return storedSuppression;
        }
        return {
          ok: true as const,
          value: {
            again: again.value,
            firstFact: firstFact.value,
            listedIds: listed.value.prospects.map((row) => row.prospectId),
            secondFact: secondFact.value,
            storedSuppression: storedSuppression.value,
          },
        };
      });

      expect(result.ok).toBe(true);
      if (!result.ok) {
        return;
      }
      expect(result.value.firstFact.outcome).toBe("CREATED");
      expect(result.value.secondFact.outcome).toBe("ALREADY_EXISTS");
      if (result.value.secondFact.outcome !== "ALREADY_EXISTS") {
        return;
      }
      expect(result.value.secondFact.evidence.evidenceId).toBe(evidenceId);
      expect(result.value.again.outcome).toBe("ALREADY_PRESENT");
      expect(result.value.storedSuppression.suppression).toMatchObject({
        prospectId,
        reason: "DO_NOT_CONTACT",
        tenantId: TENANT_A,
      });
      expect(result.value.listedIds).not.toContain(prospectId);
    },
    TEST_TIMEOUT_MS
  );

  it(
    "keeps a human-owned pair out of discovery candidate pages and paginates the rest",
    async (ctx) => {
      if (!harness) {
        ctx.skip();
        return;
      }

      const humanOwnedId = parseProspectId("prospect-human-owned");
      const firstPageId = parseProspectId("prospect-page-1");
      const secondPageId = parseProspectId("prospect-page-2");

      const seeded = await runWorker(TENANT_A, async (tx) => {
        const owned = await prospects.upsert(
          upsertInput(humanOwnedId, {
            observedAt,
            profile: profile({
              displayName: "human-owned",
              profileUrl: "https://www.linkedin.com/in/human-owned",
            }),
            providerProfileId: "urn:li:member:human",
          }),
          tx
        );
        if (!owned.ok) {
          return owned;
        }
        const page1 = await prospects.upsert(
          upsertInput(firstPageId, {
            observedAt,
            profile: profile({
              displayName: "page-one",
              profileUrl: "https://www.linkedin.com/in/page-one",
            }),
            providerProfileId: "urn:li:member:page-1",
          }),
          tx
        );
        if (!page1.ok) {
          return page1;
        }
        const page2 = await prospects.upsert(
          upsertInput(secondPageId, {
            observedAt: laterAt,
            profile: profile({
              displayName: "page-two",
              profileUrl: "https://www.linkedin.com/in/page-two",
            }),
            providerProfileId: "urn:li:member:page-2",
          }),
          tx
        );
        if (!page2.ok) {
          return page2;
        }
        return { ok: true as const, value: null };
      });
      expect(seeded.ok).toBe(true);

      await withClient(harness.database.migrationUrl, (client) =>
        client.query(
          `insert into conversations
             (id, tenant_id, account_id, prospect_id, status,
              ownership_kind, ownership_reason, ownership_recorded_at)
           values
             ('conversation-human-owned', $1, $2, $3, 'ACTIVE',
              'HUMAN_OWNED', 'INCOMING_MESSAGE', $4)`,
          [TENANT_A, ACCOUNT_A, humanOwnedId, new Date(laterAt)]
        )
      );

      const result = await runWorker(TENANT_A, async (tx) => {
        const listed = await prospects.list(
          {
            accountId: ACCOUNT_A,
            cursor: null,
            includeArchived: false,
            limit: 50,
            tenantId: TENANT_A,
          },
          tx
        );
        if (!listed.ok) {
          return listed;
        }
        const firstPage = await prospects.list(
          {
            accountId: ACCOUNT_A,
            cursor: null,
            includeArchived: false,
            limit: 1,
            tenantId: TENANT_A,
          },
          tx
        );
        if (!firstPage.ok) {
          return firstPage;
        }
        const secondPageInput = {
          accountId: ACCOUNT_A,
          cursor: firstPage.value.nextCursor,
          includeArchived: false,
          limit: 1,
          tenantId: TENANT_A,
        };
        const secondPage = await prospects.list(secondPageInput, tx);
        if (!secondPage.ok) {
          return secondPage;
        }
        return {
          ok: true as const,
          value: {
            firstIds: firstPage.value.prospects.map((row) => row.prospectId),
            listedIds: listed.value.prospects.map((row) => row.prospectId),
            nextCursor: firstPage.value.nextCursor,
            secondIds: secondPage.value.prospects.map((row) => row.prospectId),
          },
        };
      });

      expect(result.ok).toBe(true);
      if (!result.ok) {
        return;
      }
      expect(result.value.listedIds).not.toContain(humanOwnedId);
      expect(result.value.listedIds).toEqual(
        expect.arrayContaining([firstPageId, secondPageId])
      );
      expect(result.value.nextCursor).not.toBeNull();
      expect(result.value.firstIds).toHaveLength(1);
      expect(result.value.secondIds).toHaveLength(1);
      expect(result.value.firstIds[0]).not.toBe(result.value.secondIds[0]);
    },
    TEST_TIMEOUT_MS
  );

  it(
    "rejects a tenant-scope mismatch before reading or writing",
    async (ctx) => {
      if (!harness) {
        ctx.skip();
        return;
      }

      const result = await runWorker(TENANT_A, (tx) =>
        prospects.upsert(
          upsertInput(parseProspectId("prospect-forged"), {
            accountId: ACCOUNT_B,
            tenantId: TENANT_B,
          }),
          tx
        )
      );

      expect(result).toEqual({
        error: {
          code: "FORBIDDEN",
          detail: "TENANT_SCOPE_MISMATCH",
          retryable: false,
        },
        ok: false,
      });
    },
    TEST_TIMEOUT_MS
  );
});
