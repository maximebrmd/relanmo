import type { ProspectIdentitySignals } from "./signals";

export const IDENTITY_MATCH_OUTCOMES = [
  "SAME",
  "DIFFERENT",
  "AMBIGUOUS",
] as const;
export type IdentityMatchOutcome = (typeof IDENTITY_MATCH_OUTCOMES)[number];

export const IDENTITY_MATCH_REASON_CODES = [
  "CROSS_TENANT",
  "CROSS_ACCOUNT",
  "PROVIDER_MEMBER_ID_MATCH",
  "PROVIDER_MEMBER_ID_CONFLICT",
  "PUBLIC_IDENTIFIER_MATCH",
  "LEGACY_ID_MATCH",
  "NO_SHARED_IDENTIFIER",
] as const;
export type IdentityMatchReasonCode =
  (typeof IDENTITY_MATCH_REASON_CODES)[number];

export type IdentityMatchResult = Readonly<{
  outcome: IdentityMatchOutcome;
  reason: IdentityMatchReasonCode;
}>;

function hasLegacyOverlap(
  a: ProspectIdentitySignals,
  b: ProspectIdentitySignals
): boolean {
  return (
    (a.providerMemberId !== null &&
      b.legacyProviderMemberIds.includes(a.providerMemberId)) ||
    (b.providerMemberId !== null &&
      a.legacyProviderMemberIds.includes(b.providerMemberId)) ||
    a.legacyProviderMemberIds.some((id) =>
      b.legacyProviderMemberIds.includes(id)
    )
  );
}

/**
 * Compares two prospect identities within the caller's chosen scope. Display
 * names are never inputs here: a name is never sufficient evidence that two
 * records are the same person. Absent any shared identifier, two records are
 * treated as different people rather than guessed to be the same.
 */
export function matchProspectIdentities(
  a: ProspectIdentitySignals,
  b: ProspectIdentitySignals
): IdentityMatchResult {
  if (a.tenantId !== b.tenantId) {
    return Object.freeze({ outcome: "DIFFERENT", reason: "CROSS_TENANT" });
  }
  if (a.accountId !== b.accountId) {
    return Object.freeze({ outcome: "DIFFERENT", reason: "CROSS_ACCOUNT" });
  }

  if (
    a.providerMemberId !== null &&
    b.providerMemberId !== null &&
    a.providerMemberId === b.providerMemberId
  ) {
    return Object.freeze({
      outcome: "SAME",
      reason: "PROVIDER_MEMBER_ID_MATCH",
    });
  }

  // A legacy link (e.g. a prior provider sync or a migrated import) proves
  // continuity even when each side also carries a different *current*
  // provider member ID, so this is checked before treating differing
  // current IDs as a conflict.
  if (hasLegacyOverlap(a, b)) {
    return Object.freeze({ outcome: "SAME", reason: "LEGACY_ID_MATCH" });
  }

  if (a.providerMemberId !== null && b.providerMemberId !== null) {
    if (
      a.publicIdentifier !== null &&
      a.publicIdentifier === b.publicIdentifier
    ) {
      // Same URL alias, but each side already has a different confirmed
      // provider member ID with no legacy link: never silently join two
      // different people.
      return Object.freeze({
        outcome: "AMBIGUOUS",
        reason: "PROVIDER_MEMBER_ID_CONFLICT",
      });
    }
    return Object.freeze({
      outcome: "DIFFERENT",
      reason: "NO_SHARED_IDENTIFIER",
    });
  }

  if (
    a.publicIdentifier !== null &&
    a.publicIdentifier === b.publicIdentifier
  ) {
    return Object.freeze({
      outcome: "SAME",
      reason: "PUBLIC_IDENTIFIER_MATCH",
    });
  }

  return Object.freeze({
    outcome: "DIFFERENT",
    reason: "NO_SHARED_IDENTIFIER",
  });
}
