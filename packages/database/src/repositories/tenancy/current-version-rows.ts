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
import {
  styleProfiles,
  styleProfileVersions,
} from "../../schema/styles";
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
  const db = resolveTransactionExecutor(tx);
  const selectedCampaignPointers = campaignId
    ? await rowsWithOptionalLock(
        db
          .select({ activeVersionId: campaigns.activeVersionId })
          .from(campaigns)
          .where(
            and(
              eq(campaigns.tenantId, tenantId),
              eq(campaigns.id, campaignId)
            )
          )
          .limit(1),
        lock
      )
    : [];
  const selectedCampaignPointer = selectedCampaignPointers[0] ?? null;
  if (campaignId && !selectedCampaignPointer) {
    throw new TenancyMappingError("selected campaign is unavailable");
  }
  const stylePointers = await rowsWithOptionalLock(
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
  const stylePointer = stylePointers[0] ?? null;

  const campaignRows =
    campaignId !== null && selectedCampaignPointer?.activeVersionId
      ? await db
          .select()
          .from(campaignVersions)
          .where(
            and(
              eq(campaignVersions.tenantId, tenantId),
              eq(campaignVersions.campaignId, campaignId),
              eq(campaignVersions.id, selectedCampaignPointer.activeVersionId)
            )
          )
          .limit(1)
      : [];
  const campaign = campaignRows[0] ?? null;

  const [explicitStyle] = stylePointer?.explicitVersionId
    ? await db
        .select()
        .from(styleProfileVersions)
        .where(
          and(
            eq(styleProfileVersions.tenantId, tenantId),
            eq(styleProfileVersions.id, stylePointer.explicitVersionId)
          )
        )
        .limit(1)
    : [];
  const [acceptedInferredStyle] = stylePointer?.acceptedInferredVersionId
    ? await db
        .select()
        .from(styleProfileVersions)
        .where(
          and(
            eq(styleProfileVersions.tenantId, tenantId),
            eq(
              styleProfileVersions.id,
              stylePointer.acceptedInferredVersionId
            )
          )
        )
        .limit(1)
    : [];
  if (stylePointer?.explicitVersionId && !explicitStyle) {
    throw new TenancyMappingError("current explicit style version is unavailable");
  }
  if (stylePointer?.acceptedInferredVersionId && !acceptedInferredStyle) {
    throw new TenancyMappingError(
      "current accepted inferred style version is unavailable"
    );
  }
  if (selectedCampaignPointer?.activeVersionId && !campaign) {
    throw new TenancyMappingError("current campaign version is unavailable");
  }
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
