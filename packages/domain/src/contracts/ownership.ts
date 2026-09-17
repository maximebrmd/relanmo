import type { AccountId, ProspectId, TenantId, UserId } from "./ids";
import type { UtcTimestamp } from "./values";

export const OWNERSHIP_REASONS = [
  "INITIAL_ACTIVATION",
  "INCOMING_MESSAGE",
  "MANUAL_REPLY",
  "MANUAL_TAKEOVER",
  "IMPORTED_MANUAL_CONVERSATION",
  "UNMATCHED_OUTGOING_MESSAGE",
  "ACCOUNT_RECONCILIATION",
] as const;

export const OWNERSHIP_KINDS = ["BOT_ELIGIBLE", "HUMAN_OWNED"] as const;
export type OwnershipKind = (typeof OWNERSHIP_KINDS)[number];

export type OwnershipReason = (typeof OWNERSHIP_REASONS)[number];
export const BOT_OWNERSHIP_REASONS = [
  "INITIAL_ACTIVATION",
  "ACCOUNT_RECONCILIATION",
] as const;
export type BotOwnershipReason = (typeof BOT_OWNERSHIP_REASONS)[number];

export const HUMAN_OWNERSHIP_REASONS = [
  "INCOMING_MESSAGE",
  "MANUAL_REPLY",
  "MANUAL_TAKEOVER",
  "IMPORTED_MANUAL_CONVERSATION",
  "UNMATCHED_OUTGOING_MESSAGE",
  "ACCOUNT_RECONCILIATION",
] as const;
export type HumanOwnershipReason = (typeof HUMAN_OWNERSHIP_REASONS)[number];

export type Ownership = Readonly<
  | {
      kind: "BOT_ELIGIBLE";
      ownerUserId: null;
      reason: BotOwnershipReason;
      recordedAt: UtcTimestamp;
    }
  | {
      kind: "HUMAN_OWNED";
      ownerUserId: UserId | null;
      reason: HumanOwnershipReason;
      recordedAt: UtcTimestamp;
    }
>;

/** Scope is account/prospect based, so changing campaigns cannot reset ownership. */
export type AccountProspectOwnership = Readonly<{
  accountId: AccountId;
  ownership: Ownership;
  prospectId: ProspectId;
  tenantId: TenantId;
}>;

export const SUPPRESSION_REASONS = [
  "CUSTOMER_REQUEST",
  "PROSPECT_OBJECTION",
  "DO_NOT_CONTACT",
  "POLICY_REVIEW",
  "IMPORTED_SUPPRESSION",
] as const;

export type SuppressionReason = (typeof SUPPRESSION_REASONS)[number];

/** Suppression is a separate durable exclusion, never a member of Ownership. */
export type SuppressionEntry = Readonly<{
  accountId: AccountId;
  prospectId: ProspectId;
  reason: SuppressionReason;
  recordedAt: UtcTimestamp;
  tenantId: TenantId;
}>;
