import {
  ACTION_FAILURE_REASONS,
  ACTION_STATES,
  ACTION_UNKNOWN_REASONS,
} from "@relanmo/domain/contracts/action";
import type {
  ActionFailureReason,
  ActionLifecycleEvent,
  ActionPayload,
  ActionState,
  ActionUnknownReason,
} from "@relanmo/domain/contracts/action";
import type {
  AccountId,
  ActionId,
  CampaignId,
  CampaignVersionId,
  EvidenceId,
  OutboxEventId,
  ProspectId,
  SendAttemptId,
  TenantId,
} from "@relanmo/domain/contracts/ids";
import type {
  SequenceStep,
  UtcTimestamp,
} from "@relanmo/domain/contracts/values";
import type { DraftSourceVersions } from "@relanmo/domain/contracts/versions";
import { OUTBOX_EVENT_KINDS } from "@relanmo/domain/contracts/workflow";
import type { OutboxEventKind } from "@relanmo/domain/contracts/workflow";
import {
  QUOTA_BUCKETS,
  QUOTA_RESERVATION_STATES,
} from "@relanmo/domain/ports/persistence/actions";
import type {
  QuotaBucket,
  QuotaReservationState,
} from "@relanmo/domain/ports/persistence/actions";
import type {
  AccountLeaseId,
  ActionEventId,
  InboxEventId,
  PersistenceWorkerId,
  QuotaReservationId,
  SendReceiptId,
} from "@relanmo/domain/ports/persistence/common";
import {
  INBOX_EVENT_KINDS,
  INBOX_EVENT_STATES,
  OUTBOX_EVENT_STATES,
} from "@relanmo/domain/ports/persistence/events";
import type {
  InboxEventEnvelope,
  InboxEventKind,
  InboxEventScope,
  InboxEventState,
  OutboxEventState,
  OutboxPayload,
} from "@relanmo/domain/ports/persistence/events";
import {
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
} from "drizzle-orm/pg-core";

// Enum column types back the frozen persistence contracts in
// @relanmo/domain/src/ports/persistence/{actions,events}.ts; keep the value
// lists aligned with those exports rather than redeclaring them here.
export const actionStateEnum = pgEnum("action_state", ACTION_STATES);
export const actionFailureReasonEnum = pgEnum(
  "action_failure_reason",
  ACTION_FAILURE_REASONS
);
export const actionUnknownReasonEnum = pgEnum(
  "action_unknown_reason",
  ACTION_UNKNOWN_REASONS
);
export const quotaBucketEnum = pgEnum("quota_bucket", QUOTA_BUCKETS);
export const quotaReservationStateEnum = pgEnum(
  "quota_reservation_state",
  QUOTA_RESERVATION_STATES
);
export const inboxEventKindEnum = pgEnum("inbox_event_kind", INBOX_EVENT_KINDS);
export const inboxEventStateEnum = pgEnum(
  "inbox_event_state",
  INBOX_EVENT_STATES
);
export const outboxEventKindEnum = pgEnum(
  "outbox_event_kind",
  OUTBOX_EVENT_KINDS
);
export const outboxEventStateEnum = pgEnum(
  "outbox_event_state",
  OUTBOX_EVENT_STATES
);

/**
 * Immutable action identity plus its current lifecycle projection. The
 * step-key unique constraint (tenant/account/campaign/prospect/step, without
 * campaignVersionId) is what stops a campaign edit from making a completed
 * step eligible again under a new version.
 */
export const actions = pgTable(
  "actions",
  {
    id: text("id").$type<ActionId>().primaryKey(),
    tenantId: text("tenant_id").$type<TenantId>().notNull(),
    accountId: text("account_id").$type<AccountId>().notNull(),
    prospectId: text("prospect_id").$type<ProspectId>().notNull(),
    campaignId: text("campaign_id").$type<CampaignId>().notNull(),
    campaignVersionId: text("campaign_version_id")
      .$type<CampaignVersionId>()
      .notNull(),
    step: text("step").$type<SequenceStep>().notNull(),
    payload: jsonb("payload").$type<ActionPayload>().notNull(),
    evidenceIds: jsonb("evidence_ids").$type<readonly EvidenceId[]>().notNull(),
    sourceVersions: jsonb("source_versions")
      .$type<DraftSourceVersions>()
      .notNull(),
    createdAt: timestamp("created_at", { mode: "string", withTimezone: true })
      .$type<UtcTimestamp>()
      .notNull(),
    state: actionStateEnum("state").$type<ActionState>().notNull(),
    stateAt: timestamp("state_at", { mode: "string", withTimezone: true })
      .$type<UtcTimestamp>()
      .notNull(),
    attemptId: text("attempt_id").$type<SendAttemptId>(),
    leaseExpiresAt: timestamp("lease_expires_at", {
      mode: "string",
      withTimezone: true,
    }).$type<UtcTimestamp>(),
    leaseFence: integer("lease_fence"),
    providerMessageId: text("provider_message_id"),
    failureReason: actionFailureReasonEnum(
      "failure_reason"
    ).$type<ActionFailureReason | null>(),
    unknownReason: actionUnknownReasonEnum(
      "unknown_reason"
    ).$type<ActionUnknownReason | null>(),
  },
  (table) => [
    unique("actions_step_key").on(
      table.tenantId,
      table.accountId,
      table.campaignId,
      table.prospectId,
      table.step
    ),
    index("actions_identity_idx").on(
      table.tenantId,
      table.accountId,
      table.campaignId,
      table.campaignVersionId,
      table.prospectId,
      table.step
    ),
    index("actions_account_state_idx").on(
      table.tenantId,
      table.accountId,
      table.state
    ),
  ]
);

/** One row per authorized send; append-only, never overwritten by a retry. */
export const sendAttempts = pgTable(
  "send_attempts",
  {
    id: text("id").$type<SendAttemptId>().primaryKey(),
    tenantId: text("tenant_id").$type<TenantId>().notNull(),
    actionId: text("action_id")
      .$type<ActionId>()
      .notNull()
      .references(() => actions.id),
    accountId: text("account_id").$type<AccountId>().notNull(),
    requestId: text("request_id").notNull(),
    fence: integer("fence").notNull(),
    workerId: text("worker_id").$type<PersistenceWorkerId>().notNull(),
    payload: jsonb("payload").$type<ActionPayload>().notNull(),
    sourceVersions: jsonb("source_versions")
      .$type<DraftSourceVersions>()
      .notNull(),
    quotaReservationId: text("quota_reservation_id")
      .$type<QuotaReservationId>()
      .notNull(),
    authorizedAt: timestamp("authorized_at", {
      mode: "string",
      withTimezone: true,
    })
      .$type<UtcTimestamp>()
      .notNull(),
    leaseExpiresAt: timestamp("lease_expires_at", {
      mode: "string",
      withTimezone: true,
    })
      .$type<UtcTimestamp>()
      .notNull(),
  },
  (table) => [
    unique("send_attempts_request_idx").on(table.tenantId, table.requestId),
    index("send_attempts_action_idx").on(table.actionId),
  ]
);

/**
 * The durable, append-only outcome record for a send attempt: CONFIRMED,
 * FAILED and UNKNOWN are all retained here so reconciliation can read an
 * uncertain attempt without it being overwritten by a later resolution.
 */
export const sendReceipts = pgTable(
  "send_receipts",
  {
    id: text("id").$type<SendReceiptId>().primaryKey(),
    tenantId: text("tenant_id").$type<TenantId>().notNull(),
    actionId: text("action_id")
      .$type<ActionId>()
      .notNull()
      .references(() => actions.id),
    attemptId: text("attempt_id")
      .$type<SendAttemptId>()
      .notNull()
      .references(() => sendAttempts.id),
    providerMessageId: text("provider_message_id"),
    failureReason: actionFailureReasonEnum(
      "failure_reason"
    ).$type<ActionFailureReason | null>(),
    unknownReason: actionUnknownReasonEnum(
      "unknown_reason"
    ).$type<ActionUnknownReason | null>(),
    completedAt: timestamp("completed_at", {
      mode: "string",
      withTimezone: true,
    })
      .$type<UtcTimestamp>()
      .notNull(),
    recordedAt: timestamp("recorded_at", {
      mode: "string",
      withTimezone: true,
    })
      .$type<UtcTimestamp>()
      .notNull(),
  },
  (table) => [unique("send_receipts_attempt_idx").on(table.attemptId)]
);

/**
 * The current lease per account. Acquire/renew/release compare `fence`,
 * which is strictly monotonic per account and never resets, so a second
 * worker cannot act under a stale or expired lease.
 */
export const accountLeases = pgTable(
  "account_leases",
  {
    id: text("id").$type<AccountLeaseId>().primaryKey(),
    tenantId: text("tenant_id").$type<TenantId>().notNull(),
    accountId: text("account_id").$type<AccountId>().notNull(),
    owner: text("owner").$type<PersistenceWorkerId>().notNull(),
    fence: integer("fence").notNull(),
    acquiredAt: timestamp("acquired_at", {
      mode: "string",
      withTimezone: true,
    })
      .$type<UtcTimestamp>()
      .notNull(),
    expiresAt: timestamp("expires_at", { mode: "string", withTimezone: true })
      .$type<UtcTimestamp>()
      .notNull(),
  },
  (table) => [
    unique("account_leases_account_idx").on(table.tenantId, table.accountId),
  ]
);

/** One reservation per action/bucket; settlement never releases it blindly. */
export const quotaReservations = pgTable(
  "quota_reservations",
  {
    id: text("id").$type<QuotaReservationId>().primaryKey(),
    tenantId: text("tenant_id").$type<TenantId>().notNull(),
    accountId: text("account_id").$type<AccountId>().notNull(),
    actionId: text("action_id")
      .$type<ActionId>()
      .notNull()
      .references(() => actions.id),
    campaignId: text("campaign_id").$type<CampaignId>().notNull(),
    bucket: quotaBucketEnum("bucket").$type<QuotaBucket>().notNull(),
    state: quotaReservationStateEnum("state")
      .$type<QuotaReservationState>()
      .notNull(),
    units: integer("units").notNull(),
    fence: integer("fence").notNull(),
    periodStart: timestamp("period_start", {
      mode: "string",
      withTimezone: true,
    })
      .$type<UtcTimestamp>()
      .notNull(),
    periodEnd: timestamp("period_end", { mode: "string", withTimezone: true })
      .$type<UtcTimestamp>()
      .notNull(),
    createdAt: timestamp("created_at", { mode: "string", withTimezone: true })
      .$type<UtcTimestamp>()
      .notNull(),
    updatedAt: timestamp("updated_at", { mode: "string", withTimezone: true })
      .$type<UtcTimestamp>()
      .notNull(),
  },
  (table) => [
    unique("quota_reservations_action_bucket_idx").on(
      table.actionId,
      table.bucket
    ),
    index("quota_reservations_account_period_idx").on(
      table.tenantId,
      table.accountId,
      table.bucket,
      table.periodStart,
      table.periodEnd
    ),
  ]
);

/**
 * Durable inbound provider event queue ("webhook_events" in the card).
 * Dedupe is scoped per tenant and provider so two providers can never
 * collide on the same dedupe key. Claim/acknowledge use the worker+fence
 * lease columns so a second worker cannot double-process a leased row.
 */
export const webhookEvents = pgTable(
  "webhook_events",
  {
    id: text("id").$type<InboxEventId>().primaryKey(),
    tenantId: text("tenant_id").$type<TenantId>().notNull(),
    provider: text("provider").notNull(),
    dedupeKey: text("dedupe_key").notNull(),
    kind: inboxEventKindEnum("kind").$type<InboxEventKind>().notNull(),
    state: inboxEventStateEnum("state").$type<InboxEventState>().notNull(),
    scope: jsonb("scope").$type<InboxEventScope>().notNull(),
    envelope: jsonb("envelope").$type<InboxEventEnvelope>().notNull(),
    providerEventId: text("provider_event_id"),
    attempt: integer("attempt").notNull(),
    lastError: text("last_error"),
    leaseWorkerId: text("lease_worker_id").$type<PersistenceWorkerId>(),
    leaseFence: integer("lease_fence"),
    leaseExpiresAt: timestamp("lease_expires_at", {
      mode: "string",
      withTimezone: true,
    }).$type<UtcTimestamp>(),
    observedAt: timestamp("observed_at", {
      mode: "string",
      withTimezone: true,
    })
      .$type<UtcTimestamp>()
      .notNull(),
    receivedAt: timestamp("received_at", {
      mode: "string",
      withTimezone: true,
    })
      .$type<UtcTimestamp>()
      .notNull(),
    availableAt: timestamp("available_at", {
      mode: "string",
      withTimezone: true,
    })
      .$type<UtcTimestamp>()
      .notNull(),
    processedAt: timestamp("processed_at", {
      mode: "string",
      withTimezone: true,
    }).$type<UtcTimestamp>(),
    quarantinedAt: timestamp("quarantined_at", {
      mode: "string",
      withTimezone: true,
    }).$type<UtcTimestamp>(),
  },
  (table) => [
    unique("webhook_events_dedupe_idx").on(
      table.tenantId,
      table.provider,
      table.dedupeKey
    ),
    index("webhook_events_claim_idx").on(
      table.tenantId,
      table.state,
      table.availableAt
    ),
  ]
);

/**
 * Durable transactional outbox ("outbox_events" in the card). A row is
 * enqueued in the same transaction as the state change it describes, then
 * claimed/acknowledged with the same worker+fence lease pattern as the
 * inbox so retries and dead letters stay visible without double delivery.
 */
export const outboxEvents = pgTable(
  "outbox_events",
  {
    id: text("id").$type<OutboxEventId>().primaryKey(),
    tenantId: text("tenant_id").$type<TenantId>().notNull(),
    kind: outboxEventKindEnum("kind").$type<OutboxEventKind>().notNull(),
    state: outboxEventStateEnum("state").$type<OutboxEventState>().notNull(),
    dedupeKey: text("dedupe_key").notNull(),
    payload: jsonb("payload").$type<OutboxPayload>().notNull(),
    attempt: integer("attempt").notNull(),
    lastError: text("last_error"),
    leaseWorkerId: text("lease_worker_id").$type<PersistenceWorkerId>(),
    leaseFence: integer("lease_fence"),
    leaseExpiresAt: timestamp("lease_expires_at", {
      mode: "string",
      withTimezone: true,
    }).$type<UtcTimestamp>(),
    createdAt: timestamp("created_at", { mode: "string", withTimezone: true })
      .$type<UtcTimestamp>()
      .notNull(),
    availableAt: timestamp("available_at", {
      mode: "string",
      withTimezone: true,
    })
      .$type<UtcTimestamp>()
      .notNull(),
  },
  (table) => [
    unique("outbox_events_dedupe_idx").on(table.tenantId, table.dedupeKey),
    index("outbox_events_claim_idx").on(
      table.tenantId,
      table.state,
      table.availableAt
    ),
  ]
);

/**
 * Append-only lifecycle log backing ActionRepository.getEvents, from the
 * persistence actions port in the domain package. Distinct from
 * send_receipts: an event is recorded for every transition (including
 * ACTION_READY/ACTION_IN_FLIGHT, which never produce a receipt).
 */
export const actionEvents = pgTable(
  "action_events",
  {
    id: text("id").$type<ActionEventId>().primaryKey(),
    tenantId: text("tenant_id").$type<TenantId>().notNull(),
    actionId: text("action_id")
      .$type<ActionId>()
      .notNull()
      .references(() => actions.id),
    event: jsonb("event").$type<ActionLifecycleEvent>().notNull(),
    recordedAt: timestamp("recorded_at", {
      mode: "string",
      withTimezone: true,
    })
      .$type<UtcTimestamp>()
      .notNull(),
  },
  (table) => [
    index("action_events_action_idx").on(table.actionId, table.recordedAt),
  ]
);
