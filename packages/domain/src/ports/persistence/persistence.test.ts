import { describe, expect, it } from "vitest";

import type { ActionIdentity } from "../../contracts/action";
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
  parseModelVersion,
  parseProspectId,
  parseSendAttemptId,
  parseTenantId,
  parseUserId,
} from "../../contracts/ids";
import type { OutboxEventId } from "../../contracts/ids";
import type { OutboundMessage } from "../../contracts/message";
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
  AcquireAccountLeaseResult,
  ConfirmedActionRecord,
  AuthorizeSendResult,
  CreateActionResult,
  GetActionByStepInput,
  GetActionByStepResult,
  MarkExpiredUnknownResult,
  QuotaReservationRecord,
  RecordSendOutcomeResult,
  RenewAccountLeaseResult,
  ReleaseAccountLeaseResult,
  SendAuthorizationDenialReason,
  SendAttemptRecord,
  SendReceiptRecord,
  SettleQuotaResult,
} from "./actions";
import { ACCOUNT_LEASE_FENCE_POLICY } from "./actions";
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
  PersistenceResult,
  PersistenceTransaction,
  PersistenceWorkerId,
  QuotaReservationId,
  SendReceiptId,
} from "./common";
import { TENANT_SCOPE_MISMATCH_ERROR, UNKNOWN_OUTCOME_POLICY } from "./common";
import type { StoredMessage, ConversationRecord } from "./conversations";
import type {
  AcknowledgeInboxResult,
  AcknowledgeOutboxResult,
  AtomicReplyStopInput,
  AtomicReplyStopRepository,
  AtomicReplyStopResult,
  CustomerNotificationOutboxEvent,
  EnqueueOutboxResult,
  InboxIncomingEvent,
  InboxEventRecord,
  InboxOutgoingEvent,
  InboxUnrecognizedEvent,
  ManualTakeoverResult,
  QuarantineAccountOutcome,
  QuarantineInboxEventResult,
  RecordInboxEventResult,
  WorkflowStopOutboxEvent,
} from "./events";
import { validateInboxEventScope } from "./events";
import type {
  ClaimBotEligibilityInput,
  ClaimBotEligibilityResult,
  PairOwnershipRecord,
} from "./prospects";

const timestamp = parseUtcTimestamp("2026-09-17T10:00:00.000Z");
const tenantId = parseTenantId("tenant_demo");
const otherTenantId = parseTenantId("tenant_other");
const accountId = parseAccountId("account_demo");
const otherAccountId = parseAccountId("account_other");
const otherConversationId = parseConversationId("conversation_other");
const prospectId = parseProspectId("prospect_demo");
const otherProspectId = parseProspectId("prospect_other");

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

function outgoingBotEchoMessage(): OutboundMessage {
  const message = outgoingBotEchoMessageFixture;
  if (message.direction !== "OUTBOUND") {
    throw new Error("fixture must include an outbound message");
  }
  return message;
}

const incomingInboxEvent: InboxIncomingEvent = {
  canonicalPayloadFingerprint: attachmentOnlyInboundEventFixture.dedupeKey,
  dedupeKey: attachmentOnlyInboundEventFixture.dedupeKey,
  kind: "INCOMING_MESSAGE",
  message: attachmentOnlyInboundEventFixture.message,
  observedAt: attachmentOnlyInboundEventFixture.receivedAt,
  providerEventId: attachmentOnlyInboundEventFixture.message.providerMessageId,
  scope: {
    accountId,
    conversationId: attachmentOnlyInboundEventFixture.message.conversationId,
    prospectId,
    tenantId,
  },
};

const outgoingInboxEvent: InboxOutgoingEvent = {
  canonicalPayloadFingerprint: "canonical-outgoing-bot-echo-1",
  dedupeKey: "provider-event-outgoing-bot-echo-1",
  kind: "OUTGOING_MESSAGE",
  message: outgoingBotEchoMessage(),
  observedAt: timestamp,
  providerEventId: outgoingBotEchoMessage().providerMessageId,
  scope: {
    accountId,
    conversationId: outgoingBotEchoMessage().conversationId,
    prospectId,
    tenantId,
  },
};

const unrecognizedInboxEvent: InboxUnrecognizedEvent = {
  canonicalPayloadFingerprint: "canonical-unrecognized-event-1",
  dedupeKey: "provider-event-unrecognized-1",
  kind: "UNRECOGNIZED",
  message: null,
  observedAt: timestamp,
  providerEventId: null,
  scope: {
    accountId,
    conversationId: null,
    prospectId: null,
    tenantId,
  },
};

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

const firstClaimOwnership: PairOwnershipRecord = {
  accountProspect: parseAccountProspectOwnership({
    accountId,
    ownership: {
      kind: "BOT_ELIGIBLE",
      ownerUserId: null,
      reason: "INITIAL_ACTIVATION",
      recordedAt: timestamp,
    },
    prospectId,
    tenantId,
  }),
  revision: 1,
  updatedAt: timestamp,
};

const inboxEvent: InboxEventRecord = {
  availableAt: timestamp,
  dedupeKey: attachmentOnlyInboundEventFixture.dedupeKey,
  event: incomingInboxEvent,
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

const outgoingInboxRecord: InboxEventRecord = {
  availableAt: timestamp,
  dedupeKey: outgoingInboxEvent.dedupeKey,
  event: outgoingInboxEvent,
  eventId: testPersistenceId<InboxEventId>("inbox_outgoing_1"),
  attempt: 1,
  lastError: null,
  lease: null,
  processedAt: timestamp,
  quarantinedAt: null,
  receivedAt: timestamp,
  state: "PROCESSED",
  tenantId,
};

const unrecognizedInboxRecord: InboxEventRecord = {
  availableAt: timestamp,
  dedupeKey: unrecognizedInboxEvent.dedupeKey,
  event: unrecognizedInboxEvent,
  eventId: testPersistenceId<InboxEventId>("inbox_unrecognized_1"),
  attempt: 1,
  lastError: "UNKNOWN_MAPPING",
  lease: null,
  processedAt: null,
  quarantinedAt: timestamp,
  receivedAt: timestamp,
  state: "QUARANTINED",
  tenantId,
};

function tenantMismatch<Value>(): PersistenceResult<Value> {
  return { error: TENANT_SCOPE_MISMATCH_ERROR, ok: false };
}

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
  it("rejects direct and nested tenant mismatches before repository access", async () => {
    let accessed = 0;
    const tx = testTransaction();
    const repository: Pick<ActionRepository, "create" | "get"> = {
      create: (input, transaction) => {
        if (input.action.tenantId !== transaction.scope.tenantId) {
          return Promise.resolve(tenantMismatch());
        }
        accessed += 1;
        return Promise.resolve({
          ok: true,
          value: {
            action: invitationWithoutNoteActionFixture,
            outcome: "CREATED",
          },
        });
      },
      get: (input, transaction) => {
        if (input.tenantId !== transaction.scope.tenantId) {
          return Promise.resolve(tenantMismatch());
        }
        accessed += 1;
        return Promise.resolve({ ok: true, value: { action: null } });
      },
    };

    const directMismatch = await repository.get(
      {
        actionId: invitationWithoutNoteActionFixture.actionId,
        tenantId: otherTenantId,
      },
      tx
    );
    const nestedMismatch = await repository.create(
      {
        action: {
          ...invitationWithoutNoteActionFixture,
          tenantId: otherTenantId,
        },
      },
      tx
    );

    expect(directMismatch).toEqual({
      error: TENANT_SCOPE_MISMATCH_ERROR,
      ok: false,
    });
    expect(nestedMismatch).toEqual({
      error: TENANT_SCOPE_MISMATCH_ERROR,
      ok: false,
    });
    expect(accessed).toBe(0);
  });

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

  it("keeps immutable payloads and completed steps stable across campaign versions", () => {
    const { payload } = uncertainSendActionFixture;
    if (payload.kind !== "DIRECT_MESSAGE") {
      throw new Error("fixture must include a direct-message payload");
    }
    const attemptedAction = {
      ...uncertainSendActionFixture,
      payload: { ...payload, text: "Changed immutable fixture payload" },
      sourceVersions: {
        ...uncertainSendActionFixture.sourceVersions,
        model: parseModelVersion("claude-sonnet-4-6"),
      },
    } satisfies ActionIdentity;
    const immutableConflict = {
      attemptedAction,
      existingAction: uncertainSendActionFixture,
      outcome: "IMMUTABLE_CONFLICT",
    } satisfies CreateActionResult;
    const lookup: GetActionByStepInput = {
      accountId,
      campaignId: uncertainSendActionFixture.campaignId,
      prospectId,
      step: "DM1",
      tenantId,
    };
    const completedAcrossVersion = {
      action: confirmedBotEchoAction(),
    } satisfies GetActionByStepResult;

    expect(immutableConflict.attemptedAction.actionId).toBe(
      immutableConflict.existingAction.actionId
    );
    expect(immutableConflict.attemptedAction.payload).not.toEqual(
      immutableConflict.existingAction.payload
    );
    expect(immutableConflict.outcome).toBe("IMMUTABLE_CONFLICT");
    expect(lookup.campaignId).toBe(completedAcrossVersion.action.campaignId);
    expect(completedAcrossVersion.action.state).toBe("CONFIRMED");
    expect(completedAcrossVersion.action.campaignVersionId).not.toBe(
      parseCampaignVersionId("campaign_version_alpha_2")
    );
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

  it("returns a stale ownership revision instead of accepting a concurrent bot claim", () => {
    const conflict: ClaimBotEligibilityResult = {
      current: pairOwnership,
      expectedRevision: 1,
      outcome: "REVISION_CONFLICT",
    };
    const laterCampaignClaim: ClaimBotEligibilityResult = {
      outcome: "HUMAN_OWNED",
      ownership: pairOwnership,
    };

    expect(conflict.current.revision).toBe(2);
    expect(conflict.expectedRevision).not.toBe(conflict.current.revision);
    expect(laterCampaignClaim.ownership.accountProspect).toEqual(
      conflict.current.accountProspect
    );
  });

  it("represents the concurrent first-claim race from a null expected revision", () => {
    const firstClaimInput: ClaimBotEligibilityInput = {
      accountId,
      campaignId: parseCampaignId("campaign_alpha"),
      expectedRevision: null,
      prospectId,
      recordedAt: timestamp,
      tenantId,
    };
    const secondClaimInput = {
      ...firstClaimInput,
      campaignId: parseCampaignId("campaign_beta"),
    } satisfies ClaimBotEligibilityInput;
    const firstClaim: ClaimBotEligibilityResult = {
      outcome: "CLAIMED",
      ownership: firstClaimOwnership,
    };
    const secondClaim: ClaimBotEligibilityResult = {
      current: firstClaimOwnership,
      expectedRevision: secondClaimInput.expectedRevision,
      outcome: "REVISION_CONFLICT",
    };

    expect(firstClaimInput.expectedRevision).toBeNull();
    expect(secondClaimInput.expectedRevision).toBeNull();
    expect(firstClaim.outcome).toBe("CLAIMED");
    expect(secondClaim.current.revision).toBe(1);
    expect(secondClaim.expectedRevision).toBeNull();
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
      event: incomingInboxEvent,
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

  it("quarantines an unrecognized envelope with bounded evidence and an account hold", () => {
    const result: QuarantineInboxEventResult = {
      accountId,
      event: unrecognizedInboxRecord,
      holdAccount: true,
      outcome: "QUARANTINED",
      reason: "UNKNOWN_MAPPING",
    };

    expect(result.event.event.kind).toBe("UNRECOGNIZED");
    expect(result.event.event.message).toBeNull();
    expect(result.event.event.canonicalPayloadFingerprint).toBe(
      "canonical-unrecognized-event-1"
    );
    expect(result.holdAccount).toBe(true);
  });

  it("quarantines every normalized scope/message identity mismatch", () => {
    const mismatchedAccount: InboxIncomingEvent = {
      ...incomingInboxEvent,
      scope: { ...incomingInboxEvent.scope, accountId: otherAccountId },
    };
    const mismatchedProspect: InboxIncomingEvent = {
      ...incomingInboxEvent,
      scope: { ...incomingInboxEvent.scope, prospectId: otherProspectId },
    };
    const mismatchedConversation: InboxIncomingEvent = {
      ...incomingInboxEvent,
      scope: {
        ...incomingInboxEvent.scope,
        conversationId: otherConversationId,
      },
    };
    const mismatchedOutgoing: InboxOutgoingEvent = {
      ...outgoingInboxEvent,
      scope: { ...outgoingInboxEvent.scope, prospectId: otherProspectId },
    };
    const mismatchCases = [
      { event: mismatchedAccount, field: "accountId" },
      { event: mismatchedProspect, field: "prospectId" },
      { event: mismatchedConversation, field: "conversationId" },
    ] as const;

    for (const { event, field } of mismatchCases) {
      const validation = validateInboxEventScope(event);
      expect(validation.valid).toBe(false);
      if (validation.valid) {
        continue;
      }
      expect(validation.mismatches).toContain(field);
    }

    const quarantined: QuarantineInboxEventResult = {
      accountId,
      event: {
        ...inboxEvent,
        event: mismatchedAccount,
        processedAt: null,
        quarantinedAt: timestamp,
        state: "QUARANTINED",
      },
      holdAccount: true,
      outcome: "QUARANTINED",
      reason: "IDENTITY_MISMATCH",
    };
    const noKnownAccount: QuarantineAccountOutcome = {
      accountId: null,
      holdAccount: false,
    };
    const manualQuarantine: ManualTakeoverResult = {
      accountId,
      event: { ...outgoingInboxRecord, event: mismatchedOutgoing },
      holdAccount: true,
      outcome: "QUARANTINED",
      reason: "IDENTITY_MISMATCH",
    };

    expect(quarantined.reason).toBe("IDENTITY_MISMATCH");
    expect(quarantined.accountId).toBe(accountId);
    expect(quarantined.holdAccount).toBe(true);
    expect(noKnownAccount.holdAccount).toBe(false);
    expect(manualQuarantine.outcome).toBe("QUARANTINED");
  });

  it("makes bot echoes, owner takeovers and inconclusive matches distinct", () => {
    const action = confirmedBotEchoAction();
    const echo: ManualTakeoverResult = {
      event: outgoingInboxRecord,
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
      event: outgoingInboxRecord,
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

  it("deduplicates incoming, outgoing and outbox redeliveries", () => {
    const duplicateIncoming: RecordInboxEventResult = {
      event: inboxEvent,
      outcome: "DUPLICATE",
    };
    const duplicateOutgoingEcho: ManualTakeoverResult = {
      event: outgoingInboxRecord,
      outcome: "DUPLICATE",
      priorOutcome: "BOT_ECHO_CONFIRMED",
    };
    const duplicateOwnerTakeover: ManualTakeoverResult = {
      event: outgoingInboxRecord,
      outcome: "DUPLICATE",
      priorOutcome: "TAKEN_OVER",
    };
    const duplicateOutbox: EnqueueOutboxResult = {
      event: stopOutboxEvent,
      outcome: "DUPLICATE",
    };
    const acknowledgedInbox: AcknowledgeInboxResult = {
      event: inboxEvent,
      outcome: "ALREADY_PROCESSED",
    };
    const acknowledgedOutbox: AcknowledgeOutboxResult = {
      event: stopOutboxEvent,
      outcome: "ALREADY_DELIVERED",
    };

    expect(duplicateIncoming.event.event.dedupeKey).toBe(
      incomingInboxEvent.dedupeKey
    );
    expect(duplicateOutgoingEcho.priorOutcome).toBe("BOT_ECHO_CONFIRMED");
    expect(duplicateOwnerTakeover.priorOutcome).toBe("TAKEN_OVER");
    expect(duplicateOutbox.event.eventId).toBe(stopOutboxEvent.eventId);
    expect(acknowledgedInbox.outcome).toBe("ALREADY_PROCESSED");
    expect(acknowledgedOutbox.outcome).toBe("ALREADY_DELIVERED");
  });

  it("makes reply-stop commit ordering and all authorization holds explicit", () => {
    const denialAfterReply: AuthorizeSendResult = {
      action: invitationWithoutNoteActionFixture,
      observedAt: timestamp,
      outcome: "DENIED",
      reason: "HUMAN_OWNED",
    };
    const denialAfterEntitlementRemoval: AuthorizeSendResult = {
      action: invitationWithoutNoteActionFixture,
      observedAt: timestamp,
      outcome: "DENIED",
      reason: "ENTITLEMENT_UNAVAILABLE",
    };
    const denialAfterStyleChange: AuthorizeSendResult = {
      action: invitationWithoutNoteActionFixture,
      observedAt: timestamp,
      outcome: "DENIED",
      reason: "STALE_VERSION",
    };
    const denialReasons = [
      "ACTION_NOT_READY",
      "ACCOUNT_UNHEALTHY",
      "CAMPAIGN_INACTIVE",
      "ENTITLEMENT_UNAVAILABLE",
      "HUMAN_OWNED",
      "INCOMING_MESSAGE",
      "LEASE_UNAVAILABLE",
      "NOT_DUE",
      "OUTSIDE_SEND_WINDOW",
      "QUOTA_UNAVAILABLE",
      "RECONCILIATION_REQUIRED",
      "STALE_VERSION",
      "SUPPRESSED",
      "UNKNOWN_SEND",
    ] satisfies readonly SendAuthorizationDenialReason[];

    expect(atomicStopResult.outcome).toBe("STOPPED");
    expect(denialAfterReply.reason).toBe("HUMAN_OWNED");
    expect(denialAfterEntitlementRemoval.reason).toBe(
      "ENTITLEMENT_UNAVAILABLE"
    );
    expect(denialAfterStyleChange.reason).toBe("STALE_VERSION");
    expect(denialReasons).toHaveLength(14);
  });

  it("retains quota for an unknown outcome and makes blind retry policy explicit", () => {
    const reservation: QuotaReservationRecord = {
      accountId,
      actionId: uncertainSendActionFixture.actionId,
      bucket: "MESSAGES",
      campaignId: uncertainSendActionFixture.campaignId,
      createdAt: timestamp,
      fence: 7,
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
    const contradictoryReceipt: RecordSendOutcomeResult = {
      action: uncertainSendActionFixture,
      existingReceipt: receipt,
      outcome: "CONFLICTING_RECEIPT",
      reservation,
    };

    expect(result.reservation.state).toBe("RETAINED_UNKNOWN");
    expect(contradictoryReceipt.outcome).toBe("CONFLICTING_RECEIPT");
    expect(UNKNOWN_OUTCOME_POLICY.releaseQuota).toBe(false);
    expect(UNKNOWN_OUTCOME_POLICY.retryWithoutReconciliation).toBe(false);
  });
});

describe("lease, quota and uncertain-send safety contracts", () => {
  it("uses increasing reacquisition fences and rejects stale settlement", () => {
    const firstLease: AccountLeaseRecord = {
      accountId,
      acquiredAt: timestamp,
      expiresAt: timestamp,
      fence: 7,
      leaseId: testPersistenceId<AccountLeaseId>("lease_worker_a"),
      owner: testPersistenceId<PersistenceWorkerId>("worker_a"),
      tenantId,
    };
    const secondLease: AccountLeaseRecord = {
      ...firstLease,
      fence: 8,
      leaseId: testPersistenceId<AccountLeaseId>("lease_worker_b"),
      owner: testPersistenceId<PersistenceWorkerId>("worker_b"),
    };
    const firstAcquisition = {
      lease: firstLease,
      outcome: "ACQUIRED",
    } satisfies AcquireAccountLeaseResult;
    const secondAcquisition = {
      lease: secondLease,
      outcome: "ACQUIRED",
    } satisfies AcquireAccountLeaseResult;
    const staleRenew: RenewAccountLeaseResult = {
      current: secondLease,
      outcome: "FENCE_MISMATCH",
    };
    const staleRelease: ReleaseAccountLeaseResult = {
      outcome: "FENCE_MISMATCH",
    };
    const retainedReservation: QuotaReservationRecord = {
      accountId,
      actionId: uncertainSendActionFixture.actionId,
      bucket: "MESSAGES",
      campaignId: uncertainSendActionFixture.campaignId,
      createdAt: timestamp,
      fence: secondLease.fence,
      periodEnd: parseUtcTimestamp("2026-09-18T00:00:00.000Z"),
      periodStart: timestamp,
      reservationId: testPersistenceId<QuotaReservationId>(
        "quota_stale_fence_1"
      ),
      state: "RETAINED_UNKNOWN",
      tenantId,
      units: 1,
      updatedAt: timestamp,
    };
    const staleOutcome: RecordSendOutcomeResult = {
      action: uncertainSendActionFixture,
      outcome: "STALE_FENCE",
      reservation: retainedReservation,
    };
    const staleSettlement: SettleQuotaResult = {
      outcome: "FENCE_MISMATCH",
      reservation: retainedReservation,
    };
    const unknownAfterExpiry: MarkExpiredUnknownResult = {
      action: uncertainSendActionFixture,
      outcome: "ALREADY_UNKNOWN",
      reservation: retainedReservation,
    };

    expect(ACCOUNT_LEASE_FENCE_POLICY.monotonicPerAccount).toBe(true);
    expect(secondAcquisition.lease.fence).toBeGreaterThan(
      firstAcquisition.lease.fence
    );
    expect(staleRenew.outcome).toBe("FENCE_MISMATCH");
    expect(staleRelease.outcome).toBe("FENCE_MISMATCH");
    expect(staleOutcome.outcome).toBe("STALE_FENCE");
    expect(staleSettlement.outcome).toBe("FENCE_MISMATCH");
    expect(unknownAfterExpiry.reservation.state).toBe("RETAINED_UNKNOWN");
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
      fence: 4,
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
    const secondWorker: AuthorizeSendResult = {
      action,
      attempt,
      outcome: "ALREADY_IN_FLIGHT",
    };
    const pair: AccountProspectKey = { accountId, prospectId, tenantId };

    expect(actionRepository.create).toBeTypeOf("function");
    expect(authorization.outcome).toBe("AUTHORIZED");
    expect(authorization.authorized.action.state).toBe("IN_FLIGHT");
    expect(authorization.authorized.reservation.state).toBe("HELD");
    expect(secondWorker.outcome).toBe("ALREADY_IN_FLIGHT");
    expect(pair.tenantId).toBe(tenantId);
  });
});
