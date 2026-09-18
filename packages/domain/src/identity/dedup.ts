import type { ProspectId } from "../contracts/ids";
import type { IdentityMatchReasonCode } from "./match";
import { matchProspectIdentities } from "./match";
import type { ProspectIdentitySignals } from "./signals";

export type KnownProspectIdentity = ProspectIdentitySignals &
  Readonly<{ prospectId: ProspectId }>;

export const IDENTITY_RESOLUTION_OUTCOMES = [
  "NEW",
  "MATCHED",
  "UNRESOLVED_COLLISION",
] as const;
export type IdentityResolutionOutcome =
  (typeof IDENTITY_RESOLUTION_OUTCOMES)[number];

export type IdentityResolutionResult =
  | Readonly<{ outcome: "NEW" }>
  | Readonly<{
      outcome: "MATCHED";
      prospectId: ProspectId;
      reason: IdentityMatchReasonCode;
    }>
  | Readonly<{
      candidates: readonly ProspectId[];
      outcome: "UNRESOLVED_COLLISION";
    }>;

function dedupeProspectIds(ids: readonly ProspectId[]): readonly ProspectId[] {
  return Object.freeze([...new Set(ids)]);
}

/**
 * Resolves one candidate identity against already-known prospects in the
 * same tenant/account scope. Migration-friendly: an ambiguous alias or a
 * candidate that matches more than one distinct existing prospect is
 * returned as an explicit unresolved collision rather than guessed at, so a
 * human or a migration step can disambiguate it. Discovery and import flows
 * share this same resolution so a prospect is never silently duplicated or
 * silently merged with a different person.
 */
export function resolveProspectIdentity(
  candidate: ProspectIdentitySignals,
  known: readonly KnownProspectIdentity[]
): IdentityResolutionResult {
  const matchedIds: ProspectId[] = [];
  const ambiguousIds: ProspectId[] = [];
  let matchReason: IdentityMatchReasonCode | null = null;

  for (const existing of known) {
    const result = matchProspectIdentities(candidate, existing);
    if (result.outcome === "SAME") {
      matchedIds.push(existing.prospectId);
      matchReason = result.reason;
    } else if (result.outcome === "AMBIGUOUS") {
      ambiguousIds.push(existing.prospectId);
    }
  }

  const distinctMatchedIds = dedupeProspectIds(matchedIds);

  if (ambiguousIds.length > 0 || distinctMatchedIds.length > 1) {
    return Object.freeze({
      candidates: dedupeProspectIds([...distinctMatchedIds, ...ambiguousIds]),
      outcome: "UNRESOLVED_COLLISION",
    });
  }

  if (distinctMatchedIds.length === 1 && matchReason !== null) {
    return Object.freeze({
      outcome: "MATCHED",
      prospectId: distinctMatchedIds[0],
      reason: matchReason,
    });
  }

  return Object.freeze({ outcome: "NEW" });
}
