import type { ProspectId } from "../contracts/ids";
import type {
  AccountProspectOwnership,
  SuppressionEntry,
} from "../contracts/ownership";
import { isNonEmpty } from "../contracts/runtime";
import type { KnownProspectIdentity } from "./dedup";
import { resolveProspectIdentity } from "./dedup";
import type { IdentityMatchReasonCode } from "./match";
import type { ProspectIdentitySignals } from "./signals";

export const CAMPAIGN_EXCLUSION_REASONS = [
  "SUPPRESSED",
  "HISTORICALLY_HUMAN_OWNED",
] as const;
export type CampaignExclusionReason =
  (typeof CAMPAIGN_EXCLUSION_REASONS)[number];

export type CampaignEntryCheck = Readonly<{
  ownership: AccountProspectOwnership | null;
  suppression: SuppressionEntry | null;
}>;

export type CampaignEntryResult =
  | Readonly<{ outcome: "ELIGIBLE" }>
  | Readonly<{
      outcome: "EXCLUDED";
      reasons: readonly [CampaignExclusionReason, ...CampaignExclusionReason[]];
    }>;

/**
 * Pure suppression/ownership gate for one already-identified account/prospect
 * pair. Ownership is one durable row per pair (see contracts C1): a pair
 * that is currently `HUMAN_OWNED` has, by construction, been human-owned at
 * some point and stays that way, so a new campaign can never re-claim it.
 * Suppression is a separate durable exclusion and is checked independently.
 */
export function evaluateCampaignEntry(
  check: CampaignEntryCheck
): CampaignEntryResult {
  const reasons: CampaignExclusionReason[] = [];
  if (check.suppression !== null) {
    reasons.push("SUPPRESSED");
  }
  if (
    check.ownership !== null &&
    check.ownership.ownership.kind === "HUMAN_OWNED"
  ) {
    reasons.push("HISTORICALLY_HUMAN_OWNED");
  }

  if (!isNonEmpty(reasons)) {
    return Object.freeze({ outcome: "ELIGIBLE" });
  }

  return Object.freeze({
    outcome: "EXCLUDED",
    reasons: Object.freeze(reasons),
  });
}

export type KnownProspectForCampaignEntry = KnownProspectIdentity &
  CampaignEntryCheck;

export type CampaignEntryDecision =
  | Readonly<{ outcome: "NEW" }>
  | Readonly<{
      outcome: "ELIGIBLE_EXISTING";
      prospectId: ProspectId;
      reason: IdentityMatchReasonCode;
    }>
  | Readonly<{
      outcome: "EXCLUDED";
      prospectId: ProspectId;
      reasons: readonly [CampaignExclusionReason, ...CampaignExclusionReason[]];
    }>
  | Readonly<{
      candidates: readonly ProspectId[];
      outcome: "UNRESOLVED_COLLISION";
    }>;

/**
 * The single entry point discovery and imports share: resolve identity
 * first, then apply the suppression/human-owned gate to whichever existing
 * prospect it resolved to. An ambiguous or multi-way identity match is
 * surfaced unresolved instead of silently picking a side.
 */
export function resolveCampaignEntry(
  candidate: ProspectIdentitySignals,
  known: readonly KnownProspectForCampaignEntry[]
): CampaignEntryDecision {
  const identity = resolveProspectIdentity(candidate, known);

  if (
    identity.outcome === "NEW" ||
    identity.outcome === "UNRESOLVED_COLLISION"
  ) {
    return identity;
  }

  const matched = known.find(
    (entry) => entry.prospectId === identity.prospectId
  );
  if (matched === undefined) {
    // Unreachable: resolveProspectIdentity only returns prospect IDs it read from `known`.
    return Object.freeze({ outcome: "NEW" });
  }

  const entryCheck = evaluateCampaignEntry(matched);
  if (entryCheck.outcome === "EXCLUDED") {
    return Object.freeze({
      outcome: "EXCLUDED",
      prospectId: identity.prospectId,
      reasons: entryCheck.reasons,
    });
  }

  return Object.freeze({
    outcome: "ELIGIBLE_EXISTING",
    prospectId: identity.prospectId,
    reason: identity.reason,
  });
}
