import type { DuePlan } from "./due-plan";
import type {
  AccountId,
  ActionId,
  CampaignId,
  EvidenceId,
  ProspectId,
  TenantId,
} from "./ids";
import type { Ownership, SuppressionEntry } from "./ownership";
import type {
  BusinessWindowEvaluation,
  SequenceStep,
  UtcTimestamp,
} from "./values";
import type { CurrentVersionSet, DraftSourceVersions } from "./versions";

export const ELIGIBILITY_REASON_CODES = [
  "INCOMING_MESSAGE",
  "HUMAN_OWNED",
  "SUPPRESSED",
  "ACCOUNT_UNHEALTHY",
  "CAMPAIGN_INACTIVE",
  "ENTITLEMENT_UNAVAILABLE",
  "NOT_DUE",
  "OUTSIDE_SEND_WINDOW",
  "QUOTA_UNAVAILABLE",
  "UNKNOWN_SEND",
  "MISSING_ACCEPTANCE",
  "MISSING_EVIDENCE",
  "STALE_VERSION",
  "RECONCILIATION_REQUIRED",
  "NO_ELIGIBLE_STEP",
] as const;

export type EligibilityReasonCode = (typeof ELIGIBILITY_REASON_CODES)[number];

export const ELIGIBILITY_OUTCOMES = ["ALLOWED", "HOLD", "DENY"] as const;
export type EligibilityOutcome = (typeof ELIGIBILITY_OUTCOMES)[number];

export const ELIGIBILITY_FACT_STATUSES = [
  "VALID",
  "INVALID",
  "MISSING",
  "UNKNOWN",
] as const;
export type EligibilityFactStatus = (typeof ELIGIBILITY_FACT_STATUSES)[number];

export const DRAFT_STATUSES = [
  "VALID",
  "MISSING",
  "STALE",
  "INVALID",
  "UNKNOWN",
] as const;
export type DraftStatus = (typeof DRAFT_STATUSES)[number];

export type AcceptanceFact = Readonly<{
  accepted: boolean | null;
  observedAt: UtcTimestamp | null;
}>;

export type EligibilityDraftSnapshot = Readonly<{
  actionId: ActionId | null;
  status: DraftStatus;
}>;

export type EligibilityEvidenceSnapshot = Readonly<{
  evidenceIds: readonly EvidenceId[];
  status: EligibilityFactStatus;
}>;

export type EligibilityVersionSnapshot = Readonly<{
  candidate: DraftSourceVersions | null;
  current: CurrentVersionSet;
}>;

export type CompletedSequenceSteps = readonly SequenceStep[];

export type EligibilityReason = Readonly<{
  code: EligibilityReasonCode;
  detail: string | null;
  observedAt: UtcTimestamp;
}>;

export type EligibilitySnapshot = Readonly<{
  acceptance: AcceptanceFact;
  accountHealthy: boolean | null;
  businessWindow: BusinessWindowEvaluation | null;
  campaignActive: boolean | null;
  completedSteps: CompletedSequenceSteps;
  draft: EligibilityDraftSnapshot;
  duePlan: DuePlan | null;
  entitlementActive: boolean | null;
  evaluatedAt: UtcTimestamp;
  evidence: EligibilityEvidenceSnapshot;
  incomingMessageAt: UtcTimestamp | null;
  ownership: Ownership;
  quotaAvailable: boolean | null;
  suppression: SuppressionEntry | null;
  unresolvedUnknownActionIds: readonly ActionId[];
  versions: EligibilityVersionSnapshot;
}>;

export type EligibilityCheck = Readonly<{
  accountId: AccountId;
  campaignId: CampaignId;
  prospectId: ProspectId;
  snapshot: EligibilitySnapshot;
  step: SequenceStep;
  tenantId: TenantId;
}>;

type EligibilityBase = Readonly<{
  accountId: AccountId;
  campaignId: CampaignId;
  evaluatedAt: UtcTimestamp;
  prospectId: ProspectId;
  retryAt: UtcTimestamp | null;
  step: SequenceStep;
  tenantId: TenantId;
}>;

/** This pure result reports eligibility reasons; it never authorizes a send. */
export type EligibilityResult =
  | Readonly<
      EligibilityBase & {
        outcome: "ALLOWED";
        reasons: readonly [];
        retryAt: null;
      }
    >
  | Readonly<
      EligibilityBase & {
        outcome: "HOLD";
        reasons: readonly [EligibilityReason, ...EligibilityReason[]];
      }
    >
  | Readonly<
      EligibilityBase & {
        outcome: "DENY";
        reasons: readonly [EligibilityReason, ...EligibilityReason[]];
        retryAt: null;
      }
    >;
