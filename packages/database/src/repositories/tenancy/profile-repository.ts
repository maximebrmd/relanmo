import { parseUtcTimestamp } from "@relanmo/domain/contracts";
import type {
  CurrentVersionRepository,
  PersistenceTransaction,
  ProfileRepository,
} from "@relanmo/domain/ports/persistence";
import { and, eq } from "drizzle-orm";

import { freelancerProfiles, tenants } from "../../schema/tenancy";
import { resolveTransactionExecutor } from "../../transactions/registry";
import {
  catchMappingError,
  currentVersionsEqual,
  currentVersionsWithProfile,
  dateFromUtc,
  mapProfileVersion,
} from "./mapping";
import { loadCurrentProfile } from "./profile-rows";
import { memberPrincipalOrForbidden, tenantScopeMismatch } from "./scope";

async function observedVersions(tx: PersistenceTransaction, lock: boolean) {
  const row = await loadCurrentProfile(tx, tx.scope.tenantId, lock);
  const profile = row === null ? null : mapProfileVersion(row);
  return {
    current: currentVersionsWithProfile(profile?.version ?? null),
    profile,
  };
}

export function createProfileRepository(): ProfileRepository {
  return {
    get: async (input, tx) => {
      const mismatch = tenantScopeMismatch(input.tenantId, tx);
      if (mismatch) {
        return mismatch;
      }
      try {
        const observed = await observedVersions(tx, false);
        return {
          ok: true,
          value: { current: observed.current, profile: observed.profile },
        };
      } catch (error) {
        return catchMappingError(error);
      }
    },
    saveRevision: async (input, tx) => {
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

        const currentRow = await loadCurrentProfile(
          tx,
          tx.scope.tenantId,
          true
        );
        const currentProfile =
          currentRow === null ? null : mapProfileVersion(currentRow);
        const actual = currentVersionsWithProfile(
          currentProfile?.version ?? null
        );
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

        if (currentRow) {
          await db
            .update(freelancerProfiles)
            .set({ isCurrent: false })
            .where(
              and(
                eq(freelancerProfiles.tenantId, tx.scope.tenantId),
                eq(freelancerProfiles.id, currentRow.id)
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
            revision: (currentRow?.revision ?? 0) + 1,
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
              current: currentVersionsWithProfile(profile.version),
              profile,
            },
          },
        };
      } catch (error) {
        return catchMappingError(error);
      }
    },
  };
}

export function createCurrentVersionRepository(): CurrentVersionRepository {
  return {
    getCurrent: async (input, tx) => {
      const mismatch = tenantScopeMismatch(input.tenantId, tx);
      if (mismatch) {
        return mismatch;
      }
      try {
        const observed = await observedVersions(tx, false);
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
