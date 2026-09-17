import { describe, expect, it } from "vitest";

import {
  attachmentOnlyInboundEventFixture,
  attachmentOnlyInboundMessageFixture,
  campaignChangeOwnershipContinuityFixture,
  defaultSequencePlanFixture,
  invitationWithoutNoteActionFixture,
  outgoingBotEchoMessageFixture,
  uncertainSendActionFixture,
} from "./fixtures.js";
import {
  parseAccountId,
  parseBatchId,
  parseCampaignId,
  parseProspectId,
  parseTenantId,
} from "./ids.js";
import {
  parseAction,
  parseActionLifecycleEvent,
  parseActivityInput,
  parseActivityResult,
  parseDuePlan,
  parseEligibilityResult,
  parseEvidence,
  parseIncomingMessageEvent,
  parseMessage,
  parseWorkflowIdentity,
  parseWorkflowSignal,
  safeParseAction,
  safeParseMessage,
} from "./parsers.js";
import { DEFAULT_SEQUENCE_CLOSURE } from "./values.js";
import { WORKFLOW_ACTIVITY_NAMES, workflowIdFor } from "./workflow.js";

const timestamp = "2026-09-17T10:00:00.000Z";

describe("domain contract fixtures", () => {
  it("parses attachment-only inbound messages before any classification", () => {
    expect(attachmentOnlyInboundMessageFixture.text).toBeNull();
    expect(attachmentOnlyInboundMessageFixture.attachments).toHaveLength(1);
    expect(attachmentOnlyInboundEventFixture.message.direction).toBe("INBOUND");
    expect(Object.isFrozen(attachmentOnlyInboundMessageFixture)).toBe(true);
    expect(safeParseMessage(attachmentOnlyInboundMessageFixture).success).toBe(
      true
    );
  });

  it("keeps provider bot echoes distinct from inbound prospect messages", () => {
    expect(outgoingBotEchoMessageFixture.direction).toBe("OUTBOUND");
    expect(outgoingBotEchoMessageFixture.actor).toBe("BOT");
    expect(safeParseMessage(outgoingBotEchoMessageFixture).success).toBe(true);

    const invalidIncomingEvent = {
      ...attachmentOnlyInboundEventFixture,
      message: {
        ...outgoingBotEchoMessageFixture,
        direction: "OUTBOUND",
      },
    };
    expect(() => parseIncomingMessageEvent(invalidIncomingEvent)).toThrow();
  });

  it("keeps uncertain sends blocked and rejects inconsistent lifecycle fields", () => {
    expect(uncertainSendActionFixture.state).toBe("UNKNOWN");
    expect(uncertainSendActionFixture.unknownReason).toBe("TIMEOUT");
    expect(uncertainSendActionFixture.providerMessageId).toBeNull();
    expect(safeParseAction(uncertainSendActionFixture).success).toBe(true);

    const invalidConfirmedAction = {
      ...uncertainSendActionFixture,
      providerMessageId: null,
      state: "CONFIRMED",
      unknownReason: null,
    };
    expect(() => parseAction(invalidConfirmedAction)).toThrow();
  });

  it("preserves invitation-without-note and bounded DM1-DM5 defaults", () => {
    expect(invitationWithoutNoteActionFixture.payload).toEqual({
      kind: "INVITATION_WITHOUT_NOTE",
      note: null,
      step: "INVITATION",
    });
    expect(defaultSequencePlanFixture.map((item) => item.step)).toEqual([
      "INVITATION",
      "DM1",
      "DM2",
      "DM3",
      "DM4",
      "DM5",
    ]);
    expect(
      defaultSequencePlanFixture.map(
        (item) => item.targetOffsetFromAcceptanceDays
      )
    ).toEqual([null, 0, 2, 5, 9, 14]);
    expect(DEFAULT_SEQUENCE_CLOSURE).toEqual({
      minimumDaysAfterDelayedDm5: 7,
      minimumDaysAfterDm1: 21,
    });
  });

  it("keeps human ownership scoped to the account/prospect pair across campaigns", () => {
    const continuity = campaignChangeOwnershipContinuityFixture;
    expect(continuity.accountProspect.ownership.kind).toBe("HUMAN_OWNED");
    expect(continuity.fromCampaignId).not.toBe(continuity.toCampaignId);
    expect(continuity.accountProspect.ownership.reason).toBe(
      "INCOMING_MESSAGE"
    );
  });

  it("rejects non-UTC timestamps and empty due plans", () => {
    expect(() =>
      parseDuePlan({
        businessTimeZone: "Europe/Paris",
        closureAt: null,
        earliestAt: "2026-09-17T10:00:00+02:00",
        intendedAt: timestamp,
        step: "DM1",
      })
    ).toThrow();

    expect(() =>
      parseMessage({
        accountId: "account_demo",
        actor: "PROSPECT",
        attachments: [],
        conversationId: "conversation_demo",
        direction: "INBOUND",
        messageId: "message_empty",
        occurredAt: timestamp,
        prospectId: "prospect_demo",
        providerMessageId: null,
        receivedAt: timestamp,
        source: "PROVIDER_EVENT",
        tenantId: "tenant_demo",
        text: null,
      })
    ).toThrow();
  });

  it("requires evidence provenance instead of accepting model assertions", () => {
    const evidence = parseEvidence({
      accountId: "account_demo",
      capturedAt: timestamp,
      contentHash: null,
      evidenceId: "evidence_offer_1",
      normalizedClaim: "Le prospect recrute des développeurs.",
      prospectId: "prospect_demo",
      provenance: "PROVIDER_PROFILE",
      sourceId: "provider_profile_demo",
      sourceUrl: "https://example.test/profile/demo",
      tenantId: "tenant_demo",
    });
    expect(evidence.provenance).toBe("PROVIDER_PROFILE");
    expect(() =>
      parseEvidence({
        ...evidence,
        provenance: "MODEL_INFERENCE",
      })
    ).toThrow();
  });

  it("requires stable reasons for held or denied eligibility", () => {
    const allowed = parseEligibilityResult({
      accountId: "account_demo",
      campaignId: "campaign_alpha",
      evaluatedAt: timestamp,
      outcome: "ALLOWED",
      prospectId: "prospect_demo",
      reasons: [],
      retryAt: null,
      step: "DM1",
      tenantId: "tenant_demo",
    });
    expect(allowed.outcome).toBe("ALLOWED");
    expect(() =>
      parseEligibilityResult({
        accountId: "account_demo",
        campaignId: "campaign_alpha",
        evaluatedAt: timestamp,
        outcome: "HOLD",
        prospectId: "prospect_demo",
        reasons: [],
        retryAt: timestamp,
        step: "DM1",
        tenantId: "tenant_demo",
      })
    ).toThrow();
  });

  it("parses action lifecycle events without treating an exception as confirmation", () => {
    const unknownEvent = parseActionLifecycleEvent({
      actionId: "action_dm1_unknown",
      attemptId: "attempt_dm1_1",
      occurredAt: timestamp,
      reason: "TIMEOUT",
      type: "ACTION_UNKNOWN",
    });
    expect(unknownEvent.type).toBe("ACTION_UNKNOWN");
    expect(() =>
      parseActionLifecycleEvent({
        actionId: "action_dm1_unknown",
        attemptId: "attempt_dm1_1",
        occurredAt: timestamp,
        providerMessageId: null,
        type: "ACTION_CONFIRMED",
      })
    ).toThrow();
  });
});

describe("workflow contracts", () => {
  it("creates compact deterministic IDs and parses their identity", () => {
    const identity = {
      accountId: parseAccountId("account_demo"),
      campaignId: parseCampaignId("campaign_alpha"),
      kind: "PROSPECT_SEQUENCE" as const,
      prospectId: parseProspectId("prospect_demo"),
      tenantId: parseTenantId("tenant_demo"),
    };
    const first = workflowIdFor(identity);
    const second = workflowIdFor(identity);

    expect(first).toBe(second);
    expect(first).toMatch(/^rlm1:s:/u);
    expect(parseWorkflowIdentity(first)).toEqual(identity);
  });

  it("keeps workflow signals compact and rejects unknown names", () => {
    const signal = parseWorkflowSignal({
      at: timestamp,
      messageId: "message_inbound_attachment",
      name: "sequence.incoming_message",
    });
    expect(signal).toEqual({
      at: timestamp,
      messageId: "message_inbound_attachment",
      name: "sequence.incoming_message",
    });
    expect(() =>
      parseWorkflowSignal({ at: timestamp, name: "sequence.send_now" })
    ).toThrow();
  });

  it("parses compact activity inputs and results without provider payloads", () => {
    const input = parseActivityInput(
      WORKFLOW_ACTIVITY_NAMES.discoveryFetchPage,
      {
        batchId: "batch_demo",
        campaignId: "campaign_alpha",
        campaignVersionId: "campaign_version_alpha_1",
        cursor: null,
        limit: 25,
        tenantId: "tenant_demo",
      }
    );
    expect(input.limit).toBe(25);

    const result = parseActivityResult(WORKFLOW_ACTIVITY_NAMES.outboxDeliver, {
      deliveredAt: timestamp,
      nextAttemptAt: null,
      outcome: "IGNORED_COMPLETED",
    });
    expect(result.outcome).toBe("IGNORED_COMPLETED");

    expect(() =>
      parseActivityResult(WORKFLOW_ACTIVITY_NAMES.outboxDeliver, {
        deliveredAt: timestamp,
        nextAttemptAt: null,
        outcome: "RETRY",
      })
    ).toThrow();
  });

  it("retains explicit null for unknown account reconciliation facts", () => {
    const result = parseActivityResult(
      WORKFLOW_ACTIVITY_NAMES.accountReconcile,
      {
        accountHealthy: null,
        completed: false,
        incomingMessagesFound: 0,
        nextCursor: "history_page_2",
        observedAt: timestamp,
        unresolvedActionIds: [],
      }
    );
    expect(result.accountHealthy).toBeNull();
  });
});

describe("branded contract IDs", () => {
  it("rejects path-like IDs that could corrupt deterministic workflow scopes", () => {
    expect(() => parseBatchId("batch/demo")).toThrow();
  });
});
