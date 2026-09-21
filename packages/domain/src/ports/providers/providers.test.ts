import { describe, expect, it } from "vitest";

import {
  parseAccountId,
  parseConversationId,
  parseEvidenceId,
  parseModelVersion,
  parseProspectId,
  parseTenantId,
} from "../../contracts/ids";
import { parseUtcTimestamp } from "../../contracts/values";
import type { ProviderReadResult, ProviderWriteResult } from "./common";
import { TYPESAFE_LIMITS } from "./decisions";
import {
  createFakeProviderPorts,
  FakeLinkedInPorts,
  fakeAmbiguousSendScenario,
  fakeDefinitiveRefusalScenario,
  fakeInvalidInputScenario,
  fakeSuccessScenario,
  fakeTimeoutReadScenario,
  fakeUnavailableCredentialsScenario,
} from "./fakes";
import {
  authorizedObjectKeyFixture,
  billingCustomerFixture,
  billingCheckoutInputFixture,
  billingPortalInputFixture,
  billingSignatureVerificationInputFixture,
  billingSubscriptionInputFixture,
  emailDeliveryInputFixture,
  linkedInAccountFixture,
  linkedInAccountStatusInputFixture,
  linkedInConnectInputFixture,
  linkedInConversationInputFixture,
  linkedInInviteInputFixture,
  linkedInReadProfileInputFixture,
  linkedInReconnectInputFixture,
  linkedInSearchCandidatesInputFixture,
  linkedInSendMessageInputFixture,
  normalizedIncomingProviderEventFixture,
  presignedReadInputFixture,
  privateObjectInputFixture,
  providerEventAuthenticationFixture,
  providerEventAuthenticationInputFixture,
  providerOperationContextFixture,
  typeSafeDecisionInputFixture,
  writingInputFixture,
} from "./fixtures";

function readValue<Value>(result: ProviderReadResult<Value>): Value {
  expect(result.ok).toBe(true);
  if (!result.ok) {
    throw new Error(result.message);
  }
  return result.value;
}

function writeValue<Value>(result: ProviderWriteResult<Value>): Value {
  expect(result.ok).toBe(true);
  if (!result.ok) {
    throw new Error(result.message);
  }
  return result.value;
}

describe("provider port contracts", () => {
  it("keeps successful LinkedIn operations normalized and correlated", async () => {
    const ports = createFakeProviderPorts();

    const flow = writeValue(
      await ports.linkedin.createConnectFlow(linkedInConnectInputFixture)
    );
    expect(flow.mode).toBe("CONNECT");

    const reconnect = writeValue(
      await ports.linkedin.createReconnectFlow(linkedInReconnectInputFixture)
    );
    expect(reconnect.mode).toBe("RECONNECT");

    const account = readValue(
      await ports.linkedin.readAccountStatus(linkedInAccountStatusInputFixture)
    );
    expect(account.health.status).toBe("CONNECTED");
    expect(account.capabilities.searchModes.recruiter).toBeNull();

    const page = readValue(
      await ports.linkedin.searchCandidates(
        linkedInSearchCandidatesInputFixture
      )
    );
    expect(page.candidates[0]?.provenance).toBe("SEARCH_RESULT");

    const profile = readValue(
      await ports.linkedin.readProfile(linkedInReadProfileInputFixture)
    );
    expect(profile.missingFields).toEqual([]);

    const invitation = writeValue(
      await ports.linkedin.invite(linkedInInviteInputFixture)
    );
    expect(invitation.providerEvidence.source).toBe("PROVIDER_RECEIPT");

    const message = writeValue(
      await ports.linkedin.sendMessage(linkedInSendMessageInputFixture)
    );
    expect(message.providerMessageId).toBe(
      "fixture_message_account_demo_prospect_demo_DM1"
    );
  });

  it("preserves attachment-only inbound messages through history and events", async () => {
    const ports = createFakeProviderPorts();
    const history = readValue(
      await ports.linkedin.readRecentConversation(
        linkedInConversationInputFixture
      )
    );
    const inbound = history.messages.find(
      (message) => message.direction === "INBOUND"
    );
    expect(inbound?.text).toBeNull();
    expect(inbound?.attachments).toHaveLength(1);

    const authenticated = readValue(
      await ports.events.authenticate(providerEventAuthenticationInputFixture)
    );
    const normalized = readValue(
      await ports.events.normalize({
        authenticated,
        context: providerOperationContextFixture,
        rawBody: providerEventAuthenticationInputFixture.rawBody,
        scope: normalizedIncomingProviderEventFixture.scope,
      })
    );
    expect(normalized.event.kind).toBe("INCOMING_MESSAGE");
    if (normalized.event.kind === "INCOMING_MESSAGE") {
      expect(normalized.event.message.text).toBeNull();
      expect(normalized.event.message.attachments).toHaveLength(1);
    }

    const dedupe = readValue(
      await ports.events.deriveDedupeIdentity({
        context: providerOperationContextFixture,
        event: normalizedIncomingProviderEventFixture,
      })
    );
    expect(dedupe.source).toBe("PROVIDER_EVENT_ID");
    expect(dedupe.provider).toBe("LINKEDIN");
    expect(dedupe.dedupeKey).toContain("tenant_demo:account_demo");
    expect(providerEventAuthenticationFixture.mechanism).toBe(
      "PROVIDER_DEFINED"
    );
  });

  it("keeps reusable fake results scoped to the request identities", async () => {
    const ports = createFakeProviderPorts();
    const otherTenantId = parseTenantId("tenant_other");
    const otherAccount = {
      ...linkedInAccountFixture,
      accountId: parseAccountId("account_other"),
      providerAccountId: "linkedin_account_other",
      tenantId: otherTenantId,
    };
    const otherProspectId = parseProspectId("prospect_other");
    const otherConversationId = parseConversationId("conversation_other");

    const account = readValue(
      await ports.linkedin.readAccountStatus({
        ...linkedInAccountStatusInputFixture,
        account: otherAccount,
      })
    );
    expect(account.account).toEqual(otherAccount);

    const profile = readValue(
      await ports.linkedin.readProfile({
        ...linkedInReadProfileInputFixture,
        account: otherAccount,
        providerProfileId: "linkedin_profile_other",
      })
    );
    expect(profile.providerProfileId).toBe("linkedin_profile_other");

    const history = readValue(
      await ports.linkedin.readRecentConversation({
        ...linkedInConversationInputFixture,
        account: otherAccount,
        conversationId: otherConversationId,
        prospectId: otherProspectId,
      })
    );
    expect(
      history.messages.every(
        (message) =>
          message.accountId === otherAccount.accountId &&
          message.tenantId === otherTenantId &&
          message.prospectId === otherProspectId &&
          message.conversationId === otherConversationId
      )
    ).toBe(true);

    const otherScope = {
      accountId: otherAccount.accountId,
      conversationId: otherConversationId,
      prospectId: otherProspectId,
      tenantId: otherTenantId,
    };
    const normalized = readValue(
      await ports.events.normalize({
        authenticated: providerEventAuthenticationFixture,
        context: providerOperationContextFixture,
        rawBody: providerEventAuthenticationInputFixture.rawBody,
        scope: otherScope,
      })
    );
    if (normalized.event.kind === "INCOMING_MESSAGE") {
      expect(normalized.event.scope).toEqual(otherScope);
      expect(normalized.event.message.accountId).toBe(otherAccount.accountId);
      expect(normalized.event.message.tenantId).toBe(otherTenantId);
      expect(normalized.event.message.prospectId).toBe(otherProspectId);
      expect(normalized.event.message.conversationId).toBe(otherConversationId);
    }
    const dedupe = readValue(
      await ports.events.deriveDedupeIdentity({
        context: providerOperationContextFixture,
        event: normalized.event,
      })
    );
    expect(dedupe.provider).toBe("LINKEDIN");
    expect(dedupe.dedupeKey).toBe(
      "tenant_other:account_other:provider_event_inbound_1"
    );

    const subscription = readValue(
      await ports.billing.readCurrentSubscription({
        ...billingSubscriptionInputFixture,
        customer: {
          ...billingCustomerFixture,
          providerCustomerId: "billing_customer_other",
          tenantId: otherTenantId,
        },
      })
    );
    expect(subscription.tenantId).toBe(otherTenantId);

    const email = writeValue(
      await ports.email.send({
        ...emailDeliveryInputFixture,
        deliveryIdentity: "notification_other_1",
        tenantId: otherTenantId,
      })
    );
    expect(email.deliveryIdentity).toBe("notification_other_1");

    const otherKey = {
      ...authorizedObjectKeyFixture,
      relativeKey: "other.csv",
    };
    const object = writeValue(
      await ports.objects.putPrivateObject({
        ...privateObjectInputFixture,
        key: otherKey,
        tenantId: otherTenantId,
      })
    );
    expect(object.tenantId).toBe(otherTenantId);
    expect(object.key).toEqual(otherKey);

    const presigned = readValue(
      await ports.objects.createPresignedRead({
        ...presignedReadInputFixture,
        key: otherKey,
        tenantId: otherTenantId,
      })
    );
    expect(presigned.tenantId).toBe(otherTenantId);
    expect(presigned.key).toEqual(otherKey);
  });

  it("preserves event identity and disambiguates provider-id-less events", async () => {
    const ports = createFakeProviderPorts();
    const providerEventId = "provider_event_other";
    const authenticated = {
      ...providerEventAuthenticationFixture,
      authenticationReference: providerEventId,
      providerEventId,
    };
    const unresolvedScope = {
      ...normalizedIncomingProviderEventFixture.scope,
      accountId: parseAccountId("account_other"),
      conversationId: null,
      prospectId: null,
      tenantId: parseTenantId("tenant_other"),
    };

    const quarantined = readValue(
      await ports.events.normalize({
        authenticated,
        context: providerOperationContextFixture,
        rawBody: providerEventAuthenticationInputFixture.rawBody,
        scope: unresolvedScope,
      })
    );
    expect(quarantined.event.kind).toBe("UNRECOGNIZED");
    expect(quarantined.event.providerEventId).toBe(providerEventId);
    expect(quarantined.event.scope).toEqual(unresolvedScope);
    expect(quarantined.evidence?.reference).toBe(providerEventId);

    const normalized = readValue(
      await ports.events.normalize({
        authenticated,
        context: providerOperationContextFixture,
        rawBody: providerEventAuthenticationInputFixture.rawBody,
        scope: normalizedIncomingProviderEventFixture.scope,
      })
    );
    expect(normalized.event.providerEventId).toBe(providerEventId);
    expect(normalized.evidence?.reference).toBe(providerEventId);

    const unknownAuthenticated = {
      ...providerEventAuthenticationFixture,
      authenticationReference: "authentication_unknown_1",
      providerEventId: null,
    };
    const unknownRawBody = '{"unknown":"payload-a"}';
    const firstUnknown = readValue(
      await ports.events.normalize({
        authenticated: unknownAuthenticated,
        context: providerOperationContextFixture,
        rawBody: unknownRawBody,
        scope: unresolvedScope,
      })
    );
    const replayUnknown = readValue(
      await ports.events.normalize({
        authenticated: {
          ...unknownAuthenticated,
          authenticationReference: "authentication_unknown_replay",
        },
        context: providerOperationContextFixture,
        rawBody: unknownRawBody,
        scope: unresolvedScope,
      })
    );
    const distinctUnknown = readValue(
      await ports.events.normalize({
        authenticated: {
          ...unknownAuthenticated,
          authenticationReference: "authentication_unknown_2",
        },
        context: providerOperationContextFixture,
        rawBody: '{"unknown":"payload-b"}',
        scope: unresolvedScope,
      })
    );
    if (
      firstUnknown.event.kind !== "UNRECOGNIZED" ||
      replayUnknown.event.kind !== "UNRECOGNIZED" ||
      distinctUnknown.event.kind !== "UNRECOGNIZED"
    ) {
      throw new Error("expected unknown provider events to be quarantined");
    }
    expect(firstUnknown.event.canonicalPayloadFingerprint).toBe(
      replayUnknown.event.canonicalPayloadFingerprint
    );
    expect(firstUnknown.event.canonicalPayloadFingerprint).not.toBe(
      distinctUnknown.event.canonicalPayloadFingerprint
    );

    const firstUnknownDedupe = readValue(
      await ports.events.deriveDedupeIdentity({
        context: providerOperationContextFixture,
        event: firstUnknown.event,
      })
    );
    const replayUnknownDedupe = readValue(
      await ports.events.deriveDedupeIdentity({
        context: providerOperationContextFixture,
        event: replayUnknown.event,
      })
    );
    const distinctUnknownDedupe = readValue(
      await ports.events.deriveDedupeIdentity({
        context: providerOperationContextFixture,
        event: distinctUnknown.event,
      })
    );
    expect(replayUnknownDedupe.dedupeKey).toBe(firstUnknownDedupe.dedupeKey);
    expect(distinctUnknownDedupe.dedupeKey).not.toBe(
      firstUnknownDedupe.dedupeKey
    );

    const firstEvent = {
      ...normalizedIncomingProviderEventFixture,
      occurredAt: parseUtcTimestamp("2026-09-17T10:00:00.000Z"),
      providerEventId: null,
    };
    const secondEvent = {
      ...firstEvent,
      occurredAt: parseUtcTimestamp("2026-09-17T10:00:01.000Z"),
    };
    const firstDedupe = readValue(
      await ports.events.deriveDedupeIdentity({
        context: providerOperationContextFixture,
        event: firstEvent,
      })
    );
    const repeatedDedupe = readValue(
      await ports.events.deriveDedupeIdentity({
        context: providerOperationContextFixture,
        event: firstEvent,
      })
    );
    const secondDedupe = readValue(
      await ports.events.deriveDedupeIdentity({
        context: providerOperationContextFixture,
        event: secondEvent,
      })
    );
    expect(firstDedupe.source).toBe("CANONICAL_PAYLOAD");
    expect(repeatedDedupe.dedupeKey).toBe(firstDedupe.dedupeKey);
    expect(secondDedupe.dedupeKey).not.toBe(firstDedupe.dedupeKey);
  });

  it("separates ambiguous writes from retryable reads", async () => {
    const ambiguousPorts = createFakeProviderPorts(fakeAmbiguousSendScenario);
    const ambiguous = await ambiguousPorts.linkedin.sendMessage(
      linkedInSendMessageInputFixture
    );
    expect(ambiguous.ok).toBe(false);
    if (!ambiguous.ok) {
      expect(ambiguous.kind).toBe("AMBIGUOUS_WRITE");
      if (ambiguous.kind === "AMBIGUOUS_WRITE") {
        expect(ambiguous.reconciliationRequired).toBe(true);
      }
    }

    const ambiguousRead = await ambiguousPorts.linkedin.readRecentConversation(
      linkedInConversationInputFixture
    );
    expect(readValue(ambiguousRead).messages).toHaveLength(2);

    const ambiguousEventAuthentication = readValue(
      await ambiguousPorts.events.authenticate(
        providerEventAuthenticationInputFixture
      )
    );
    const ambiguousEventNormalization = readValue(
      await ambiguousPorts.events.normalize({
        authenticated: ambiguousEventAuthentication,
        context: providerOperationContextFixture,
        rawBody: providerEventAuthenticationInputFixture.rawBody,
        scope: normalizedIncomingProviderEventFixture.scope,
      })
    );
    expect(ambiguousEventNormalization.event.kind).toBe("INCOMING_MESSAGE");

    const ambiguousBillingSignature = readValue(
      await ambiguousPorts.billing.verifyWebhookSignature(
        billingSignatureVerificationInputFixture
      )
    );
    expect(ambiguousBillingSignature.eventId).toBe("billing_event_demo");

    const timeout = await new FakeLinkedInPorts(
      fakeTimeoutReadScenario
    ).readRecentConversation(linkedInConversationInputFixture);
    expect(timeout.ok).toBe(false);
    if (!timeout.ok) {
      expect(timeout.kind).toBe("RETRYABLE_READ_FAILURE");
      if (timeout.kind === "RETRYABLE_READ_FAILURE") {
        expect(timeout.retryAfterAt).toBeNull();
      }
    }

    const refusal = await new FakeLinkedInPorts(
      fakeDefinitiveRefusalScenario
    ).invite(linkedInInviteInputFixture);
    expect(refusal.ok).toBe(false);
    if (!refusal.ok) {
      expect(refusal.kind).toBe("DEFINITIVE_REFUSAL");
      expect(refusal.kind).not.toBe("AMBIGUOUS_WRITE");
    }
  });

  it("exposes deterministic invalid-input and unavailable-credential failures", async () => {
    const invalid = await new FakeLinkedInPorts(
      fakeInvalidInputScenario
    ).searchCandidates(linkedInSearchCandidatesInputFixture);
    expect(invalid.ok).toBe(false);
    if (!invalid.ok) {
      expect(invalid.kind).toBe("INVALID_INPUT");
      if (invalid.kind === "INVALID_INPUT") {
        expect(invalid.field).toBe("input");
      }
    }

    const invalidValue = await new FakeLinkedInPorts(
      fakeSuccessScenario
    ).searchCandidates({
      ...linkedInSearchCandidatesInputFixture,
      limit: 0,
    });
    expect(invalidValue.ok).toBe(false);
    if (!invalidValue.ok) {
      expect(invalidValue.kind).toBe("INVALID_INPUT");
      if (invalidValue.kind === "INVALID_INPUT") {
        expect(invalidValue.field).toBe("limit");
      }
    }

    const credentials = await new FakeLinkedInPorts(
      fakeUnavailableCredentialsScenario
    ).readAccountStatus(linkedInAccountStatusInputFixture);
    expect(credentials.ok).toBe(false);
    if (!credentials.ok) {
      expect(credentials.kind).toBe("UNAVAILABLE_CREDENTIALS");
      if (credentials.kind === "UNAVAILABLE_CREDENTIALS") {
        expect(credentials.provider).toBe("LINKEDIN");
      }
    }
  });

  it("keeps model decisions advisory and carries usage and uncertainty", async () => {
    const ports = createFakeProviderPorts();
    const decision = readValue(
      await ports.model.decide(typeSafeDecisionInputFixture)
    );
    expect(decision.answer?.id).toBe("SUITABLE");
    expect(decision.answerEvidenceIds).toEqual(["evidence_offer_1"]);
    expect(decision.uncertainty).toBe("LOW");
    expect(decision.usage.totalTokens).toBe(92);
    expect(Object.hasOwn(decision, "sendAuthorization")).toBe(false);

    const draft = readValue(await ports.model.compose(writingInputFixture));
    expect(draft.text).toContain("recrutement");
    expect(draft.finishReason).toBe("COMPLETE");
    expect(draft.usage.inputTokens).toBeGreaterThan(0);

    const boundedDraft = readValue(
      await ports.model.compose({
        ...writingInputFixture,
        outputBudget: { maxCharacters: 1, maxTokens: 1 },
      })
    );
    expect(boundedDraft.finishReason).toBe("TRUNCATED");
    expect(boundedDraft.text).toHaveLength(1);
    expect(boundedDraft.usage.outputTokens).toBeLessThanOrEqual(1);
    expect(boundedDraft.usage.totalTokens).toBe(
      boundedDraft.usage.inputTokens + boundedDraft.usage.outputTokens
    );
    expect(boundedDraft.modelVersion).toBe(
      writingInputFixture.sourceVersions.model
    );

    const otherDecision = readValue(
      await ports.model.decide({
        ...typeSafeDecisionInputFixture,
        evidence: [
          {
            claim: "Preuve différente.",
            evidenceId: parseEvidenceId("evidence_other"),
          },
        ],
        modelVersion: parseModelVersion("typesafe-other-1"),
        question: {
          ...typeSafeDecisionInputFixture.question,
          choices: [{ id: "REJECT", label: "À écarter" }],
          id: "other-question",
          schemaVersion: "qualification-v2",
        },
        prospectId: parseProspectId("prospect_other"),
      })
    );
    expect(otherDecision.answer?.id).toBe("REJECT");
    expect(otherDecision.answerEvidenceIds).toEqual(["evidence_other"]);
    expect(otherDecision.modelVersion).toBe("typesafe-other-1");
    expect(otherDecision.questionId).toBe("other-question");
    expect(otherDecision.schemaVersion).toBe("qualification-v2");

    const emptyChoices = await ports.model.decide({
      ...typeSafeDecisionInputFixture,
      question: { ...typeSafeDecisionInputFixture.question, choices: [] },
    });
    expect(emptyChoices.ok).toBe(false);
    if (!emptyChoices.ok && emptyChoices.kind === "INVALID_INPUT") {
      expect(emptyChoices.field).toBe("question.choices");
      expect(emptyChoices.code).toBe("MALFORMED_INPUT");
    }

    const tooManyChoices = await ports.model.decide({
      ...typeSafeDecisionInputFixture,
      question: {
        ...typeSafeDecisionInputFixture.question,
        choices: Array.from(
          { length: TYPESAFE_LIMITS.maxQuestionChoices + 1 },
          (_, index) => ({ id: `choice_${index}`, label: `Choice ${index}` })
        ),
      },
    });
    expect(tooManyChoices.ok).toBe(false);
    if (!tooManyChoices.ok && tooManyChoices.kind === "INVALID_INPUT") {
      expect(tooManyChoices.field).toBe("question.choices");
      expect(tooManyChoices.code).toBe("OUT_OF_BOUNDS");
    }

    const longPrompt = await ports.model.decide({
      ...typeSafeDecisionInputFixture,
      question: {
        ...typeSafeDecisionInputFixture.question,
        prompt: "x".repeat(TYPESAFE_LIMITS.maxPromptCharacters + 1),
      },
    });
    expect(longPrompt.ok).toBe(false);
    if (!longPrompt.ok && longPrompt.kind === "INVALID_INPUT") {
      expect(longPrompt.field).toBe("question.prompt");
      expect(longPrompt.code).toBe("OUT_OF_BOUNDS");
    }

    const tooMuchEvidence = await ports.model.decide({
      ...typeSafeDecisionInputFixture,
      evidence: Array.from(
        { length: TYPESAFE_LIMITS.maxEvidence + 1 },
        (_, index) => ({
          claim: `Claim ${index}`,
          evidenceId: parseEvidenceId(`evidence_${index}`),
        })
      ),
    });
    expect(tooMuchEvidence.ok).toBe(false);
    if (!tooMuchEvidence.ok && tooMuchEvidence.kind === "INVALID_INPUT") {
      expect(tooMuchEvidence.field).toBe("evidence");
      expect(tooMuchEvidence.code).toBe("OUT_OF_BOUNDS");
    }
  });

  it("covers billing, semantic email, and tenant-private object ports", async () => {
    const ports = createFakeProviderPorts();

    const checkout = writeValue(
      await ports.billing.createCheckoutSession(billingCheckoutInputFixture)
    );
    expect(checkout.sessionUrl).toContain("billing.example.test");

    const portal = writeValue(
      await ports.billing.createPortalSession(billingPortalInputFixture)
    );
    expect(portal.sessionUrl).toContain("billing.example.test");

    const subscription = readValue(
      await ports.billing.readCurrentSubscription(
        billingSubscriptionInputFixture
      )
    );
    expect(subscription.status).toBe("ACTIVE");

    const verified = readValue(
      await ports.billing.verifyWebhookSignature(
        billingSignatureVerificationInputFixture
      )
    );
    expect(verified.eventId).toBe("billing_event_demo");

    const email = writeValue(await ports.email.send(emailDeliveryInputFixture));
    expect(email.deliveryIdentity).toBe("notification_reply_demo_1");

    const object = writeValue(
      await ports.objects.putPrivateObject(privateObjectInputFixture)
    );
    expect(object.tenantId).toBe("tenant_demo");

    const presigned = readValue(
      await ports.objects.createPresignedRead(presignedReadInputFixture)
    );
    expect(presigned.method).toBe("GET");
  });
});
