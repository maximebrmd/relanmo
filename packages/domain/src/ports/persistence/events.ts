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
import type {
  IncomingMessageEvent,
  OutboundMessage,
} from "../../contracts/message";
import type { OwnershipReason } from "../../contracts/ownership";
import type { UtcTimestamp } from "../../contracts/values";
import type { OutboxEventKind } from "../../contracts/workflow";
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

export type InboxProcessingLease = Readonly<{
  expiresAt: UtcTimestamp;
  fence: number;
  workerId: PersistenceWorkerId;
}>;

export type InboxEventRecord = Readonly<{
  dedupeKey: string;
  event: IncomingMessageEvent;
  eventId: InboxEventId;
  attempt: number;
  lastError: string | null;
  lease: InboxProcessingLease | null;
  processedAt: UtcTimestamp | null;
  quarantinedAt: UtcTimestamp | null;
  receivedAt: UtcTimestamp;
  state: InboxEventState;
  tenantId: TenantId;
}>;

export type RecordInboxEventInput = Readonly<{
  dedupeKey: string;
  event: IncomingMessageEvent;
  eventId: InboxEventId;
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
  eventId: InboxEventId;
  reason: "MALFORMED" | "UNKNOWN_MAPPING" | "TENANT_MISMATCH";
  tenantId: TenantId;
}>;

export type QuarantineInboxEventResult = Readonly<{
  event: InboxEventRecord;
  outcome: "QUARANTINED";
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

/** Inbox persistence is a durable first step; no model classification belongs in this port. */
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
  event: IncomingMessageEvent;
  eventId: InboxEventId;
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
  | Readonly<{
      accountId: AccountId | null;
      event: InboxEventRecord | null;
      holdAccount: true;
      outboxEvents: readonly OutboxEventRecord[];
      outcome: "QUARANTINED";
      reason: "MALFORMED" | "UNKNOWN_MAPPING" | "TENANT_MISMATCH";
    }>;

export type ManualTakeoverInput = Readonly<{
  eventId: InboxEventId;
  message: OutboundMessage;
  observedAt: UtcTimestamp;
  tenantId: TenantId;
}>;

export type ManualBotEchoMatch = Readonly<{
  action: ConfirmedActionRecord;
  attempt: SendAttemptRecord;
}>;

export type ManualTakeoverResult =
  | Readonly<{
      match: ManualBotEchoMatch;
      message: StoredMessage;
      outcome: "BOT_ECHO_CONFIRMED";
    }>
  | Readonly<{
      conversation: ConversationRecord;
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
      holdAccount: true;
      message: StoredMessage;
      outboxEvents: readonly [
        CustomerNotificationOutboxEvent,
        ...OutboxEventRecord[],
      ];
      outcome: "HELD_FOR_RECONCILIATION";
      reason: "INCONCLUSIVE_BOT_ECHO";
    }>;

/**
 * The two control operations are aggregate transaction boundaries. They must
 * persist inbox/message, pair ownership, READY invalidation and outbox rows
 * together; after a committed stop, authorization cannot create IN_FLIGHT work.
 * An outgoing provider event is matched against the ledger inside this same
 * transaction: exact matches are bot echoes, unmatched owner messages take the
 * pair over, and inconclusive matches hold the account for reconciliation.
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
