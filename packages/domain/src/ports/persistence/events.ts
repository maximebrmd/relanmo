import type {
  AccountId,
  ActionId,
  ConversationId,
  MessageId,
  OutboxEventId,
  ProspectId,
  TenantId,
  UserId,
  WorkflowId,
} from "../../contracts/ids";
import type { InboundMessage, OutboundMessage } from "../../contracts/message";
import type { OwnershipReason } from "../../contracts/ownership";
import type { UtcTimestamp } from "../../contracts/values";
import type { OutboxEventKind } from "../../contracts/workflow";
import type { ProviderName } from "../providers/common";
import type { ConfirmedActionRecord, SendAttemptRecord } from "./actions";
import type {
  AccountProspectKey,
  InboxEventId,
  PersistenceResult,
  PersistenceTransaction,
  PersistenceWorkerId,
} from "./common";
import type { ConversationRecord, StoredMessage } from "./conversations";
import type { PairOwnershipRecord } from "./prospects";

export const INBOX_EVENT_STATES = [
  "RECEIVED",
  "LEASED",
  "PROCESSED",
  "QUARANTINED",
] as const;
export type InboxEventState = (typeof INBOX_EVENT_STATES)[number];

export const INBOX_EVENT_KINDS = [
  "INCOMING_MESSAGE",
  "OUTGOING_MESSAGE",
  "UNRECOGNIZED",
] as const;
export type InboxEventKind = (typeof INBOX_EVENT_KINDS)[number];

/**
 * Provider-neutral scope survives normalization failures. A null field means
 * the provider event could not be safely mapped; the authoritative tenant for
 * storage still comes from the transaction scope and input tenantId.
 */
export type InboxEventScope = Readonly<{
  accountId: AccountId | null;
  conversationId: ConversationId | null;
  prospectId: ProspectId | null;
  tenantId: TenantId | null;
}>;

type InboxEventEnvelopeBase = Readonly<{
  canonicalPayloadFingerprint: string;
  dedupeKey: string;
  observedAt: UtcTimestamp;
  providerEventId: string | null;
  scope: InboxEventScope;
}>;

export type InboxIncomingEvent = Readonly<
  InboxEventEnvelopeBase & {
    kind: "INCOMING_MESSAGE";
    message: InboundMessage;
  }
>;

export type InboxOutgoingEvent = Readonly<
  InboxEventEnvelopeBase & {
    kind: "OUTGOING_MESSAGE";
    message: OutboundMessage;
  }
>;

/** Unrecognized events retain only bounded, non-secret mapping evidence. */
export type InboxUnrecognizedEvent = Readonly<
  InboxEventEnvelopeBase & {
    kind: "UNRECOGNIZED";
    message: null;
  }
>;

export type InboxEventEnvelope =
  | InboxIncomingEvent
  | InboxOutgoingEvent
  | InboxUnrecognizedEvent;

export const INBOX_IDENTITY_FIELDS = [
  "accountId",
  "conversationId",
  "prospectId",
  "tenantId",
] as const;
export type InboxIdentityField = (typeof INBOX_IDENTITY_FIELDS)[number];

export type InboxEventScopeValidation =
  | Readonly<{
      valid: true;
    }>
  | Readonly<{
      mismatches: readonly InboxIdentityField[];
      valid: false;
    }>;

/**
 * Normalized message envelopes must repeat the exact message identity in
 * scope. Unrecognized envelopes have no normalized message to compare.
 */
export function validateInboxEventScope(
  event: InboxEventEnvelope
): InboxEventScopeValidation {
  if (event.kind === "UNRECOGNIZED") {
    return { valid: true };
  }

  const mismatches: InboxIdentityField[] = [];
  if (event.scope.accountId !== event.message.accountId) {
    mismatches.push("accountId");
  }
  if (event.scope.conversationId !== event.message.conversationId) {
    mismatches.push("conversationId");
  }
  if (event.scope.prospectId !== event.message.prospectId) {
    mismatches.push("prospectId");
  }
  if (event.scope.tenantId !== event.message.tenantId) {
    mismatches.push("tenantId");
  }

  return mismatches.length === 0
    ? { valid: true }
    : { mismatches, valid: false };
}

/**
 * Returns every account candidate that is valid within the authoritative
 * tenant. The scope candidate is listed before the normalized message
 * candidate; duplicates are removed without crossing tenant boundaries. The
 * caller must pass tx.scope.tenantId, never a customer-supplied tenant ID.
 */
export function accountIdsToHoldForInboxEvent(
  event: InboxEventEnvelope,
  authoritativeTenantId: TenantId
): readonly AccountId[] {
  const candidates: AccountId[] = [];
  if (
    event.scope.tenantId === authoritativeTenantId &&
    event.scope.accountId !== null
  ) {
    candidates.push(event.scope.accountId);
  }
  if (
    event.kind !== "UNRECOGNIZED" &&
    event.message.tenantId === authoritativeTenantId
  ) {
    candidates.push(event.message.accountId);
  }
  return [...new Set(candidates)];
}

export type InboxProcessingLease = Readonly<{
  expiresAt: UtcTimestamp;
  fence: number;
  workerId: PersistenceWorkerId;
}>;

export type InboxEventDedupeIdentity = Readonly<{
  dedupeKey: string;
  provider: ProviderName;
  tenantId: TenantId;
}>;

/**
 * Persistence identity for webhook_events: tenant + provider + dedupe key.
 * Two providers may share a key under one tenant without colliding.
 */
export function inboxEventDedupeIdentityFromProvider(identity: {
  dedupeKey: string;
  provider: ProviderName;
  scope: { tenantId: TenantId };
}): InboxEventDedupeIdentity {
  return {
    dedupeKey: identity.dedupeKey,
    provider: identity.provider,
    tenantId: identity.scope.tenantId,
  };
}

export function inboxEventDedupeIdentitiesEqual(
  left: InboxEventDedupeIdentity,
  right: InboxEventDedupeIdentity
): boolean {
  return (
    left.tenantId === right.tenantId &&
    left.provider === right.provider &&
    left.dedupeKey === right.dedupeKey
  );
}

export type InboxEventRecord = Readonly<{
  availableAt: UtcTimestamp;
  dedupeKey: string;
  event: InboxEventEnvelope;
  eventId: InboxEventId;
  attempt: number;
  lastError: string | null;
  lease: InboxProcessingLease | null;
  processedAt: UtcTimestamp | null;
  provider: ProviderName;
  quarantinedAt: UtcTimestamp | null;
  receivedAt: UtcTimestamp;
  state: InboxEventState;
  tenantId: TenantId;
}>;

export type RecordInboxEventInput = Readonly<{
  availableAt: UtcTimestamp;
  dedupeKey: string;
  event: InboxEventEnvelope;
  eventId: InboxEventId;
  provider: ProviderName;
  receivedAt: UtcTimestamp;
  tenantId: TenantId;
}>;

export type RecordInboxEventResult =
  | Readonly<{
      event: InboxEventRecord;
      outcome: "RECORDED";
    }>
  | Readonly<{
      event: InboxEventRecord;
      outcome: "DUPLICATE";
    }>;

export type QuarantineInboxEventInput = Readonly<{
  event: InboxEventEnvelope;
  eventId: InboxEventId;
  provider: ProviderName;
  reason:
    | "IDENTITY_MISMATCH"
    | "MALFORMED"
    | "UNKNOWN_MAPPING"
    | "TENANT_MISMATCH";
  tenantId: TenantId;
}>;

/**
 * An affected account can never be quarantined without a hold. The tuple is
 * the exact, deduplicated set of account rows the transaction must hold.
 */
export type QuarantineAccountOutcome =
  | Readonly<{
      /**
       * Every distinct account candidate valid in the authoritative tenant,
       * in the deterministic scope-first order returned by
       * accountIdsToHoldForInboxEvent. All IDs are held atomically.
       */
      affectedAccountIds: readonly [AccountId, ...AccountId[]];
      holdAccount: true;
    }>
  | Readonly<{
      /** No account candidate was valid in the authoritative tenant. */
      affectedAccountIds: readonly [];
      holdAccount: false;
    }>;

export type QuarantineInboxEventResult = QuarantineAccountOutcome &
  Readonly<{
    event: InboxEventRecord;
    outcome: "QUARANTINED";
    reason: QuarantineInboxEventInput["reason"];
  }>;

export type ClaimInboxInput = Readonly<{
  leaseExpiresAt: UtcTimestamp;
  limit: number;
  requestedAt: UtcTimestamp;
  tenantId: TenantId;
  workerId: PersistenceWorkerId;
}>;

export type ClaimInboxResult = Readonly<{
  events: readonly InboxEventRecord[];
}>;

export type AcknowledgeInboxInput = Readonly<{
  eventId: InboxEventId;
  fence: number;
  processedAt: UtcTimestamp;
  tenantId: TenantId;
  workerId: PersistenceWorkerId;
}>;

export type AcknowledgeInboxResult = Readonly<{
  event: InboxEventRecord;
  outcome: "ACKNOWLEDGED" | "ALREADY_PROCESSED" | "FENCE_MISMATCH";
}>;

export type RetryInboxInput = Readonly<{
  availableAt: UtcTimestamp;
  error: string;
  eventId: InboxEventId;
  fence: number;
  tenantId: TenantId;
  workerId: PersistenceWorkerId;
}>;

export type RetryInboxResult = Readonly<{
  event: InboxEventRecord;
  outcome: "RETRY_SCHEDULED" | "FENCE_MISMATCH" | "QUARANTINED";
}>;

export type ListInboxDeadLettersInput = Readonly<{
  limit: number;
  tenantId: TenantId;
}>;

export type ListInboxDeadLettersResult = Readonly<{
  events: readonly InboxEventRecord[];
}>;

/**
 * Inbox persistence is a durable first step; no model classification belongs
 * in this port. Implementations validate normalized scope/message identity
 * before state changes and commit quarantine plus a hold for every account in
 * the result's affectedAccountIds atomically. accountIdsToHoldForInboxEvent
 * defines the tenant-filtered candidate set for that result. Dedupe identity
 * is tenantId + provider + dedupeKey so two providers cannot collide.
 */
export interface InboxRepository {
  acknowledge: (
    input: AcknowledgeInboxInput,
    tx: PersistenceTransaction
  ) => Promise<PersistenceResult<AcknowledgeInboxResult>>;
  claim: (
    input: ClaimInboxInput,
    tx: PersistenceTransaction
  ) => Promise<PersistenceResult<ClaimInboxResult>>;
  listDeadLetters: (
    input: ListInboxDeadLettersInput,
    tx: PersistenceTransaction
  ) => Promise<PersistenceResult<ListInboxDeadLettersResult>>;
  quarantine: (
    input: QuarantineInboxEventInput,
    tx: PersistenceTransaction
  ) => Promise<PersistenceResult<QuarantineInboxEventResult>>;
  record: (
    input: RecordInboxEventInput,
    tx: PersistenceTransaction
  ) => Promise<PersistenceResult<RecordInboxEventResult>>;
  retry: (
    input: RetryInboxInput,
    tx: PersistenceTransaction
  ) => Promise<PersistenceResult<RetryInboxResult>>;
}

export type OutboxDeliveryLease = Readonly<{
  expiresAt: UtcTimestamp;
  fence: number;
  workerId: PersistenceWorkerId;
}>;

export type OutboxPayload =
  | Readonly<{
      accountId: AccountId;
      conversationId: ConversationId | null;
      messageId: MessageId | null;
      prospectId: ProspectId;
      reason: OwnershipReason;
      targetWorkflowId: WorkflowId;
      tenantId: TenantId;
      type: "STOP_WORKFLOW";
    }>
  | Readonly<{
      accountId: AccountId | null;
      reason: string;
      targetWorkflowId: WorkflowId;
      tenantId: TenantId;
      type: "PAUSE_WORKFLOW";
    }>
  | Readonly<{
      targetWorkflowId: WorkflowId;
      tenantId: TenantId;
      type: "START_WORKFLOW";
    }>
  | Readonly<{
      messageId: MessageId | null;
      recipientUserId: UserId;
      template: "INCOMING_MESSAGE" | "MANUAL_TAKEOVER" | "UNKNOWN_SEND";
      tenantId: TenantId;
      type: "NOTIFY_CUSTOMER";
    }>;

export const OUTBOX_EVENT_STATES = [
  "PENDING",
  "LEASED",
  "DELIVERED",
  "QUARANTINED",
] as const;
export type OutboxEventState = (typeof OUTBOX_EVENT_STATES)[number];

type OutboxPayloadForKind<Kind extends OutboxEventKind> = Extract<
  OutboxPayload,
  { type: Kind }
>;

type OutboxEventRecordForKind<Kind extends OutboxEventKind> = Readonly<{
  availableAt: UtcTimestamp;
  attempt: number;
  createdAt: UtcTimestamp;
  dedupeKey: string;
  eventId: OutboxEventId;
  kind: Kind;
  lastError: string | null;
  lease: OutboxDeliveryLease | null;
  payload: OutboxPayloadForKind<Kind>;
  state: OutboxEventState;
  tenantId: TenantId;
}>;

export type OutboxEventRecord = {
  [Kind in OutboxEventKind]: OutboxEventRecordForKind<Kind>;
}[OutboxEventKind];

type EnqueueOutboxInputForKind<Kind extends OutboxEventKind> = Readonly<{
  availableAt: UtcTimestamp;
  createdAt: UtcTimestamp;
  dedupeKey: string;
  eventId: OutboxEventId;
  kind: Kind;
  payload: OutboxPayloadForKind<Kind>;
  tenantId: TenantId;
}>;

export type EnqueueOutboxInput = {
  [Kind in OutboxEventKind]: EnqueueOutboxInputForKind<Kind>;
}[OutboxEventKind];

export type WorkflowStopOutboxEvent = Extract<
  OutboxEventRecord,
  { kind: "STOP_WORKFLOW" }
>;
export type CustomerNotificationOutboxEvent = Extract<
  OutboxEventRecord,
  { kind: "NOTIFY_CUSTOMER" }
>;

export type EnqueueOutboxResult =
  | Readonly<{
      event: OutboxEventRecord;
      outcome: "ENQUEUED";
    }>
  | Readonly<{
      event: OutboxEventRecord;
      outcome: "DUPLICATE";
    }>;

export type ClaimOutboxInput = Readonly<{
  leaseExpiresAt: UtcTimestamp;
  limit: number;
  requestedAt: UtcTimestamp;
  tenantId: TenantId;
  workerId: PersistenceWorkerId;
}>;

export type ClaimOutboxResult = Readonly<{
  events: readonly OutboxEventRecord[];
}>;

export type AcknowledgeOutboxInput = Readonly<{
  deliveredAt: UtcTimestamp;
  eventId: OutboxEventId;
  fence: number;
  tenantId: TenantId;
  workerId: PersistenceWorkerId;
}>;

export type AcknowledgeOutboxResult = Readonly<{
  event: OutboxEventRecord;
  outcome: "ACKNOWLEDGED" | "FENCE_MISMATCH" | "ALREADY_DELIVERED";
}>;

export type RetryOutboxInput = Readonly<{
  availableAt: UtcTimestamp;
  eventId: OutboxEventId;
  error: string;
  fence: number;
  tenantId: TenantId;
  workerId: PersistenceWorkerId;
}>;

export type RetryOutboxResult = Readonly<{
  event: OutboxEventRecord;
  outcome: "RETRY_SCHEDULED" | "FENCE_MISMATCH" | "QUARANTINED";
}>;

export type ListDeadLettersInput = Readonly<{
  limit: number;
  tenantId: TenantId;
}>;

export type ListDeadLettersResult = Readonly<{
  events: readonly OutboxEventRecord[];
}>;

/** Outbox enqueue must use the same tx as the state mutation it describes. */
export interface OutboxRepository {
  acknowledge: (
    input: AcknowledgeOutboxInput,
    tx: PersistenceTransaction
  ) => Promise<PersistenceResult<AcknowledgeOutboxResult>>;
  claim: (
    input: ClaimOutboxInput,
    tx: PersistenceTransaction
  ) => Promise<PersistenceResult<ClaimOutboxResult>>;
  enqueue: (
    input: EnqueueOutboxInput,
    tx: PersistenceTransaction
  ) => Promise<PersistenceResult<EnqueueOutboxResult>>;
  listDeadLetters: (
    input: ListDeadLettersInput,
    tx: PersistenceTransaction
  ) => Promise<PersistenceResult<ListDeadLettersResult>>;
  retry: (
    input: RetryOutboxInput,
    tx: PersistenceTransaction
  ) => Promise<PersistenceResult<RetryOutboxResult>>;
}

export type AtomicReplyStopInput = Readonly<{
  event: InboxIncomingEvent;
  eventId: InboxEventId;
  provider: ProviderName;
  stoppedAt: UtcTimestamp;
  tenantId: TenantId;
}>;

export type AtomicReplyStopValue = Readonly<{
  conversation: ConversationRecord;
  inboxEvent: InboxEventRecord;
  invalidatedActionIds: readonly ActionId[];
  message: StoredMessage;
  outboxEvents: readonly [
    WorkflowStopOutboxEvent,
    CustomerNotificationOutboxEvent,
    ...OutboxEventRecord[],
  ];
  ownership: PairOwnershipRecord;
}>;

export type AtomicReplyStopResult =
  | (AtomicReplyStopValue &
      Readonly<{
        outcome: "STOPPED";
      }>)
  | (AtomicReplyStopValue &
      Readonly<{
        outcome: "DUPLICATE";
      }>)
  | (QuarantineAccountOutcome &
      Readonly<{
        event: InboxEventRecord;
        outboxEvents: readonly OutboxEventRecord[];
        outcome: "QUARANTINED";
        reason: QuarantineInboxEventInput["reason"];
      }>);

export type ManualTakeoverInput = Readonly<{
  event: InboxOutgoingEvent;
  eventId: InboxEventId;
  provider: ProviderName;
  tenantId: TenantId;
}>;

export type ManualBotEchoMatch = Readonly<{
  action: ConfirmedActionRecord;
  attempt: SendAttemptRecord;
}>;

export type ManualTakeoverResult =
  | Readonly<{
      event: InboxEventRecord;
      match: ManualBotEchoMatch;
      message: StoredMessage;
      outcome: "BOT_ECHO_CONFIRMED";
    }>
  | Readonly<{
      conversation: ConversationRecord;
      event: InboxEventRecord;
      invalidatedActionIds: readonly ActionId[];
      message: StoredMessage;
      outboxEvents: readonly [
        WorkflowStopOutboxEvent,
        CustomerNotificationOutboxEvent,
        ...OutboxEventRecord[],
      ];
      outcome: "TAKEN_OVER";
      ownership: PairOwnershipRecord;
    }>
  | Readonly<{
      accountId: AccountId;
      event: InboxEventRecord;
      holdAccount: true;
      message: StoredMessage;
      outboxEvents: readonly [
        CustomerNotificationOutboxEvent,
        ...OutboxEventRecord[],
      ];
      outcome: "HELD_FOR_RECONCILIATION";
      reason: "INCONCLUSIVE_BOT_ECHO";
    }>
  | Readonly<{
      event: InboxEventRecord;
      outcome: "DUPLICATE";
      priorOutcome:
        | "BOT_ECHO_CONFIRMED"
        | "HELD_FOR_RECONCILIATION"
        | "TAKEN_OVER";
    }>
  | (QuarantineAccountOutcome &
      Readonly<{
        event: InboxEventRecord;
        outcome: "QUARANTINED";
        reason: QuarantineInboxEventInput["reason"];
      }>);

/**
 * The two control operations are aggregate transaction boundaries. They must
 * validate envelope/message identity, then persist the durable envelope/inbox
 * row, message, pair ownership,
 * READY invalidation and outbox rows together; after a committed stop,
 * authorization cannot create IN_FLIGHT work. An outgoing provider event is
 * matched against the ledger inside this same transaction: exact matches are
 * bot echoes, unmatched owner messages take the pair over, and inconclusive
 * matches hold the account for reconciliation. A scope mismatch is
 * quarantined with holds for every affected account instead of choosing an
 * identity. The affected account set is tenant-filtered and deduplicated.
 * Re-delivery returns DUPLICATE after the first decision instead of repeating
 * the side effects.
 */
export interface AtomicReplyStopRepository {
  recordManualTakeover: (
    input: ManualTakeoverInput,
    tx: PersistenceTransaction
  ) => Promise<PersistenceResult<ManualTakeoverResult>>;
  stopIncoming: (
    input: AtomicReplyStopInput,
    tx: PersistenceTransaction
  ) => Promise<PersistenceResult<AtomicReplyStopResult>>;
}

/** Pair ownership is intentionally account/prospect scoped across campaigns. */
export type ReplyStopScope = AccountProspectKey;
