import type {
  AccountId,
  CampaignId,
  ProspectId,
  TenantId,
  VersionId,
} from "./ids.js";
import type { Ownership, SuppressionEntry } from "./ownership.js";
import type { UtcTimestamp, SequenceStep } from "./values.js";

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

export type EligibilityReason = Readonly<{
  code: EligibilityReasonCode;
  detail: string | null;
  observedAt: UtcTimestamp;
}>;

export type EligibilitySnapshot = Readonly<{
  accountHealthy: boolean | null;
  campaignActive: boolean | null;
  currentCampaignVersionId: VersionId | null;
  entitlementActive: boolean | null;
  incomingMessageAt: UtcTimestamp | null;
  ownership: Ownership;
  quotaAvailable: boolean | null;
  suppression: SuppressionEntry | null;
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
