import { randomUUID } from "node:crypto";

import {
  parseCampaignId,
  parseCampaignVersionId,
  parseOutboxEventId,
  parseTenantId,
  parseUserId,
  parseUtcTimestamp,
  workflowIdFor,
} from "@relanmo/domain/contracts";
import type { CampaignTargeting } from "@relanmo/domain/contracts/product";
import type { UtcTimestamp } from "@relanmo/domain/contracts/values";
import type { CampaignVersionRef } from "@relanmo/domain/contracts/versions";
import type {
  ActivateCampaignInput,
  ActivateCampaignResult,
  CampaignDefinition,
  CampaignRecord,
  CampaignRepository,
  CampaignStatus,
  CampaignVersionRecord,
  CreateCampaignInput,
  CreateCampaignResult,
  GetCampaignInput,
  GetCampaignResult,
  ListCampaignsInput,
  ListCampaignsResult,
  PauseCampaignInput,
  PauseCampaignResult,
  PersistenceResult,
  PersistenceTransaction,
  SaveCampaignVersionInput,
  SaveCampaignVersionResult,
} from "@relanmo/domain/ports/persistence";
import { TENANT_SCOPE_MISMATCH_ERROR } from "@relanmo/domain/ports/persistence";
import { and, desc, eq } from "drizzle-orm";

import { campaigns, campaignVersions } from "../../schema/campaigns";
import { outboxEvents } from "../../schema/delivery";
import { resolveTransactionExecutor } from "../../transactions/registry";
import type { TransactionExecutor } from "../../transactions/registry";

export const campaignsRepositorySurface = "node-portable-server" as const;

const EMPTY_TARGETING: CampaignTargeting = {
  companySizes: [],
  geographies: [],
  industries: [],
  jobTitles: [],
  seniority: [],
};

type CampaignRow = typeof campaigns.$inferSelect;
type CampaignVersionRow = typeof campaignVersions.$inferSelect;

function mismatchIfNeeded(
  tenantId: CreateCampaignInput["tenantId"],
  tx: PersistenceTransaction
): PersistenceResult<never> | null {
  if (tenantId !== tx.scope.tenantId) {
    return { error: TENANT_SCOPE_MISMATCH_ERROR, ok: false };
  }
  return null;
}

function asUtcTimestamp(value: Date): UtcTimestamp {
  return parseUtcTimestamp(value.toISOString());
}

function toDate(value: UtcTimestamp): Date {
  return new Date(value);
}

function versionRef(row: CampaignVersionRow): CampaignVersionRef {
  return {
    createdAt: asUtcTimestamp(row.createdAt),
    id: parseCampaignVersionId(row.id),
    kind: "CAMPAIGN",
    revision: row.revision,
  };
}

function toDefinition(row: CampaignVersionRow): CampaignDefinition {
  return {
    businessWindow: row.businessWindow,
    dailyInvitationQuota: row.dailyInvitationQuota,
    dailyMessageQuota: row.dailyMessageQuota,
    exclusions: row.exclusions,
    icpDescription: row.icpDescription,
    name: row.name,
    sequenceClosure: row.sequenceClosure,
    sequencePlan: row.sequence,
  };
}

function toVersionRecord(row: CampaignVersionRow): CampaignVersionRecord {
  return {
    createdAt: asUtcTimestamp(row.createdAt),
    createdBy: parseUserId(row.createdBy),
    definition: toDefinition(row),
    tenantId: parseTenantId(row.tenantId),
    version: versionRef(row),
  };
}

function currentVersionId(row: CampaignRow): string | null {
  return row.draftVersionId ?? row.activeVersionId;
}

function toCampaignRecord(
  row: CampaignRow,
  version: CampaignVersionRow | null
): CampaignRecord {
  return {
    campaignId: parseCampaignId(row.id),
    createdAt: asUtcTimestamp(row.createdAt),
    currentVersion: version === null ? null : toVersionRecord(version),
    status: row.status,
    tenantId: parseTenantId(row.tenantId),
    updatedAt: asUtcTimestamp(row.updatedAt),
  };
}

function refsEqual(
  actual: CampaignVersionRef | null,
  expected: CampaignVersionRef | null
): boolean {
  if (actual === null || expected === null) {
    return actual === expected;
  }
  return (
    actual.id === expected.id &&
    actual.revision === expected.revision &&
    actual.kind === expected.kind &&
    actual.createdAt === expected.createdAt
  );
}

function conflictResult(
  actual: CampaignVersionRef | null,
  expected: SaveCampaignVersionInput["expectedCurrent"]["expected"]
): Extract<SaveCampaignVersionResult, { outcome: "REVISION_CONFLICT" }> {
  return {
    actual: { ...expected, campaign: actual },
    expected,
    outcome: "REVISION_CONFLICT",
  };
}

function versionValues(
  input: {
    campaignId: CreateCampaignInput["campaignId"];
    createdAt: UtcTimestamp;
    createdBy: CreateCampaignInput["createdBy"];
    definition: CampaignDefinition;
    tenantId: CreateCampaignInput["tenantId"];
  },
  versionId: CreateCampaignInput["initialVersionId"],
  revision: number
) {
  return {
    businessWindow: input.definition.businessWindow,
    campaignId: input.campaignId,
    createdAt: toDate(input.createdAt),
    createdBy: input.createdBy,
    dailyInvitationQuota: input.definition.dailyInvitationQuota,
    dailyMessageQuota: input.definition.dailyMessageQuota,
    dailyQuota:
      input.definition.dailyInvitationQuota +
      input.definition.dailyMessageQuota,
    exclusions: [...input.definition.exclusions],
    icpDescription: input.definition.icpDescription,
    id: versionId,
    name: input.definition.name,
    offer: "",
    revision,
    sequence: [...input.definition.sequencePlan],
    sequenceClosure: input.definition.sequenceClosure,
    targeting: EMPTY_TARGETING,
    tenantId: input.tenantId,
  };
}

function coordinatorWorkflowId(
  tenantId: CreateCampaignInput["tenantId"],
  campaignId: CreateCampaignInput["campaignId"]
) {
  return workflowIdFor({
    campaignId,
    kind: "CAMPAIGN_COORDINATOR",
    tenantId,
  });
}

async function loadVersion(
  db: TransactionExecutor,
  versionId: string | null,
  campaignId: string,
  tenantId: string
): Promise<CampaignVersionRow | null> {
  if (versionId === null) {
    return null;
  }
  const rows = await db
    .select()
    .from(campaignVersions)
    .where(
      and(
        eq(campaignVersions.id, versionId),
        eq(campaignVersions.campaignId, campaignId),
        eq(campaignVersions.tenantId, tenantId)
      )
    )
    .limit(1);
  const [row] = rows;
  return row ?? null;
}

async function lockCampaign(
  db: TransactionExecutor,
  campaignId: string,
  tenantId: string
): Promise<CampaignRow | null> {
  const rows = await db
    .select()
    .from(campaigns)
    .where(and(eq(campaigns.id, campaignId), eq(campaigns.tenantId, tenantId)))
    .for("update")
    .limit(1);
  const [row] = rows;
  return row ?? null;
}

async function enqueueOutbox(
  db: TransactionExecutor,
  input: {
    availableAt: UtcTimestamp;
    campaignId: CreateCampaignInput["campaignId"];
    kind: "PAUSE_WORKFLOW" | "START_WORKFLOW";
    revision: number;
    tenantId: CreateCampaignInput["tenantId"];
  }
): Promise<void> {
  const workflowId = coordinatorWorkflowId(input.tenantId, input.campaignId);
  const payload =
    input.kind === "PAUSE_WORKFLOW"
      ? {
          accountId: null,
          reason: "CAMPAIGN_PAUSED",
          targetWorkflowId: workflowId,
          tenantId: input.tenantId,
          type: "PAUSE_WORKFLOW" as const,
        }
      : {
          targetWorkflowId: workflowId,
          tenantId: input.tenantId,
          type: "START_WORKFLOW" as const,
        };
  await db.insert(outboxEvents).values({
    attempt: 0,
    availableAt: input.availableAt,
    createdAt: input.availableAt,
    dedupeKey: `campaign:${input.campaignId}:${input.kind}:${input.revision}`,
    id: parseOutboxEventId(`outbox_${randomUUID()}`),
    kind: input.kind,
    lastError: null,
    payload,
    state: "PENDING",
    tenantId: input.tenantId,
  });
}

async function createCampaign(
  input: CreateCampaignInput,
  tx: PersistenceTransaction
): Promise<PersistenceResult<CreateCampaignResult>> {
  const mismatch = mismatchIfNeeded(input.tenantId, tx);
  if (mismatch) {
    return mismatch;
  }
  const db = resolveTransactionExecutor(tx);
  const existing = await db
    .select()
    .from(campaigns)
    .where(
      and(
        eq(campaigns.id, input.campaignId),
        eq(campaigns.tenantId, input.tenantId)
      )
    )
    .limit(1);
  const [existingRow] = existing;
  if (existingRow) {
    const version = await loadVersion(
      db,
      currentVersionId(existingRow),
      existingRow.id,
      existingRow.tenantId
    );
    return {
      ok: true,
      value: {
        existing: toCampaignRecord(existingRow, version),
        outcome: "ALREADY_EXISTS",
      },
    };
  }

  await db.insert(campaigns).values({
    createdAt: toDate(input.createdAt),
    id: input.campaignId,
    revision: 1,
    status: "DRAFT",
    tenantId: input.tenantId,
    updatedAt: toDate(input.createdAt),
  });
  const [versionRow] = await db
    .insert(campaignVersions)
    .values(versionValues(input, input.initialVersionId, 1))
    .returning();
  if (!versionRow) {
    return {
      error: {
        code: "UNAVAILABLE",
        detail: "campaign version insert returned no row",
        retryable: false,
      },
      ok: false,
    };
  }
  const [campaignRow] = await db
    .update(campaigns)
    .set({
      draftVersionId: versionRow.id,
      updatedAt: toDate(input.createdAt),
    })
    .where(
      and(
        eq(campaigns.id, input.campaignId),
        eq(campaigns.tenantId, input.tenantId)
      )
    )
    .returning();
  if (!campaignRow) {
    return {
      error: {
        code: "UNAVAILABLE",
        detail: "campaign pointer update returned no row",
        retryable: false,
      },
      ok: false,
    };
  }
  return {
    ok: true,
    value: {
      campaign: toCampaignRecord(campaignRow, versionRow),
      outcome: "CREATED",
    },
  };
}

async function getCampaign(
  input: GetCampaignInput,
  tx: PersistenceTransaction
): Promise<PersistenceResult<GetCampaignResult>> {
  const mismatch = mismatchIfNeeded(input.tenantId, tx);
  if (mismatch) {
    return mismatch;
  }
  const db = resolveTransactionExecutor(tx);
  const rows = await db
    .select()
    .from(campaigns)
    .where(
      and(
        eq(campaigns.id, input.campaignId),
        eq(campaigns.tenantId, input.tenantId)
      )
    )
    .limit(1);
  const [row] = rows;
  if (!row) {
    return { ok: true, value: { campaign: null } };
  }
  const version = await loadVersion(
    db,
    currentVersionId(row),
    row.id,
    row.tenantId
  );
  return { ok: true, value: { campaign: toCampaignRecord(row, version) } };
}

async function listCampaigns(
  input: ListCampaignsInput,
  tx: PersistenceTransaction
): Promise<PersistenceResult<ListCampaignsResult>> {
  const mismatch = mismatchIfNeeded(input.tenantId, tx);
  if (mismatch) {
    return mismatch;
  }
  const db = resolveTransactionExecutor(tx);
  const rows = await db
    .select()
    .from(campaigns)
    .where(eq(campaigns.tenantId, input.tenantId))
    .orderBy(desc(campaigns.updatedAt), campaigns.id);
  const filtered = input.includeCompleted
    ? rows
    : rows.filter((row) => row.status !== "COMPLETED");
  const records = await Promise.all(
    filtered.map(async (row) => {
      const version = await loadVersion(
        db,
        currentVersionId(row),
        row.id,
        row.tenantId
      );
      return toCampaignRecord(row, version);
    })
  );
  return { ok: true, value: { campaigns: records } };
}

async function saveCampaignVersion(
  input: SaveCampaignVersionInput,
  tx: PersistenceTransaction
): Promise<PersistenceResult<SaveCampaignVersionResult>> {
  const mismatch = mismatchIfNeeded(input.tenantId, tx);
  if (mismatch) {
    return mismatch;
  }
  const db = resolveTransactionExecutor(tx);
  const locked = await lockCampaign(db, input.campaignId, input.tenantId);
  if (!locked) {
    return {
      error: {
        code: "NOT_FOUND",
        detail: "campaign not found",
        retryable: false,
      },
      ok: false,
    };
  }
  const current = await loadVersion(
    db,
    currentVersionId(locked),
    locked.id,
    locked.tenantId
  );
  const actualRef = current === null ? null : versionRef(current);
  if (!refsEqual(actualRef, input.expectedCurrent.expected.campaign)) {
    return {
      ok: true,
      value: conflictResult(actualRef, input.expectedCurrent.expected),
    };
  }
  const nextRevision = (current?.revision ?? 0) + 1;
  const [versionRow] = await db
    .insert(campaignVersions)
    .values(
      versionValues(
        {
          campaignId: input.campaignId,
          createdAt: input.createdAt,
          createdBy: input.createdBy,
          definition: input.definition,
          tenantId: input.tenantId,
        },
        input.versionId,
        nextRevision
      )
    )
    .returning();
  if (!versionRow) {
    return {
      error: {
        code: "UNAVAILABLE",
        detail: "campaign version insert returned no row",
        retryable: false,
      },
      ok: false,
    };
  }
  const [campaignRow] = await db
    .update(campaigns)
    .set({
      draftVersionId: versionRow.id,
      revision: locked.revision + 1,
      updatedAt: toDate(input.createdAt),
    })
    .where(
      and(eq(campaigns.id, locked.id), eq(campaigns.tenantId, locked.tenantId))
    )
    .returning();
  if (!campaignRow) {
    return {
      error: {
        code: "UNAVAILABLE",
        detail: "campaign draft pointer update returned no row",
        retryable: false,
      },
      ok: false,
    };
  }
  const campaign = toCampaignRecord(campaignRow, versionRow);
  const version = toVersionRecord(versionRow);
  return {
    ok: true,
    value: {
      outcome: "UPDATED",
      value: {
        campaign,
        current: {
          ...input.expectedCurrent.expected,
          campaign: version.version,
        },
        version,
      },
    },
  };
}

async function activateCampaign(
  input: ActivateCampaignInput,
  tx: PersistenceTransaction
): Promise<PersistenceResult<ActivateCampaignResult>> {
  const mismatch = mismatchIfNeeded(input.tenantId, tx);
  if (mismatch) {
    return mismatch;
  }
  const db = resolveTransactionExecutor(tx);
  const locked = await lockCampaign(db, input.campaignId, input.tenantId);
  if (!locked) {
    return {
      error: {
        code: "NOT_FOUND",
        detail: "campaign not found",
        retryable: false,
      },
      ok: false,
    };
  }
  if (locked.status === "COMPLETED") {
    return {
      error: {
        code: "VALIDATION",
        detail: "completed campaigns cannot be activated",
        retryable: false,
      },
      ok: false,
    };
  }
  const current = await loadVersion(
    db,
    currentVersionId(locked),
    locked.id,
    locked.tenantId
  );
  const actualRef = current === null ? null : versionRef(current);
  if (!refsEqual(actualRef, input.expectedCurrent.expected.campaign)) {
    return {
      ok: true,
      value: conflictResult(actualRef, input.expectedCurrent.expected),
    };
  }
  const target = await loadVersion(
    db,
    input.versionId,
    locked.id,
    locked.tenantId
  );
  if (!target) {
    return {
      error: {
        code: "NOT_FOUND",
        detail: "campaign version not found",
        retryable: false,
      },
      ok: false,
    };
  }
  const alreadyActive =
    locked.status === "ACTIVE" &&
    locked.activeVersionId === input.versionId &&
    !locked.outboundPaused;
  if (alreadyActive) {
    const campaign = toCampaignRecord(locked, current);
    return {
      ok: true,
      value: {
        outcome: "UPDATED",
        value: {
          campaign,
          current: {
            ...input.expectedCurrent.expected,
            campaign: campaign.currentVersion?.version ?? actualRef,
          },
        },
      },
    };
  }
  const nextRevision = locked.revision + 1;
  const [campaignRow] = await db
    .update(campaigns)
    .set({
      activatedAt: locked.activatedAt ?? toDate(input.requestedAt),
      activeVersionId: input.versionId,
      outboundPaused: false,
      pauseReason: null,
      pausedAt: null,
      revision: nextRevision,
      status: "ACTIVE" satisfies CampaignStatus,
      updatedAt: toDate(input.requestedAt),
    })
    .where(
      and(eq(campaigns.id, locked.id), eq(campaigns.tenantId, locked.tenantId))
    )
    .returning();
  if (!campaignRow) {
    return {
      error: {
        code: "UNAVAILABLE",
        detail: "campaign activation update returned no row",
        retryable: false,
      },
      ok: false,
    };
  }
  await enqueueOutbox(db, {
    availableAt: input.requestedAt,
    campaignId: input.campaignId,
    kind: "START_WORKFLOW",
    revision: nextRevision,
    tenantId: input.tenantId,
  });
  const currentAfter = await loadVersion(
    db,
    currentVersionId(campaignRow),
    campaignRow.id,
    campaignRow.tenantId
  );
  const campaign = toCampaignRecord(campaignRow, currentAfter);
  return {
    ok: true,
    value: {
      outcome: "UPDATED",
      value: {
        campaign,
        current: {
          ...input.expectedCurrent.expected,
          campaign: campaign.currentVersion?.version ?? versionRef(target),
        },
      },
    },
  };
}

async function pauseCampaign(
  input: PauseCampaignInput,
  tx: PersistenceTransaction
): Promise<PersistenceResult<PauseCampaignResult>> {
  const mismatch = mismatchIfNeeded(input.tenantId, tx);
  if (mismatch) {
    return mismatch;
  }
  const db = resolveTransactionExecutor(tx);
  const locked = await lockCampaign(db, input.campaignId, input.tenantId);
  if (!locked) {
    return {
      error: {
        code: "NOT_FOUND",
        detail: "campaign not found",
        retryable: false,
      },
      ok: false,
    };
  }
  const current = await loadVersion(
    db,
    currentVersionId(locked),
    locked.id,
    locked.tenantId
  );
  const actualRef = current === null ? null : versionRef(current);
  if (!refsEqual(actualRef, input.expectedCurrent.expected.campaign)) {
    return {
      ok: true,
      value: conflictResult(actualRef, input.expectedCurrent.expected),
    };
  }
  if (locked.status === "PAUSED" && locked.outboundPaused) {
    const campaign = toCampaignRecord(locked, current);
    return {
      ok: true,
      value: {
        outcome: "UPDATED",
        value: {
          campaign,
          current: {
            ...input.expectedCurrent.expected,
            campaign: campaign.currentVersion?.version ?? actualRef,
          },
        },
      },
    };
  }
  const nextRevision = locked.revision + 1;
  const [campaignRow] = await db
    .update(campaigns)
    .set({
      outboundPaused: true,
      pauseReason: "CAMPAIGN_PAUSED",
      pausedAt: toDate(input.pausedAt),
      revision: nextRevision,
      status: "PAUSED" satisfies CampaignStatus,
      updatedAt: toDate(input.pausedAt),
    })
    .where(
      and(eq(campaigns.id, locked.id), eq(campaigns.tenantId, locked.tenantId))
    )
    .returning();
  if (!campaignRow) {
    return {
      error: {
        code: "UNAVAILABLE",
        detail: "campaign pause update returned no row",
        retryable: false,
      },
      ok: false,
    };
  }
  await enqueueOutbox(db, {
    availableAt: input.pausedAt,
    campaignId: input.campaignId,
    kind: "PAUSE_WORKFLOW",
    revision: nextRevision,
    tenantId: input.tenantId,
  });
  const campaign = toCampaignRecord(campaignRow, current);
  return {
    ok: true,
    value: {
      outcome: "UPDATED",
      value: {
        campaign,
        current: {
          ...input.expectedCurrent.expected,
          campaign: campaign.currentVersion?.version ?? actualRef,
        },
      },
    },
  };
}

export function createCampaignRepository(): CampaignRepository {
  return {
    activate: activateCampaign,
    create: createCampaign,
    get: getCampaign,
    list: listCampaigns,
    pause: pauseCampaign,
    saveVersion: saveCampaignVersion,
  };
}
