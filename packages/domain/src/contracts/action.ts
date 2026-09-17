import type {
  AccountId,
  ActionId,
  CampaignId,
  CampaignVersionId,
  EvidenceId,
  ProspectId,
  SendAttemptId,
  TenantId,
} from "./ids.js";
import type {
  DirectMessageStep,
  SequenceStep,
  UtcTimestamp,
} from "./values.js";
import type { DraftSourceVersions } from "./versions.js";

export type InvitationActionPayload = Readonly<{
  kind: "INVITATION_WITHOUT_NOTE";
  note: null;
  step: "INVITATION";
}>;

export type DirectMessageActionPayload = Readonly<{
  kind: "DIRECT_MESSAGE";
  step: DirectMessageStep;
  text: string;
}>;

export type ActionPayload =
  | InvitationActionPayload
  | DirectMessageActionPayload;

export const ACTION_STATES = [
  "READY",
  "IN_FLIGHT",
  "CONFIRMED",
  "FAILED",
  "UNKNOWN",
] as const;
export type ActionState = (typeof ACTION_STATES)[number];

export const ACTION_FAILURE_REASONS = [
  "DEFINITIVE_PROVIDER_REFUSAL",
  "INVALID_RECIPIENT",
  "ACCOUNT_UNAVAILABLE",
  "CAMPAIGN_PAUSED",
  "QUOTA_UNAVAILABLE",
  "VALIDATION_FAILED",
] as const;
export type ActionFailureReason = (typeof ACTION_FAILURE_REASONS)[number];

export const ACTION_UNKNOWN_REASONS = [
  "TIMEOUT",
  "LEASE_EXPIRED",
  "TRANSPORT_ERROR",
  "RECONCILIATION_INCONCLUSIVE",
] as const;
export type ActionUnknownReason = (typeof ACTION_UNKNOWN_REASONS)[number];

export type ActionLease = Readonly<{
  expiresAt: UtcTimestamp;
  fence: number;
}>;

export type ActionIdentity = Readonly<{
  accountId: AccountId;
  actionId: ActionId;
  campaignId: CampaignId;
  campaignVersionId: CampaignVersionId;
  createdAt: UtcTimestamp;
  evidenceIds: readonly EvidenceId[];
  payload: ActionPayload;
  prospectId: ProspectId;
  sourceVersions: DraftSourceVersions;
  step: SequenceStep;
  tenantId: TenantId;
}>;

export type ActionLifecycle = Readonly<
  | {
      attemptId: null;
      failureReason: null;
      lease: null;
      providerMessageId: null;
      state: "READY";
      stateAt: UtcTimestamp;
      unknownReason: null;
    }
  | {
      attemptId: SendAttemptId;
      failureReason: null;
      lease: ActionLease;
      providerMessageId: null;
      state: "IN_FLIGHT";
      stateAt: UtcTimestamp;
      unknownReason: null;
    }
  | {
      attemptId: SendAttemptId;
      failureReason: null;
      lease: null;
      providerMessageId: string;
      state: "CONFIRMED";
      stateAt: UtcTimestamp;
      unknownReason: null;
    }
  | {
      attemptId: SendAttemptId | null;
      failureReason: ActionFailureReason;
      lease: null;
      providerMessageId: null;
      state: "FAILED";
      stateAt: UtcTimestamp;
      unknownReason: null;
    }
  | {
      attemptId: SendAttemptId;
      failureReason: null;
      lease: null;
      providerMessageId: null;
      state: "UNKNOWN";
      stateAt: UtcTimestamp;
      unknownReason: ActionUnknownReason;
    }
>;

export type Action = Readonly<ActionIdentity & ActionLifecycle>;

export type ActionLifecycleEvent = Readonly<
  | {
      actionId: ActionId;
      occurredAt: UtcTimestamp;
      type: "ACTION_READY";
    }
  | {
      actionId: ActionId;
      attemptId: SendAttemptId;
      fence: number;
      occurredAt: UtcTimestamp;
      type: "ACTION_IN_FLIGHT";
    }
  | {
      actionId: ActionId;
      attemptId: SendAttemptId;
      occurredAt: UtcTimestamp;
      providerMessageId: string;
      type: "ACTION_CONFIRMED";
    }
  | {
      actionId: ActionId;
      attemptId: SendAttemptId | null;
      occurredAt: UtcTimestamp;
      reason: ActionFailureReason;
      type: "ACTION_FAILED";
    }
  | {
      actionId: ActionId;
      attemptId: SendAttemptId;
      occurredAt: UtcTimestamp;
      reason: ActionUnknownReason;
      type: "ACTION_UNKNOWN";
    }
>;

export type ActionEvent = ActionLifecycleEvent;

export type ActionStep = SequenceStep;
