import type { ActionUnknownReason } from "./action.js";
import type { EligibilityReasonCode } from "./eligibility.js";
import type {
  AccountId,
  ActionId,
  BatchId,
  CampaignId,
  CampaignVersionId,
  EvidenceId,
  MessageId,
  OutboxEventId,
  ProspectId,
  TenantId,
  WorkflowId,
} from "./ids.js";
import { parseWorkflowId } from "./ids.js";
import type { Ownership, OwnershipReason } from "./ownership.js";
import { ContractValidationError } from "./runtime.js";
import type {
  DirectMessageStep,
  SequenceStep,
  UtcTimestamp,
} from "./values.js";

export const WORKFLOW_ID_PREFIX = "rlm1" as const;

export const WORKFLOW_UNITS = {
  accountReconciliation: "a",
  campaignCoordinator: "c",
  discoveryBatch: "d",
  outboxDelivery: "o",
  prospectSequence: "s",
} as const;

export type WorkflowUnit = (typeof WORKFLOW_UNITS)[keyof typeof WORKFLOW_UNITS];

export type WorkflowIdentity =
  | Readonly<{
      batchId: BatchId;
      campaignId: CampaignId;
      kind: "DISCOVERY_BATCH";
      tenantId: TenantId;
    }>
  | Readonly<{
      accountId: AccountId;
      kind: "ACCOUNT_RECONCILIATION";
      tenantId: TenantId;
    }>
  | Readonly<{
      campaignId: CampaignId;
      kind: "CAMPAIGN_COORDINATOR";
      tenantId: TenantId;
    }>
  | Readonly<{
      accountId: AccountId;
      campaignId: CampaignId;
      kind: "PROSPECT_SEQUENCE";
      prospectId: ProspectId;
      tenantId: TenantId;
    }>
  | Readonly<{
      kind: "OUTBOX_DELIVERY";
      outboxEventId: OutboxEventId;
      tenantId: TenantId;
    }>;

export type WorkflowKind = WorkflowIdentity["kind"];

function encodeScopePart(value: string): string {
  return encodeURIComponent(value);
}

/**
 * Workflow IDs are derived only from stable local IDs. They contain no provider
 * payloads, timestamps or mutable campaign/version state.
 */
export function workflowIdFor(identity: WorkflowIdentity): WorkflowId {
  const encodedTenantId = encodeScopePart(identity.tenantId);
  let wireId: string;

  switch (identity.kind) {
    case "DISCOVERY_BATCH": {
      wireId = [
        WORKFLOW_ID_PREFIX,
        WORKFLOW_UNITS.discoveryBatch,
        encodedTenantId,
        encodeScopePart(identity.campaignId),
        encodeScopePart(identity.batchId),
      ].join(":");
      break;
    }
    case "PROSPECT_SEQUENCE": {
      wireId = [
        WORKFLOW_ID_PREFIX,
        WORKFLOW_UNITS.prospectSequence,
        encodedTenantId,
        encodeScopePart(identity.accountId),
        encodeScopePart(identity.prospectId),
        encodeScopePart(identity.campaignId),
      ].join(":");
      break;
    }
    case "ACCOUNT_RECONCILIATION": {
      wireId = [
        WORKFLOW_ID_PREFIX,
        WORKFLOW_UNITS.accountReconciliation,
        encodedTenantId,
        encodeScopePart(identity.accountId),
      ].join(":");
      break;
    }
    case "CAMPAIGN_COORDINATOR": {
      wireId = [
        WORKFLOW_ID_PREFIX,
        WORKFLOW_UNITS.campaignCoordinator,
        encodedTenantId,
        encodeScopePart(identity.campaignId),
      ].join(":");
      break;
    }
    case "OUTBOX_DELIVERY": {
      wireId = [
        WORKFLOW_ID_PREFIX,
        WORKFLOW_UNITS.outboxDelivery,
        encodedTenantId,
        encodeScopePart(identity.outboxEventId),
      ].join(":");
      break;
    }
    default: {
      throw new ContractValidationError("unsupported workflow kind");
    }
  }

  if (wireId.length > 240) {
    throw new ContractValidationError(
      "workflowId exceeds the compact identifier limit"
    );
  }
  return parseWorkflowId(wireId);
}

export const WORKFLOW_ACTIVITY_NAMES = {
  accountReconcile: "account.reconcile",
  campaignCoordinate: "campaign.coordinate",
  discoveryFetchPage: "discovery.fetch_page",
  discoveryQualifyBatch: "discovery.qualify_batch",
  outboxDeliver: "outbox.deliver",
  sequenceCheckAcceptance: "sequence.check_acceptance",
  sequenceReadState: "sequence.read_state",
  sequenceReconcileAction: "sequence.reconcile_action",
} as const;

export type WorkflowActivityName =
  (typeof WORKFLOW_ACTIVITY_NAMES)[keyof typeof WORKFLOW_ACTIVITY_NAMES];

export type DiscoveryFetchPageInput = Readonly<{
  batchId: BatchId;
  campaignId: CampaignId;
  campaignVersionId: CampaignVersionId;
  cursor: string | null;
  limit: number;
  tenantId: TenantId;
}>;

export type DiscoveryFetchPageResult = Readonly<{
  candidateProspectIds: readonly ProspectId[];
  exhausted: boolean;
  nextCursor: string | null;
  observedAt: UtcTimestamp;
}>;

export type DiscoveryQualifyBatchInput = Readonly<{
  campaignId: CampaignId;
  campaignVersionId: CampaignVersionId;
  prospectIds: readonly ProspectId[];
  tenantId: TenantId;
}>;

export type DiscoveryQualification = Readonly<{
  evidenceIds: readonly EvidenceId[];
  outcome: "HOLD" | "QUALIFIED" | "SKIP";
  prospectId: ProspectId;
  reason: EligibilityReasonCode | null;
}>;

/** Qualification is a bounded recommendation, never send authorization. */
export type DiscoveryQualifyBatchResult = Readonly<{
  decisions: readonly DiscoveryQualification[];
  observedAt: UtcTimestamp;
}>;

export type SequenceReadStateInput = Readonly<{
  accountId: AccountId;
  campaignId: CampaignId;
  prospectId: ProspectId;
  tenantId: TenantId;
}>;

export type SequenceReadStateResult = Readonly<{
  campaignVersionId: CampaignVersionId | null;
  lastIncomingAt: UtcTimestamp | null;
  latestActionId: ActionId | null;
  nextStep: SequenceStep | null;
  observedAt: UtcTimestamp;
  ownership: Ownership;
}>;

export type SequenceCheckAcceptanceInput = Readonly<{
  accountId: AccountId;
  prospectId: ProspectId;
  tenantId: TenantId;
}>;

export type SequenceCheckAcceptanceResult = Readonly<{
  accepted: boolean | null;
  observedAt: UtcTimestamp;
  source: "PROVIDER_EVENT" | "PROVIDER_HISTORY" | "UNKNOWN";
}>;

export type SequenceReconcileActionInput = Readonly<{
  actionId: ActionId;
  accountId: AccountId;
  prospectId: ProspectId;
  tenantId: TenantId;
}>;

export type SequenceReconcileActionResult = Readonly<{
  outcome: "CONFIRMED" | "NOT_FOUND" | "UNKNOWN";
  providerMessageId: string | null;
  reconciledAt: UtcTimestamp;
  unknownReason: ActionUnknownReason | null;
}>;

export type AccountReconcileInput = Readonly<{
  accountId: AccountId;
  cursor: string | null;
  maxMessages: number;
  requestedAt: UtcTimestamp;
  tenantId: TenantId;
}>;

export type AccountReconcileResult = Readonly<{
  accountHealthy: boolean | null;
  completed: boolean;
  incomingMessagesFound: number;
  nextCursor: string | null;
  observedAt: UtcTimestamp;
  unresolvedActionIds: readonly ActionId[];
}>;

export type CampaignCoordinateInput = Readonly<{
  batchLimit: number;
  campaignId: CampaignId;
  campaignVersionId: CampaignVersionId;
  dueAt: UtcTimestamp;
  tenantId: TenantId;
}>;

export type CampaignCoordinateResult = Readonly<{
  heldProspectIds: readonly ProspectId[];
  observedAt: UtcTimestamp;
  remainingCount: number;
  startedProspectIds: readonly ProspectId[];
}>;

export const OUTBOX_EVENT_KINDS = [
  "START_WORKFLOW",
  "STOP_WORKFLOW",
  "PAUSE_WORKFLOW",
  "NOTIFY_CUSTOMER",
] as const;
export type OutboxEventKind = (typeof OUTBOX_EVENT_KINDS)[number];

export type OutboxDeliverInput = Readonly<{
  attempt: number;
  eventId: OutboxEventId;
  eventKind: OutboxEventKind;
  requestedAt: UtcTimestamp;
  targetWorkflowId: WorkflowId | null;
  tenantId: TenantId;
}>;

export type OutboxDeliverResult = Readonly<{
  deliveredAt: UtcTimestamp;
  nextAttemptAt: UtcTimestamp | null;
  outcome: "DELIVERED" | "IGNORED_COMPLETED" | "QUARANTINED" | "RETRY";
}>;

export interface WorkflowActivityContracts {
  [WORKFLOW_ACTIVITY_NAMES.discoveryFetchPage]: {
    input: DiscoveryFetchPageInput;
    result: DiscoveryFetchPageResult;
  };
  [WORKFLOW_ACTIVITY_NAMES.discoveryQualifyBatch]: {
    input: DiscoveryQualifyBatchInput;
    result: DiscoveryQualifyBatchResult;
  };
  [WORKFLOW_ACTIVITY_NAMES.sequenceReadState]: {
    input: SequenceReadStateInput;
    result: SequenceReadStateResult;
  };
  [WORKFLOW_ACTIVITY_NAMES.sequenceCheckAcceptance]: {
    input: SequenceCheckAcceptanceInput;
    result: SequenceCheckAcceptanceResult;
  };
  [WORKFLOW_ACTIVITY_NAMES.sequenceReconcileAction]: {
    input: SequenceReconcileActionInput;
    result: SequenceReconcileActionResult;
  };
  [WORKFLOW_ACTIVITY_NAMES.accountReconcile]: {
    input: AccountReconcileInput;
    result: AccountReconcileResult;
  };
  [WORKFLOW_ACTIVITY_NAMES.campaignCoordinate]: {
    input: CampaignCoordinateInput;
    result: CampaignCoordinateResult;
  };
  [WORKFLOW_ACTIVITY_NAMES.outboxDeliver]: {
    input: OutboxDeliverInput;
    result: OutboxDeliverResult;
  };
}

export type WorkflowActivityInput<Name extends WorkflowActivityName> =
  WorkflowActivityContracts[Name]["input"];

export type WorkflowActivityResult<Name extends WorkflowActivityName> =
  WorkflowActivityContracts[Name]["result"];

export const WORKFLOW_SIGNAL_NAMES = {
  accountReconcileNow: "account.reconcile_now",
  campaignAccountChanged: "campaign.account_changed",
  campaignPause: "campaign.pause",
  discoveryCancel: "discovery.cancel",
  discoveryPause: "discovery.pause",
  outboxRetry: "outbox.retry",
  sequenceAcceptanceObserved: "sequence.acceptance_observed",
  sequenceIncomingMessage: "sequence.incoming_message",
  sequenceStop: "sequence.stop",
} as const;

export const WORKFLOW_PAUSE_REASONS = [
  "ACCOUNT_UNHEALTHY",
  "CUSTOMER_PAUSE",
  "ENTITLEMENT_UNAVAILABLE",
  "INCOMING_MESSAGE",
  "RECONCILIATION_REQUIRED",
] as const;

export type WorkflowPauseReason =
  | "ACCOUNT_UNHEALTHY"
  | "CUSTOMER_PAUSE"
  | "ENTITLEMENT_UNAVAILABLE"
  | "INCOMING_MESSAGE"
  | "RECONCILIATION_REQUIRED";

export type WorkflowSignal = Readonly<
  | {
      at: UtcTimestamp;
      batchId: BatchId;
      name: "discovery.cancel";
      reason: WorkflowPauseReason;
    }
  | {
      at: UtcTimestamp;
      batchId: BatchId;
      name: "discovery.pause";
      reason: WorkflowPauseReason;
    }
  | {
      accountId: AccountId;
      at: UtcTimestamp;
      name: "account.reconcile_now";
    }
  | {
      accountId: AccountId;
      at: UtcTimestamp;
      name: "campaign.account_changed";
    }
  | {
      at: UtcTimestamp;
      campaignId: CampaignId;
      name: "campaign.pause";
      reason: WorkflowPauseReason;
    }
  | {
      at: UtcTimestamp;
      eventId: OutboxEventId;
      name: "outbox.retry";
    }
  | {
      accepted: boolean | null;
      at: UtcTimestamp;
      name: "sequence.acceptance_observed";
    }
  | {
      at: UtcTimestamp;
      messageId: MessageId;
      name: "sequence.incoming_message";
    }
  | {
      at: UtcTimestamp;
      name: "sequence.stop";
      reason: OwnershipReason;
    }
>;

export type WorkflowSignalName = WorkflowSignal["name"];

export const DEFAULT_SEQUENCE_ACTIVITY_STEPS: readonly DirectMessageStep[] = [
  "DM1",
  "DM2",
  "DM3",
  "DM4",
  "DM5",
];
