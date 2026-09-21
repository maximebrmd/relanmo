import { parseUtcTimestamp } from "@relanmo/domain/contracts";
import type { CampaignId } from "@relanmo/domain/contracts";
import type {
  PersistenceTransaction,
  ProfileRepository,
  SaveProfileRevisionInput,
} from "@relanmo/domain/ports/persistence";
import { and, eq } from "drizzle-orm";

import { campaigns } from "../../schema/campaigns";
import { freelancerProfiles, tenants } from "../../schema/tenancy";
import { resolveTransactionExecutor } from "../../transactions/registry";
import type {
  CampaignScopedCurrentVersionRepository,
  CampaignScopedProfileRepository,
  TenancyVersionSources,
} from "./contracts";
import {
  catchMappingError,
  currentVersionsEqual,
  currentVersionsWithProfile,
  dateFromUtc,
  mapProfileVersion,
} from "./mapping";
import { loadCurrentVersions } from "./current-version-rows";
import { memberPrincipalOrForbidden, tenantScopeMismatch } from "./scope";

async function observedVersions(
  tx: PersistenceTransaction,
  campaignId: Parameters<typeof loadCurrentVersions>[2],
  sources: TenancyVersionSources,
  lock: boolean
) {
  return loadCurrentVersions(
    tx,
    tx.scope.tenantId,
    campaignId,
    sources.defaultPromptVersion(),
    lock
  );
}

async function writeProfileRevision(
  input: SaveProfileRevisionInput,
  tx: PersistenceTransaction,
  campaignId: CampaignId | null,
  sources: TenancyVersionSources,
  mode: "INITIALIZE" | "REVISE"
): ReturnType<ProfileRepository["saveRevision"]> {
  const mismatch = tenantScopeMismatch(input.tenantId, tx);
  if (mismatch) {
    return mismatch;
  }
  const member = memberPrincipalOrForbidden(tx);
  if ("ok" in member) {
    return member;
  }
  if (input.createdBy !== member.userId) {
    return {
      error: {
        code: "FORBIDDEN",
        detail: "profile revisions must be authored by the active member",
        retryable: false,
      },
      ok: false,
    };
  }

  try {
    const db = resolveTransactionExecutor(tx);
    const [tenant] = await db
      .select({ id: tenants.id })
      .from(tenants)
      .where(eq(tenants.id, tx.scope.tenantId))
      .limit(1)
      .for("update");
    if (!tenant) {
      return {
        error: {
          code: "NOT_FOUND",
          detail: "tenant",
          retryable: false,
        },
        ok: false,
      };
    }

    if (mode === "INITIALIZE") {
      const [campaign] = await db
        .select({ id: campaigns.id })
        .from(campaigns)
        .where(eq(campaigns.tenantId, tx.scope.tenantId))
        .limit(1);
      if (campaign) {
        return {
          error: {
            code: "VALIDATION",
            detail: "profile initialization requires a tenant without campaigns",
            retryable: false,
          },
          ok: false,
        };
      }
    }

    const observed = await observedVersions(tx, campaignId, sources, true);
    const currentProfile = observed.profile;
    const actual = observed.current;
    if (
      (mode === "INITIALIZE" && currentProfile !== null) ||
      !currentVersionsEqual(input.expectedCurrent.expected, actual)
    ) {
      return {
        ok: true,
        value: {
          actual,
          expected: input.expectedCurrent.expected,
          outcome: "REVISION_CONFLICT",
        },
      };
    }

    if (currentProfile) {
      await db
        .update(freelancerProfiles)
        .set({ isCurrent: false })
        .where(
          and(
            eq(freelancerProfiles.tenantId, tx.scope.tenantId),
            eq(freelancerProfiles.id, currentProfile.version.id)
          )
        );
    }

    const [inserted] = await db
      .insert(freelancerProfiles)
      .values({
        availability: input.facts.availability,
        createdAt: dateFromUtc(input.createdAt),
        createdBy: input.createdBy,
        dayRateCents: input.facts.dayRateCents,
        exclusions: [...input.facts.exclusions],
        geography: [...input.facts.geography],
        id: input.profileVersionId,
        isCurrent: true,
        offer: input.facts.offer,
        preferredFrenchTone: input.facts.preferredFrenchTone,
        revision: (currentProfile?.version.revision ?? 0) + 1,
        skills: [...input.facts.skills],
        targetMarket: input.facts.targetMarket,
        tenantId: tx.scope.tenantId,
        writingSamples: [...input.facts.writingSamples],
      })
      .returning();
    if (!inserted) {
      return {
        error: {
          code: "UNAVAILABLE",
          detail: "profile revision insert returned no row",
          retryable: false,
        },
        ok: false,
      };
    }

    const profile = mapProfileVersion(inserted);
    return {
      ok: true,
      value: {
        outcome: "UPDATED",
        value: {
          current: currentVersionsWithProfile(actual, profile.version),
          profile,
        },
      },
    };
  } catch (error) {
    return catchMappingError(error);
  }
}

export function createProfileRepository(
  sources: TenancyVersionSources
): CampaignScopedProfileRepository {
  return {
    get: async (input, tx) => {
      const mismatch = tenantScopeMismatch(input.tenantId, tx);
      if (mismatch) {
        return mismatch;
      }
      try {
        const observed = await observedVersions(
          tx,
          input.campaignId,
          sources,
          false
        );
        return {
          ok: true,
          value: { current: observed.current, profile: observed.profile },
        };
      } catch (error) {
        return catchMappingError(error);
      }
    },
    initialize: async (input, tx) =>
      writeProfileRevision(input, tx, null, sources, "INITIALIZE"),
    saveRevision: async (input, tx) =>
      writeProfileRevision(input, tx, input.campaignId, sources, "REVISE"),
  };
}

export function createCurrentVersionRepository(
  sources: TenancyVersionSources
): CampaignScopedCurrentVersionRepository {
  return {
    getCurrent: async (input, tx) => {
      const mismatch = tenantScopeMismatch(input.tenantId, tx);
      if (mismatch) {
        return mismatch;
      }
      try {
        const observed = await observedVersions(
          tx,
          input.campaignId,
          sources,
          false
        );
        return {
          ok: true,
          value: {
            observedAt: parseUtcTimestamp(new Date().toISOString()),
            tenantId: tx.scope.tenantId,
            versions: observed.current,
          },
        };
      } catch (error) {
        return catchMappingError(error);
      }
    },
  };
}
