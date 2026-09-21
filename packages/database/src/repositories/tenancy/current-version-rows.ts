import type {
  CurrentVersionSet,
  TenantId,
} from "@relanmo/domain/contracts";
import type { PersistenceTransaction } from "@relanmo/domain/ports/persistence";
import { and, asc, eq, isNotNull } from "drizzle-orm";

import { campaigns, campaignVersions } from "../../schema/campaigns";
import {
  promptOverrides,
  promptOverrideVersions,
  styleProfiles,
  styleProfileVersions,
} from "../../schema/styles";
import { resolveTransactionExecutor } from "../../transactions/registry";
import {
  emptyCurrentVersions,
  mapCampaignVersionRef,
  mapExplicitStyleVersionRef,
  mapInferredStyleVersionRef,
  mapModelVersion,
  mapProfileVersion,
  mapPromptVersionRef,
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

function singleCurrent<Row>(rows: readonly Row[], label: string): Row | null {
  if (rows.length > 1) {
    throw new TenancyMappingError(
      `current version snapshot cannot represent multiple ${label}`
    );
  }
  return rows[0] ?? null;
}

export async function loadCurrentVersions(
  tx: PersistenceTransaction,
  tenantId: TenantId,
  lock: boolean
): Promise<{
  current: CurrentVersionSet;
  profile: ReturnType<typeof mapProfileVersion> | null;
}> {
  const db = resolveTransactionExecutor(tx);
  const campaignPointers = await rowsWithOptionalLock(
    db
      .select({ id: campaigns.activeVersionId })
      .from(campaigns)
      .where(
        and(
          eq(campaigns.tenantId, tenantId),
          isNotNull(campaigns.activeVersionId)
        )
      )
      .orderBy(asc(campaigns.id))
      .limit(2),
    lock
  );
  const campaignPointer = singleCurrent(campaignPointers, "campaigns");

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

  const promptPointers = await rowsWithOptionalLock(
    db
      .select({ id: promptOverrides.activeVersionId })
      .from(promptOverrides)
      .where(
        and(
          eq(promptOverrides.tenantId, tenantId),
          isNotNull(promptOverrides.activeVersionId)
        )
      )
      .orderBy(asc(promptOverrides.id))
      .limit(2),
    lock
  );
  const promptPointer = singleCurrent(promptPointers, "prompt overrides");

  const [campaign] = campaignPointer?.id
    ? await db
        .select()
        .from(campaignVersions)
        .where(
          and(
            eq(campaignVersions.tenantId, tenantId),
            eq(campaignVersions.id, campaignPointer.id)
          )
        )
        .limit(1)
    : [];
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
  const [defaultPrompt] = promptPointer?.id
    ? await db
        .select()
        .from(promptOverrideVersions)
        .where(
          and(
            eq(promptOverrideVersions.tenantId, tenantId),
            eq(promptOverrideVersions.id, promptPointer.id)
          )
        )
        .limit(1)
    : [];

  if (campaignPointer?.id && !campaign) {
    throw new TenancyMappingError("current campaign version is unavailable");
  }
  if (stylePointer?.explicitVersionId && !explicitStyle) {
    throw new TenancyMappingError("current explicit style version is unavailable");
  }
  if (stylePointer?.acceptedInferredVersionId && !acceptedInferredStyle) {
    throw new TenancyMappingError(
      "current accepted inferred style version is unavailable"
    );
  }
  if (promptPointer?.id && !defaultPrompt) {
    throw new TenancyMappingError("current prompt version is unavailable");
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
      defaultPrompt: defaultPrompt ? mapPromptVersionRef(defaultPrompt) : null,
      explicitStyle: explicitStyle
        ? mapExplicitStyleVersionRef(explicitStyle)
        : null,
      model: acceptedInferredStyle
        ? mapModelVersion(acceptedInferredStyle.model)
        : null,
      profile: profile?.version ?? null,
    },
    profile,
  };
}
