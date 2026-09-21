import type {
  CampaignId,
  CurrentVersionSet,
  ModelVersion,
  PromptVersionRef,
  TenantId,
} from "@relanmo/domain/contracts";
import type { PersistenceTransaction } from "@relanmo/domain/ports/persistence";
import { and, eq } from "drizzle-orm";

import { campaigns, campaignVersions } from "../../schema/campaigns";
import { styleProfiles, styleProfileVersions } from "../../schema/styles";
import { resolveTransactionExecutor } from "../../transactions/registry";
import {
  emptyCurrentVersions,
  mapCampaignVersionRef,
  mapExplicitStyleVersionRef,
  mapInferredStyleVersionRef,
  mapProfileVersion,
  TenancyMappingError,
} from "./mapping";
import { loadCurrentProfile } from "./profile-rows";

async function rowsWithOptionalLock<Row>(
  query: PromiseLike<Row[]> & {
    for: (strength: "update") => PromiseLike<Row[]>;
  },
  lock: boolean
): Promise<Row[]> {
  return lock ? await query.for("update") : await query;
}

async function loadCampaignPointer(
  tx: PersistenceTransaction,
  tenantId: TenantId,
  campaignId: CampaignId | null,
  lock: boolean
) {
  if (!campaignId) {
    return null;
  }
  const db = resolveTransactionExecutor(tx);
  const pointers = await rowsWithOptionalLock(
    db
      .select({ activeVersionId: campaigns.activeVersionId })
      .from(campaigns)
      .where(
        and(eq(campaigns.tenantId, tenantId), eq(campaigns.id, campaignId))
      )
      .limit(1),
    lock
  );
  const pointer = pointers[0] ?? null;
  if (!pointer) {
    throw new TenancyMappingError("selected campaign is unavailable");
  }
  return pointer;
}

async function loadStylePointer(
  tx: PersistenceTransaction,
  tenantId: TenantId,
  lock: boolean
) {
  const db = resolveTransactionExecutor(tx);
  const pointers = await rowsWithOptionalLock(
    db
      .select({
        acceptedInferredVersionId: styleProfiles.acceptedInferredVersionId,
        explicitVersionId: styleProfiles.explicitVersionId,
      })
      .from(styleProfiles)
      .where(eq(styleProfiles.tenantId, tenantId))
      .limit(1),
    lock
  );
  return pointers[0] ?? null;
}

async function loadCampaignVersion(
  tx: PersistenceTransaction,
  tenantId: TenantId,
  campaignId: CampaignId | null,
  activeVersionId: string | null | undefined
) {
  if (!(campaignId && activeVersionId)) {
    return null;
  }
  const db = resolveTransactionExecutor(tx);
  const [campaign] = await db
    .select()
    .from(campaignVersions)
    .where(
      and(
        eq(campaignVersions.tenantId, tenantId),
        eq(campaignVersions.campaignId, campaignId),
        eq(campaignVersions.id, activeVersionId)
      )
    )
    .limit(1);
  if (!campaign) {
    throw new TenancyMappingError("current campaign version is unavailable");
  }
  return campaign;
}

async function loadStyleVersion(
  tx: PersistenceTransaction,
  tenantId: TenantId,
  versionId: string | null | undefined,
  missingDetail: string
) {
  if (!versionId) {
    return null;
  }
  const db = resolveTransactionExecutor(tx);
  const [style] = await db
    .select()
    .from(styleProfileVersions)
    .where(
      and(
        eq(styleProfileVersions.tenantId, tenantId),
        eq(styleProfileVersions.id, versionId)
      )
    )
    .limit(1);
  if (!style) {
    throw new TenancyMappingError(missingDetail);
  }
  return style;
}

export async function loadCurrentVersions(
  tx: PersistenceTransaction,
  tenantId: TenantId,
  campaignId: CampaignId | null,
  defaultPrompt: PromptVersionRef,
  model: ModelVersion,
  lock: boolean
): Promise<{
  current: CurrentVersionSet;
  profile: ReturnType<typeof mapProfileVersion> | null;
}> {
  const selectedCampaignPointer = await loadCampaignPointer(
    tx,
    tenantId,
    campaignId,
    lock
  );
  const stylePointer = await loadStylePointer(tx, tenantId, lock);
  const campaign = await loadCampaignVersion(
    tx,
    tenantId,
    campaignId,
    selectedCampaignPointer?.activeVersionId
  );
  const explicitStyle = await loadStyleVersion(
    tx,
    tenantId,
    stylePointer?.explicitVersionId,
    "current explicit style version is unavailable"
  );
  const acceptedInferredStyle = await loadStyleVersion(
    tx,
    tenantId,
    stylePointer?.acceptedInferredVersionId,
    "current accepted inferred style version is unavailable"
  );
  const profileRow = await loadCurrentProfile(tx, tenantId, lock);
  const profile = profileRow === null ? null : mapProfileVersion(profileRow);
  return {
    current: {
      ...emptyCurrentVersions(),
      acceptedInferredStyle: acceptedInferredStyle
        ? mapInferredStyleVersionRef(acceptedInferredStyle)
        : null,
      campaign: campaign ? mapCampaignVersionRef(campaign) : null,
      defaultPrompt,
      explicitStyle: explicitStyle
        ? mapExplicitStyleVersionRef(explicitStyle)
        : null,
      model,
      profile: profile?.version ?? null,
    },
    profile,
  };
}
