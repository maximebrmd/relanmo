import { describe, expect, it } from "vitest";

import {
  attachmentOnlyInboundEventFixture,
  attachmentOnlyInboundMessageFixture,
  campaignChangeOwnershipContinuityFixture,
  defaultSequencePlanFixture,
  eligibilityCheckFixture,
  invitationWithoutNoteActionFixture,
  outgoingBotEchoMessageFixture,
  uncertainSendActionFixture,
} from "./fixtures";
import {
  parseAccountId,
  parseBatchId,
  parseCampaignId,
  parseProspectId,
  parseTenantId,
} from "./ids";
import {
  parseAction,
  parseActionLifecycleEvent,
  parseActivityInput,
  parseActivityResult,
  parseBusinessWindowConfiguration,
  parseDuePlan,
  parseEligibilityCheck,
  parseEligibilityResult,
  parseEvidence,
  parseIncomingMessageEvent,
  parseMessage,
  parseOwnership,
  parseWorkflowIdentity,
  parseWorkflowSignal,
  safeParseAction,
  safeParseMessage,
} from "./parsers";
import {
  DEFAULT_BUSINESS_WINDOW_CONFIGURATION,
  DEFAULT_SEQUENCE_CLOSURE,
} from "./values";
import { WORKFLOW_ACTIVITY_NAMES, workflowIdFor } from "./workflow";

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
        businessWindow: DEFAULT_BUSINESS_WINDOW_CONFIGURATION,
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

  it("preserves every authoritative eligibility blocker and unknown fact", () => {
    const blocked = parseEligibilityCheck({
      ...eligibilityCheckFixture,
      snapshot: {
        ...eligibilityCheckFixture.snapshot,
        acceptance: {
          accepted: null,
          observedAt: null,
        },
        businessWindow: {
          nextOpenAt: null,
          status: "UNKNOWN",
        },
        completedSteps: ["DM1"],
        draft: {
          actionId: "action_dm1_ready",
          status: "STALE",
        },
        evidence: {
          evidenceIds: [],
          status: "MISSING",
        },
        incomingMessageAt: timestamp,
        ownership: {
          kind: "HUMAN_OWNED",
          ownerUserId: "user_demo",
          reason: "INCOMING_MESSAGE",
          recordedAt: timestamp,
        },
        unresolvedUnknownActionIds: ["action_dm1_unknown"],
        versions: {
          ...eligibilityCheckFixture.snapshot.versions,
          current: {
            ...eligibilityCheckFixture.snapshot.versions.current,
            campaign: {
              ...eligibilityCheckFixture.snapshot.versions.current.campaign,
              id: "campaign_version_beta_1",
            },
          },
        },
      },
    });

    expect(blocked.snapshot.acceptance.accepted).toBeNull();
    expect(blocked.snapshot.businessWindow?.status).toBe("UNKNOWN");
    expect(blocked.snapshot.completedSteps).toEqual(["DM1"]);
    expect(blocked.snapshot.draft.status).toBe("STALE");
    expect(blocked.snapshot.evidence.status).toBe("MISSING");
    expect(blocked.snapshot.incomingMessageAt).toBe(timestamp);
    expect(blocked.snapshot.ownership.kind).toBe("HUMAN_OWNED");
    expect(blocked.snapshot.unresolvedUnknownActionIds).toHaveLength(1);
    expect(blocked.snapshot.versions.current.campaign?.id).toBe(
      "campaign_version_beta_1"
    );
    expect(blocked.snapshot.versions.candidate?.campaign.id).toBe(
      "campaign_version_alpha_1"
    );

    for (const code of [
      "INCOMING_MESSAGE",
      "HUMAN_OWNED",
      "MISSING_ACCEPTANCE",
      "STALE_VERSION",
      "NO_ELIGIBLE_STEP",
      "UNKNOWN_SEND",
    ] as const) {
      expect(() =>
        parseEligibilityResult({
          accountId: "account_demo",
          campaignId: "campaign_alpha",
          evaluatedAt: timestamp,
          outcome: "ALLOWED",
          prospectId: "prospect_demo",
          reasons: [{ code, detail: null, observedAt: timestamp }],
          retryAt: null,
          step: "DM1",
          tenantId: "tenant_demo",
        })
      ).toThrow();
    }

    expect(() =>
      parseEligibilityCheck({
        ...eligibilityCheckFixture,
        snapshot: {
          ...eligibilityCheckFixture.snapshot,
          completedSteps: ["DM1", "DM1"],
        },
      })
    ).toThrow();
    expect(() =>
      parseEligibilityCheck({
        ...eligibilityCheckFixture,
        snapshot: {
          ...eligibilityCheckFixture.snapshot,
          draft: { actionId: null, status: "VALID" },
        },
      })
    ).toThrow();
  });

  it("binds eligibility suppression to its outer tenant and subject", () => {
    const suppression = {
      accountId: "account_demo",
      prospectId: "prospect_demo",
      reason: "CUSTOMER_REQUEST",
      recordedAt: timestamp,
      tenantId: "tenant_demo",
    };

    for (const [field, value] of [
      ["accountId", "account_other"],
      ["prospectId", "prospect_other"],
      ["tenantId", "tenant_other"],
    ] as const) {
      expect(() =>
        parseEligibilityCheck({
          ...eligibilityCheckFixture,
          snapshot: {
            ...eligibilityCheckFixture.snapshot,
            suppression: { ...suppression, [field]: value },
          },
        })
      ).toThrow();
    }
  });

  it("validates Europe/Paris business windows and due-plan closure order", () => {
    const dstFacingConfiguration = parseBusinessWindowConfiguration({
      businessTimeZone: "Europe/Paris",
      windows: [
        {
          closesAt: "03:30",
          opensAt: "02:30",
          weekday: "SUNDAY",
        },
      ],
    });
    expect(dstFacingConfiguration.businessTimeZone).toBe("Europe/Paris");

    expect(() =>
      parseBusinessWindowConfiguration({
        businessTimeZone: "Europe/Paris",
        windows: [{ closesAt: "18:00", opensAt: "09:00", weekday: "FUNDAY" }],
      })
    ).toThrow();
    expect(() =>
      parseBusinessWindowConfiguration({
        businessTimeZone: "Europe/Paris",
        windows: [{ closesAt: "18:00", opensAt: "9:00", weekday: "MONDAY" }],
      })
    ).toThrow();
    expect(() =>
      parseDuePlan({
        businessTimeZone: "Europe/Paris",
        businessWindow: DEFAULT_BUSINESS_WINDOW_CONFIGURATION,
        closureAt: "2026-09-16T10:00:00.000Z",
        earliestAt: timestamp,
        intendedAt: timestamp,
        step: "DM1",
      })
    ).toThrow();
    expect(() =>
      parseDuePlan({
        businessTimeZone: "Europe/Paris",
        businessWindow: DEFAULT_BUSINESS_WINDOW_CONFIGURATION,
        closureAt: "2026-09-18T10:00:00.000Z",
        earliestAt: "2026-09-17T10:00:00.000Z",
        intendedAt: "2026-09-19T10:00:00.000Z",
        step: "DM1",
      })
    ).toThrow();

    const delayedPlan = parseDuePlan({
      businessTimeZone: "Europe/Paris",
      businessWindow: DEFAULT_BUSINESS_WINDOW_CONFIGURATION,
      closureAt: "2026-09-20T10:00:00.000Z",
      earliestAt: "2026-09-18T10:00:00.000Z",
      intendedAt: "2026-09-17T10:00:00.000Z",
      step: "DM1",
    });
    expect(delayedPlan.intendedAt).toBe("2026-09-17T10:00:00.000Z");
    expect(delayedPlan.earliestAt).toBe("2026-09-18T10:00:00.000Z");
  });

  it("rejects contradictory ownership reasons and campaign version snapshots", () => {
    expect(() =>
      parseOwnership({
        kind: "BOT_ELIGIBLE",
        ownerUserId: null,
        reason: "INCOMING_MESSAGE",
        recordedAt: timestamp,
      })
    ).toThrow();
    expect(() =>
      parseOwnership({
        kind: "HUMAN_OWNED",
        ownerUserId: "user_demo",
        reason: "INITIAL_ACTIVATION",
        recordedAt: timestamp,
      })
    ).toThrow();
    expect(() =>
      parseAction({
        ...invitationWithoutNoteActionFixture,
        sourceVersions: {
          ...invitationWithoutNoteActionFixture.sourceVersions,
          campaign: {
            ...invitationWithoutNoteActionFixture.sourceVersions.campaign,
            id: "campaign_version_other",
          },
        },
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

  it("requires evidence for qualification and reasons for non-qualification", () => {
    const qualified = parseActivityResult(
      WORKFLOW_ACTIVITY_NAMES.discoveryQualifyBatch,
      {
        decisions: [
          {
            evidenceIds: ["evidence_offer_1"],
            outcome: "QUALIFIED",
            prospectId: "prospect_demo",
            reason: null,
          },
        ],
        observedAt: timestamp,
      }
    );
    expect(qualified.decisions[0]?.outcome).toBe("QUALIFIED");

    expect(() =>
      parseActivityResult(WORKFLOW_ACTIVITY_NAMES.discoveryQualifyBatch, {
        decisions: [
          {
            evidenceIds: [],
            outcome: "QUALIFIED",
            prospectId: "prospect_demo",
            reason: null,
          },
        ],
        observedAt: timestamp,
      })
    ).toThrow();
    expect(() =>
      parseActivityResult(WORKFLOW_ACTIVITY_NAMES.discoveryQualifyBatch, {
        decisions: [
          {
            evidenceIds: [],
            outcome: "HOLD",
            prospectId: "prospect_demo",
            reason: null,
          },
        ],
        observedAt: timestamp,
      })
    ).toThrow();
    expect(() =>
      parseActivityResult(WORKFLOW_ACTIVITY_NAMES.discoveryQualifyBatch, {
        decisions: [
          {
            evidenceIds: ["evidence_offer_1"],
            outcome: "QUALIFIED",
            prospectId: "prospect_demo",
            reason: "MISSING_EVIDENCE",
          },
        ],
        observedAt: timestamp,
      })
    ).toThrow();
  });

  it("freezes sequence drafting and authorized-dispatch Activity seams", () => {
    const draftInput = parseActivityInput(
      WORKFLOW_ACTIVITY_NAMES.sequenceDraftAction,
      {
        accountId: "account_demo",
        campaignId: "campaign_alpha",
        campaignVersionId: "campaign_version_alpha_1",
        evidenceIds: ["evidence_offer_1"],
        prospectId: "prospect_demo",
        step: "DM1",
        tenantId: "tenant_demo",
      }
    );
    expect(draftInput.step).toBe("DM1");

    const dispatchInput = parseActivityInput(
      WORKFLOW_ACTIVITY_NAMES.sequenceDispatchAction,
      {
        accountId: "account_demo",
        actionId: "action_dm1_ready",
        attemptId: "attempt_dm1_1",
        campaignVersionId: "campaign_version_alpha_1",
        fence: 2,
        prospectId: "prospect_demo",
        tenantId: "tenant_demo",
      }
    );
    expect(dispatchInput.fence).toBe(2);

    const drafted = parseActivityResult(
      WORKFLOW_ACTIVITY_NAMES.sequenceDraftAction,
      {
        actionId: "action_dm1_ready",
        observedAt: timestamp,
        outcome: "DRAFTED",
        reason: null,
        sourceVersions: invitationWithoutNoteActionFixture.sourceVersions,
      }
    );
    expect(drafted.outcome).toBe("DRAFTED");
    expect(drafted.reason).toBeNull();

    const unknown = parseActivityResult(
      WORKFLOW_ACTIVITY_NAMES.sequenceDispatchAction,
      {
        actionId: "action_dm1_ready",
        attemptId: "attempt_dm1_1",
        completedAt: timestamp,
        outcome: "UNKNOWN",
        providerMessageId: null,
        reason: "TIMEOUT",
      }
    );
    expect(unknown.outcome).toBe("UNKNOWN");
    expect(() =>
      parseActivityResult(WORKFLOW_ACTIVITY_NAMES.sequenceDispatchAction, {
        actionId: "action_dm1_ready",
        attemptId: "attempt_dm1_1",
        completedAt: timestamp,
        outcome: "CONFIRMED",
        providerMessageId: null,
        reason: "TIMEOUT",
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
