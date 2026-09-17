import { describe, expect, it } from "vitest";

import {
  attachmentOnlyInboundEventFixture,
  attachmentOnlyInboundMessageFixture,
  eligibilityCheckFixture,
  invitationWithoutNoteActionFixture,
  outgoingBotEchoMessageFixture,
  uncertainSendActionFixture,
} from "../../contracts/fixtures";
import {
  parseAccountId,
  parseActionId,
  parseCampaignId,
  parseCampaignVersionId,
  parseConversationId,
  parseMessageId,
  parseProspectId,
  parseSendAttemptId,
  parseTenantId,
  parseUserId,
} from "../../contracts/ids";
import type { OutboxEventId } from "../../contracts/ids";
import {
  parseAccountProspectOwnership,
  parseAction,
} from "../../contracts/parsers";
import {
  DEFAULT_BUSINESS_WINDOW_CONFIGURATION,
  DEFAULT_SEQUENCE_PLAN,
  parseUtcTimestamp,
} from "../../contracts/values";
import { workflowIdFor } from "../../contracts/workflow";
import type {
  AccountLeaseRecord,
  ActionRepository,
  ConfirmedActionRecord,
  AuthorizeSendResult,
  CreateActionResult,
  QuotaReservationRecord,
  RecordSendOutcomeResult,
  SendAttemptRecord,
  SendReceiptRecord,
} from "./actions";
import type {
  CampaignDefinition,
  SaveCampaignVersionInput,
  SaveCampaignVersionResult,
} from "./campaigns";
import type {
  AccountLeaseId,
  AccountProspectKey,
  CurrentVersionGuard,
  InboxEventId,
  PersistenceConnectionId,
  PersistenceTransaction,
  PersistenceWorkerId,
  QuotaReservationId,
  SendReceiptId,
} from "./common";
import { UNKNOWN_OUTCOME_POLICY } from "./common";
import type { StoredMessage, ConversationRecord } from "./conversations";
import type {
  AtomicReplyStopInput,
  AtomicReplyStopRepository,
  AtomicReplyStopResult,
  CustomerNotificationOutboxEvent,
  InboxEventRecord,
  ManualTakeoverResult,
  WorkflowStopOutboxEvent,
} from "./events";
import type {
  ClaimBotEligibilityResult,
  PairOwnershipRecord,
} from "./prospects";

const timestamp = parseUtcTimestamp("2026-09-17T10:00:00.000Z");
const tenantId = parseTenantId("tenant_demo");
const accountId = parseAccountId("account_demo");
const prospectId = parseProspectId("prospect_demo");

function testPersistenceId<Id extends string>(value: string): Id {
  // SAFETY: Synthetic test IDs are deliberately scoped to this fixture and never reach production storage.
  return value as Id;
}

function testTransaction(): PersistenceTransaction {
  // Test-only context: production code receives this value only from the runner.
  // SAFETY: This synthetic context models the runner-created single-connection token in consumer tests.
  return {
    connectionId: testPersistenceId<PersistenceConnectionId>("connection_test"),
    isolationLevel: "SERIALIZABLE",
    scope: {
      principal: {
        kind: "WORKER",
        workerId: testPersistenceId<PersistenceWorkerId>("worker_test"),
      },
      requestId: "request_test",
      tenantId,
    },
  } as PersistenceTransaction;
}

const pairOwnership: PairOwnershipRecord = {
  accountProspect: parseAccountProspectOwnership({
    accountId,
    ownership: {
      kind: "HUMAN_OWNED",
      ownerUserId: "user_demo",
      reason: "INCOMING_MESSAGE",
      recordedAt: timestamp,
    },
    prospectId,
    tenantId,
  }),
  revision: 2,
  updatedAt: timestamp,
};

const inboxEvent: InboxEventRecord = {
  dedupeKey: attachmentOnlyInboundEventFixture.dedupeKey,
  event: attachmentOnlyInboundEventFixture,
  eventId: testPersistenceId<InboxEventId>("inbox_attachment_1"),
  attempt: 0,
  lastError: null,
  lease: null,
  processedAt: timestamp,
  quarantinedAt: null,
  receivedAt: timestamp,
  state: "PROCESSED",
  tenantId,
};

const storedAttachmentMessage: StoredMessage = {
  dedupeKey: attachmentOnlyInboundEventFixture.dedupeKey,
  message: attachmentOnlyInboundMessageFixture,
  recordedAt: timestamp,
};

function confirmedBotEchoAction(): ConfirmedActionRecord {
  const action = parseAction({
    ...uncertainSendActionFixture,
    failureReason: null,
    lease: null,
    providerMessageId: outgoingBotEchoMessageFixture.providerMessageId,
    state: "CONFIRMED",
    unknownReason: null,
  });
  if (action.state !== "CONFIRMED") {
    throw new Error("fixture must include a confirmed action");
  }
  return action;
}

const conversation: ConversationRecord = {
  accountId,
  conversationId: parseConversationId("conversation_demo"),
  createdAt: timestamp,
  humanOwnedAt: timestamp,
  lastIncomingAt: timestamp,
  lastMessageAt: timestamp,
  ownership: pairOwnership.accountProspect.ownership,
  prospectId,
  status: "ACTIVE",
  tenantId,
  updatedAt: timestamp,
};

const stopOutboxEvent: WorkflowStopOutboxEvent = {
  availableAt: timestamp,
  attempt: 0,
  createdAt: timestamp,
  dedupeKey: "stop:message_inbound_attachment",
  eventId: testPersistenceId<OutboxEventId>("outbox_stop_1"),
  kind: "STOP_WORKFLOW",
  lastError: null,
  lease: null,
  payload: {
    accountId,
    conversationId: parseConversationId("conversation_demo"),
    messageId: parseMessageId("message_inbound_attachment"),
    prospectId,
    reason: "INCOMING_MESSAGE",
    targetWorkflowId: workflowIdFor({
      accountId,
      campaignId: parseCampaignId("campaign_alpha"),
      kind: "PROSPECT_SEQUENCE",
      prospectId,
      tenantId,
    }),
    tenantId,
    type: "STOP_WORKFLOW",
  },
  state: "PENDING",
  tenantId,
};

const notificationOutboxEvent: CustomerNotificationOutboxEvent = {
  availableAt: timestamp,
  attempt: 0,
  createdAt: timestamp,
  dedupeKey: "notify:message_inbound_attachment",
  eventId: testPersistenceId<OutboxEventId>("outbox_notify_1"),
  kind: "NOTIFY_CUSTOMER",
  lastError: null,
  lease: null,
  payload: {
    messageId: parseMessageId("message_inbound_attachment"),
    recipientUserId: parseUserId("user_demo"),
    template: "INCOMING_MESSAGE",
    tenantId,
    type: "NOTIFY_CUSTOMER",
  },
  state: "PENDING",
  tenantId,
};

const atomicStopResult: AtomicReplyStopResult = {
  conversation,
  inboxEvent,
  invalidatedActionIds: [parseActionId("action_dm1_ready")],
  message: storedAttachmentMessage,
  outboxEvents: [stopOutboxEvent, notificationOutboxEvent],
  outcome: "STOPPED",
  ownership: pairOwnership,
};

/**
 * This fake is intentionally tiny and test-only. It proves consumers pass a
 * single transaction to the aggregate operation; it cannot prove database
 * locking, isolation or multi-replica concurrency correctness.
 */
interface ConsumerAtomicReplyFixture {
  calls: { input: AtomicReplyStopInput; tx: PersistenceTransaction }[];
  repository: AtomicReplyStopRepository;
}

function consumerAtomicReplyFake() {
  const calls: {
    input: AtomicReplyStopInput;
    tx: PersistenceTransaction;
  }[] = [];
  const repository: AtomicReplyStopRepository = {
    recordManualTakeover: (_input, _tx) =>
      Promise.reject(new Error("not used by this scenario")),
    stopIncoming: (input, tx) => {
      calls.push({ input, tx });
      return Promise.resolve({ ok: true, value: atomicStopResult });
    },
  };
  return { calls, repository } satisfies ConsumerAtomicReplyFixture;
}

describe("persistence identity and revision contracts", () => {
  it("represents duplicate actions without creating a second logical step", () => {
    const created = {
      action: invitationWithoutNoteActionFixture,
      outcome: "CREATED",
    } satisfies CreateActionResult;
    const duplicate = {
      action: invitationWithoutNoteActionFixture,
      outcome: "ALREADY_EXISTS",
    } satisfies CreateActionResult;

    expect(created.action.actionId).toBe(duplicate.action.actionId);
    expect(duplicate.outcome).toBe("ALREADY_EXISTS");
  });

  it("keeps one human owner for the account/prospect pair across campaigns", () => {
    const result = {
      outcome: "HUMAN_OWNED",
      ownership: pairOwnership,
    } satisfies ClaimBotEligibilityResult;

    expect(result.ownership.accountProspect.ownership.kind).toBe("HUMAN_OWNED");
    expect(result.ownership.accountProspect.tenantId).toBe(tenantId);
    expect(result.ownership.accountProspect.accountId).toBe(accountId);
    expect(result.ownership.accountProspect.prospectId).toBe(prospectId);
  });

  it("uses the same current-version guard for optimistic mutation and authorization", () => {
    const {
      snapshot: {
        versions: { current },
      },
    } = eligibilityCheckFixture;
    const { campaign: currentCampaign } = current;
    if (currentCampaign === null) {
      throw new Error("fixture must include a current campaign version");
    }
    const guard = { expected: current } satisfies CurrentVersionGuard;
    const definition = {
      businessWindow: DEFAULT_BUSINESS_WINDOW_CONFIGURATION,
      exclusions: [],
      dailyInvitationQuota: 10,
      dailyMessageQuota: 10,
      icpDescription: "Synthetic fixture",
      name: "Fixture campaign",
      sequenceClosure: {
        minimumDaysAfterDelayedDm5: 7,
        minimumDaysAfterDm1: 21,
      },
      sequencePlan: DEFAULT_SEQUENCE_PLAN,
    } satisfies CampaignDefinition;
    const mutation: SaveCampaignVersionInput = {
      campaignId: parseCampaignId("campaign_alpha"),
      createdAt: timestamp,
      createdBy: parseUserId("user_demo"),
      definition,
      expectedCurrent: guard,
      tenantId,
      versionId: parseCampaignVersionId("campaign_version_alpha_2"),
    };
    const conflict = {
      actual: {
        ...current,
        campaign: {
          ...currentCampaign,
          id: parseCampaignVersionId("campaign_version_beta_1"),
        },
      },
      expected: mutation.expectedCurrent.expected,
      outcome: "REVISION_CONFLICT",
    } satisfies SaveCampaignVersionResult;

    expect(conflict.outcome).toBe("REVISION_CONFLICT");
    expect(conflict.actual.campaign?.id).not.toBe(
      conflict.expected.campaign?.id
    );
  });
});

describe("atomic reply-stop and delivery safety contracts", () => {
  it("persists an attachment-only message and its stop outbox event in one aggregate call", async () => {
    const { calls, repository } = consumerAtomicReplyFake();
    const tx = testTransaction();
    const input: AtomicReplyStopInput = {
      event: attachmentOnlyInboundEventFixture,
      eventId: inboxEvent.eventId,
      stoppedAt: timestamp,
      tenantId,
    };
    const result = await repository.stopIncoming(input, tx);

    expect(calls[0]?.tx).toBe(tx);
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    if (result.value.outcome !== "STOPPED") {
      return;
    }
    expect(result.value.outcome).toBe("STOPPED");
    expect(result.value.message.message.text).toBeNull();
    expect(result.value.message.message.attachments).toHaveLength(1);
    expect(result.value.invalidatedActionIds).toContain("action_dm1_ready");
    expect(result.value.outboxEvents).toHaveLength(2);
    expect(result.value.outboxEvents[0]?.payload.type).toBe("STOP_WORKFLOW");
  });

  it("makes bot echoes, owner takeovers and inconclusive matches distinct", () => {
    const action = confirmedBotEchoAction();
    const echo: ManualTakeoverResult = {
      match: {
        action,
        attempt: {
          accountId,
          actionId: uncertainSendActionFixture.actionId,
          attemptId: parseSendAttemptId("attempt_dm1_1"),
          authorizedAt: timestamp,
          fence: 1,
          leaseExpiresAt: timestamp,
          payload: action.payload,
          requestId: "request_send_1",
          quotaReservationId: testPersistenceId<QuotaReservationId>("quota_1"),
          sourceVersions: action.sourceVersions,
          tenantId,
          workerId: testPersistenceId<PersistenceWorkerId>("worker_test"),
        },
      },
      message: {
        dedupeKey: "echo_1",
        message: outgoingBotEchoMessageFixture,
        recordedAt: timestamp,
      },
      outcome: "BOT_ECHO_CONFIRMED",
    };
    const held: ManualTakeoverResult = {
      accountId,
      holdAccount: true,
      message: echo.message,
      outboxEvents: [notificationOutboxEvent],
      outcome: "HELD_FOR_RECONCILIATION",
      reason: "INCONCLUSIVE_BOT_ECHO",
    };

    expect(echo.outcome).toBe("BOT_ECHO_CONFIRMED");
    expect(held.outcome).toBe("HELD_FOR_RECONCILIATION");
    expect(held.reason).toBe("INCONCLUSIVE_BOT_ECHO");
  });

  it("retains quota for an unknown outcome and makes blind retry policy explicit", () => {
    const reservation: QuotaReservationRecord = {
      accountId,
      actionId: uncertainSendActionFixture.actionId,
      bucket: "MESSAGES",
      campaignId: uncertainSendActionFixture.campaignId,
      createdAt: timestamp,
      periodEnd: parseUtcTimestamp("2026-09-18T00:00:00.000Z"),
      periodStart: timestamp,
      reservationId: testPersistenceId<QuotaReservationId>("quota_unknown_1"),
      state: "RETAINED_UNKNOWN",
      tenantId,
      units: 1,
      updatedAt: timestamp,
    };
    const receipt: SendReceiptRecord = {
      actionId: uncertainSendActionFixture.actionId,
      attemptId: parseSendAttemptId("attempt_dm1_1"),
      completedAt: timestamp,
      failureReason: null,
      providerMessageId: null,
      receiptId: testPersistenceId<SendReceiptId>("receipt_unknown_1"),
      recordedAt: timestamp,
      tenantId,
      unknownReason: "TIMEOUT",
    };
    const result: RecordSendOutcomeResult = {
      action: uncertainSendActionFixture,
      outcome: "RECORDED",
      receipt,
      reservation,
    };

    expect(result.reservation.state).toBe("RETAINED_UNKNOWN");
    expect(UNKNOWN_OUTCOME_POLICY.releaseQuota).toBe(false);
    expect(UNKNOWN_OUTCOME_POLICY.retryWithoutReconciliation).toBe(false);
  });
});

describe("port-shape checks", () => {
  it("keeps aggregate repositories transaction-bound and results explicit", () => {
    const actionRepository: Pick<ActionRepository, "create"> = {
      create: (_input, _tx) =>
        Promise.resolve({
          ok: true,
          value: {
            action: invitationWithoutNoteActionFixture,
            outcome: "ALREADY_EXISTS",
          },
        }),
    };
    const action = parseAction({
      ...invitationWithoutNoteActionFixture,
      actionId: parseActionId("action_invitation_inflight"),
      attemptId: parseSendAttemptId("attempt_invitation_1"),
      lease: { expiresAt: timestamp, fence: 4 },
      state: "IN_FLIGHT",
    });
    if (action.state !== "IN_FLIGHT") {
      throw new Error("fixture must include an in-flight action");
    }
    const lease: AccountLeaseRecord = {
      accountId,
      acquiredAt: timestamp,
      expiresAt: timestamp,
      fence: 4,
      leaseId: testPersistenceId<AccountLeaseId>("lease_4"),
      owner: testPersistenceId<PersistenceWorkerId>("worker_test"),
      tenantId,
    };
    const reservation: QuotaReservationRecord = {
      accountId,
      actionId: action.actionId,
      bucket: "INVITATIONS",
      campaignId: action.campaignId,
      createdAt: timestamp,
      periodEnd: timestamp,
      periodStart: timestamp,
      reservationId: testPersistenceId<QuotaReservationId>("quota_4"),
      state: "HELD",
      tenantId,
      units: 1,
      updatedAt: timestamp,
    };
    const attempt: SendAttemptRecord = {
      accountId,
      actionId: action.actionId,
      attemptId: parseSendAttemptId("attempt_invitation_1"),
      authorizedAt: timestamp,
      fence: 4,
      leaseExpiresAt: timestamp,
      payload: action.payload,
      quotaReservationId: reservation.reservationId,
      requestId: "request_invitation_1",
      sourceVersions: action.sourceVersions,
      tenantId,
      workerId: testPersistenceId<PersistenceWorkerId>("worker_test"),
    };
    const authorization: AuthorizeSendResult = {
      authorized: { action, attempt, lease, reservation },
      outcome: "AUTHORIZED",
    };
    const pair: AccountProspectKey = { accountId, prospectId, tenantId };

    expect(actionRepository.create).toBeTypeOf("function");
    expect(authorization.outcome).toBe("AUTHORIZED");
    expect(authorization.authorized.action.state).toBe("IN_FLIGHT");
    expect(authorization.authorized.reservation.state).toBe("HELD");
    expect(pair.tenantId).toBe(tenantId);
  });
});
