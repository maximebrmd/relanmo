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
  SaveOnboardingProfileRevisionInput,
  TenancyVersionSources,
} from "./contracts";
import {
  catchMappingError,
  currentVersionsEqual,
  currentVersionsWithProfile,
  dateFromUtc,
  mapProfileVersion,
  versionRefEqual,
} from "./mapping";
import { loadCurrentVersions } from "./current-version-rows";
import { loadCurrentProfile } from "./profile-rows";
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
    sources.writingModelVersion(),
    lock
  );
}

async function writeProfileRevision(
  input: SaveProfileRevisionInput,
  tx: PersistenceTransaction,
  campaignId: CampaignId,
  sources: TenancyVersionSources
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

    const observed = await observedVersions(tx, campaignId, sources, true);
    const currentProfile = observed.profile;
    const actual = observed.current;
    if (!currentVersionsEqual(input.expectedCurrent.expected, actual)) {
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

async function loadOnboardingState(
  input: { tenantId: SaveOnboardingProfileRevisionInput["tenantId"] },
  tx: PersistenceTransaction
) {
  const mismatch = tenantScopeMismatch(input.tenantId, tx);
  if (mismatch) {
    return mismatch;
  }
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
        code: "NOT_FOUND" as const,
        detail: "tenant",
        retryable: false as const,
      },
      ok: false as const,
    };
  }
  const [campaign] = await db
    .select({ id: campaigns.id })
    .from(campaigns)
    .where(eq(campaigns.tenantId, tx.scope.tenantId))
    .limit(1);
  if (campaign) {
    return {
      error: {
        code: "VALIDATION" as const,
        detail: "profile onboarding requires a tenant without campaigns",
        retryable: false as const,
      },
      ok: false as const,
    };
  }
  const row = await loadCurrentProfile(tx, tx.scope.tenantId, true);
  const profile = row ? mapProfileVersion(row) : null;
  return {
    ok: true as const,
    value: { profile, version: profile?.version ?? null },
  };
}

async function saveOnboardingProfileRevision(
  input: SaveOnboardingProfileRevisionInput,
  tx: PersistenceTransaction
) {
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
        code: "FORBIDDEN" as const,
        detail: "profile revisions must be authored by the active member",
        retryable: false as const,
      },
      ok: false as const,
    };
  }
  try {
    const state = await loadOnboardingState(input, tx);
    if (!state.ok) {
      return state;
    }
    if (!versionRefEqual(input.expectedProfile, state.value.version)) {
      return {
        ok: true as const,
        value: {
          actual: state.value.version,
          expected: input.expectedProfile,
          outcome: "REVISION_CONFLICT" as const,
        },
      };
    }
    const db = resolveTransactionExecutor(tx);
    if (state.value.profile) {
      await db
        .update(freelancerProfiles)
        .set({ isCurrent: false })
        .where(
          and(
            eq(freelancerProfiles.tenantId, tx.scope.tenantId),
            eq(freelancerProfiles.id, state.value.profile.version.id)
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
        revision: (state.value.version?.revision ?? 0) + 1,
        skills: [...input.facts.skills],
        targetMarket: input.facts.targetMarket,
        tenantId: tx.scope.tenantId,
        writingSamples: [...input.facts.writingSamples],
      })
      .returning();
    if (!inserted) {
      return {
        error: {
          code: "UNAVAILABLE" as const,
          detail: "profile revision insert returned no row",
          retryable: false as const,
        },
        ok: false as const,
      };
    }
    const profile = mapProfileVersion(inserted);
    return {
      ok: true as const,
      value: {
        outcome: "UPDATED" as const,
        value: { profile, version: profile.version },
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
    getForOnboarding: async (input, tx) => {
      try {
        return await loadOnboardingState(input, tx);
      } catch (error) {
        return catchMappingError(error);
      }
    },
    saveRevision: async (input, tx) =>
      writeProfileRevision(input, tx, input.campaignId, sources),
    saveForOnboarding: saveOnboardingProfileRevision,
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
