import { describe, expect, it } from "vitest";

import type { ProviderResult } from "./common";
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
  billingCheckoutInputFixture,
  billingPortalInputFixture,
  billingSignatureVerificationInputFixture,
  billingSubscriptionInputFixture,
  emailDeliveryInputFixture,
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

function valueOf<Value>(result: ProviderResult<Value>): Value {
  expect(result.ok).toBe(true);
  if (!result.ok) {
    throw new Error(result.message);
  }
  return result.value;
}

describe("provider port contracts", () => {
  it("keeps successful LinkedIn operations normalized and correlated", async () => {
    const ports = createFakeProviderPorts();

    const flow = valueOf(
      await ports.linkedin.createConnectFlow(linkedInConnectInputFixture)
    );
    expect(flow.mode).toBe("CONNECT");

    const reconnect = valueOf(
      await ports.linkedin.createReconnectFlow(linkedInReconnectInputFixture)
    );
    expect(reconnect.mode).toBe("RECONNECT");

    const account = valueOf(
      await ports.linkedin.readAccountStatus(linkedInAccountStatusInputFixture)
    );
    expect(account.health.status).toBe("CONNECTED");
    expect(account.capabilities.searchModes.recruiter).toBeNull();

    const page = valueOf(
      await ports.linkedin.searchCandidates(
        linkedInSearchCandidatesInputFixture
      )
    );
    expect(page.candidates[0]?.provenance).toBe("SEARCH_RESULT");

    const profile = valueOf(
      await ports.linkedin.readProfile(linkedInReadProfileInputFixture)
    );
    expect(profile.missingFields).toEqual([]);

    const invitation = valueOf(
      await ports.linkedin.invite(linkedInInviteInputFixture)
    );
    expect(invitation.providerEvidence.source).toBe("PROVIDER_RECEIPT");

    const message = valueOf(
      await ports.linkedin.sendMessage(linkedInSendMessageInputFixture)
    );
    expect(message.providerMessageId).toBe("provider_message_outbound_2");
  });

  it("preserves attachment-only inbound messages through history and events", async () => {
    const ports = createFakeProviderPorts();
    const history = valueOf(
      await ports.linkedin.readRecentConversation(
        linkedInConversationInputFixture
      )
    );
    const inbound = history.messages.find(
      (message) => message.direction === "INBOUND"
    );
    expect(inbound?.text).toBeNull();
    expect(inbound?.attachments).toHaveLength(1);

    const authenticated = valueOf(
      await ports.events.authenticate(providerEventAuthenticationInputFixture)
    );
    const normalized = valueOf(
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

    const dedupe = valueOf(
      await ports.events.deriveDedupeIdentity({
        context: providerOperationContextFixture,
        event: normalizedIncomingProviderEventFixture,
      })
    );
    expect(dedupe.source).toBe("PROVIDER_EVENT_ID");
    expect(dedupe.dedupeKey).toContain("tenant_demo:account_demo");
    expect(providerEventAuthenticationFixture.mechanism).toBe(
      "PROVIDER_DEFINED"
    );
  });

  it("separates ambiguous writes from retryable reads", async () => {
    const ambiguous = await new FakeLinkedInPorts(
      fakeAmbiguousSendScenario
    ).sendMessage(linkedInSendMessageInputFixture);
    expect(ambiguous.ok).toBe(false);
    if (!ambiguous.ok) {
      expect(ambiguous.kind).toBe("AMBIGUOUS_WRITE");
      if (ambiguous.kind === "AMBIGUOUS_WRITE") {
        expect(ambiguous.reconciliationRequired).toBe(true);
      }
    }

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
    const decision = valueOf(
      await ports.model.decide(typeSafeDecisionInputFixture)
    );
    expect(decision.answer?.id).toBe("SUITABLE");
    expect(decision.answerEvidenceIds).toEqual(["evidence_offer_1"]);
    expect(decision.uncertainty).toBe("LOW");
    expect(decision.usage.totalTokens).toBe(92);
    expect(Object.hasOwn(decision, "sendAuthorization")).toBe(false);

    const draft = valueOf(await ports.model.compose(writingInputFixture));
    expect(draft.text).toContain("recrutement");
    expect(draft.usage.inputTokens).toBeGreaterThan(0);
  });

  it("covers billing, semantic email, and tenant-private object ports", async () => {
    const ports = createFakeProviderPorts();

    const checkout = valueOf(
      await ports.billing.createCheckoutSession(billingCheckoutInputFixture)
    );
    expect(checkout.sessionUrl).toContain("billing.example.test");

    const portal = valueOf(
      await ports.billing.createPortalSession(billingPortalInputFixture)
    );
    expect(portal.sessionUrl).toContain("billing.example.test");

    const subscription = valueOf(
      await ports.billing.readCurrentSubscription(
        billingSubscriptionInputFixture
      )
    );
    expect(subscription.status).toBe("ACTIVE");

    const verified = valueOf(
      await ports.billing.verifyWebhookSignature(
        billingSignatureVerificationInputFixture
      )
    );
    expect(verified.eventId).toBe("billing_event_demo");

    const email = valueOf(await ports.email.send(emailDeliveryInputFixture));
    expect(email.deliveryIdentity).toBe("notification_reply_demo_1");

    const object = valueOf(
      await ports.objects.putPrivateObject(privateObjectInputFixture)
    );
    expect(object.tenantId).toBe("tenant_demo");

    const presigned = valueOf(
      await ports.objects.createPresignedRead(presignedReadInputFixture)
    );
    expect(presigned.method).toBe("GET");
  });
});
