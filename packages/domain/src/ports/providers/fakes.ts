/* oxlint-disable max-classes-per-file, require-await -- Each fake
 * keeps one port boundary explicit while implementing the asynchronous contract
 * without network work. */

import type { BillingPort, BillingSignatureVerificationInput } from "./billing";
import type {
  DefinitiveRefusalFailure,
  ProviderName,
  ProviderOperationContext,
  ProviderReadResult,
  ProviderWriteResult,
} from "./common";
import {
  providerAmbiguousWrite,
  providerDefinitiveRefusal,
  providerInvalidInput,
  providerRetryableReadFailure,
  providerSuccess,
  providerUnavailableCredentials,
} from "./common";
import { TYPESAFE_LIMITS } from "./decisions";
import type { TypeSafeDecisionInput, TypeSafeDecisionPort } from "./decisions";
import type { EmailDeliveryInput, EmailPort } from "./email";
import type {
  ProviderEventDedupeInput,
  ProviderEventDedupeIdentity,
  ProviderEventNormalizationInput,
  ProviderEventPort,
  ProviderEventAuthenticationInput,
  NormalizedProviderEvent,
} from "./events";
import {
  billingHostedSessionFixture,
  billingSignatureVerificationFixture,
  billingSubscriptionFixture,
  linkedInAcceptanceFixture,
  linkedInAccountStatusFixture,
  linkedInCandidatePageFixture,
  linkedInConversationPageFixture,
  linkedInHostedFlowFixture,
  linkedInInviteReceiptFixture,
  linkedInMessageReceiptFixture,
  linkedInProfileFixture,
  presignedReadOperationFixture,
  privateObjectFixture,
  providerEventAuthenticationFixture,
  providerEventDedupeIdentityFixture,
  providerEventNormalizationFixture,
  normalizedIncomingProviderEventFixture,
  typeSafeDecisionFixture,
  writingResultFixture,
  emailDeliveryFixture,
} from "./fixtures";
import type {
  LinkedInAccountsPort,
  LinkedInAccountStatusInput,
  LinkedInAcceptanceInput,
  LinkedInConnectInput,
  LinkedInConversationInput,
  LinkedInDeliveryPort,
  LinkedInDiscoveryPort,
  LinkedInInviteInput,
  LinkedInReadProfileInput,
  LinkedInReconnectInput,
  LinkedInSearchCandidatesInput,
  LinkedInSendMessageInput,
} from "./linkedin";
import type {
  ObjectStoragePort,
  PresignedReadInput,
  PrivateObjectInput,
} from "./objects";
import type { WritingInput, WritingPort } from "./writing";

export type FakeFailureScenario =
  | Readonly<{ kind: "AMBIGUOUS_WRITE" }>
  | Readonly<{
      code: DefinitiveRefusalFailure["code"];
      kind: "DEFINITIVE_REFUSAL";
    }>
  | Readonly<{ kind: "INVALID_INPUT"; field: string; operation: FakeOperation }>
  | Readonly<{ kind: "RETRYABLE_READ" }>
  | Readonly<{ kind: "SUCCESS" }>
  | Readonly<{ kind: "TIMEOUT"; operation: FakeOperation }>
  | Readonly<{
      credential: "ACCOUNT" | "APPLICATION" | "SIGNING_SECRET";
      kind: "UNAVAILABLE_CREDENTIALS";
      provider: ProviderName;
    }>;

export type FakeOperation = "ANY" | "READ" | "WRITE";

export const fakeSuccessScenario: FakeFailureScenario = Object.freeze({
  kind: "SUCCESS",
});

export const fakeAmbiguousSendScenario: FakeFailureScenario = Object.freeze({
  kind: "AMBIGUOUS_WRITE",
});

export const fakeDefinitiveRefusalScenario: FakeFailureScenario = Object.freeze(
  {
    code: "RECIPIENT_NOT_ELIGIBLE",
    kind: "DEFINITIVE_REFUSAL",
  }
);

export const fakeInvalidInputScenario: FakeFailureScenario = Object.freeze({
  field: "input",
  kind: "INVALID_INPUT",
  operation: "ANY",
});

export const fakeTimeoutReadScenario: FakeFailureScenario = Object.freeze({
  kind: "TIMEOUT",
  operation: "READ",
});

export const fakeTimeoutWriteScenario: FakeFailureScenario = Object.freeze({
  kind: "TIMEOUT",
  operation: "WRITE",
});

export const fakeRetryableReadScenario: FakeFailureScenario = Object.freeze({
  kind: "RETRYABLE_READ",
});

export const fakeUnavailableCredentialsScenario: FakeFailureScenario =
  Object.freeze({
    credential: "APPLICATION",
    kind: "UNAVAILABLE_CREDENTIALS",
    provider: "LINKEDIN",
  });

function invalidIf(
  condition: boolean,
  context: ProviderOperationContext,
  field: string,
  message: string
) {
  return condition ? providerInvalidInput(context, field, message) : null;
}

function fingerprintPayload(payload: string): string {
  let hash = 14_695_981_039_346_656_037n;
  const modulus = 18_446_744_073_709_551_616n;
  const multiplier = 1_099_511_628_211n;
  for (const character of payload) {
    hash =
      (hash * multiplier + BigInt(character.codePointAt(0) ?? 0)) % modulus;
  }
  return `stable64:${hash.toString(16).padStart(16, "0")}`;
}

function readFailure<Value>(
  context: ProviderOperationContext,
  scenario: FakeFailureScenario,
  provider: ProviderName
): ProviderReadResult<Value> | null {
  switch (scenario.kind) {
    case "INVALID_INPUT": {
      return scenario.operation === "WRITE"
        ? null
        : providerInvalidInput(
            context,
            scenario.field,
            "fixture input rejected"
          );
    }
    case "RETRYABLE_READ": {
      return providerRetryableReadFailure(
        context,
        "UPSTREAM_READ_FAILURE",
        "fixture read is temporarily unavailable"
      );
    }
    case "DEFINITIVE_REFUSAL": {
      return providerDefinitiveRefusal(
        context,
        scenario.code,
        "fixture provider definitively refused the operation"
      );
    }
    case "TIMEOUT": {
      return scenario.operation === "WRITE"
        ? null
        : providerRetryableReadFailure(
            context,
            "DEADLINE_EXCEEDED",
            "fixture read exceeded its deadline"
          );
    }
    case "UNAVAILABLE_CREDENTIALS": {
      return scenario.provider === provider
        ? providerUnavailableCredentials(context, provider, scenario.credential)
        : null;
    }
    case "AMBIGUOUS_WRITE":
    case "SUCCESS": {
      return null;
    }
    default: {
      return null;
    }
  }
}

function writeFailure<Value>(
  context: ProviderOperationContext,
  scenario: FakeFailureScenario,
  provider: ProviderName
): ProviderWriteResult<Value> | null {
  switch (scenario.kind) {
    case "AMBIGUOUS_WRITE": {
      return providerAmbiguousWrite(
        context,
        "RESPONSE_LOST",
        "fixture write outcome is ambiguous; reconcile before retrying"
      );
    }
    case "INVALID_INPUT": {
      return scenario.operation === "READ"
        ? null
        : providerInvalidInput(
            context,
            scenario.field,
            "fixture input rejected"
          );
    }
    case "DEFINITIVE_REFUSAL": {
      return providerDefinitiveRefusal(
        context,
        scenario.code,
        "fixture provider definitively refused the operation"
      );
    }
    case "TIMEOUT": {
      return scenario.operation === "READ"
        ? null
        : providerAmbiguousWrite(
            context,
            "DEADLINE_EXCEEDED",
            "fixture write exceeded its deadline; outcome is unknown"
          );
    }
    case "UNAVAILABLE_CREDENTIALS": {
      return scenario.provider === provider
        ? providerUnavailableCredentials(context, provider, scenario.credential)
        : null;
    }
    case "RETRYABLE_READ":
    case "SUCCESS": {
      return null;
    }
    default: {
      return null;
    }
  }
}

function eventFailure<Value>(
  context: ProviderOperationContext,
  scenario: FakeFailureScenario
): ProviderReadResult<Value> | null {
  const read = readFailure<Value>(context, scenario, "LINKEDIN");
  if (read) {
    return read;
  }
  return null;
}

function scopedAccountStatus(input: LinkedInAccountStatusInput) {
  return {
    ...linkedInAccountStatusFixture,
    account: input.account,
  };
}

function scopedConversationPage(input: LinkedInConversationInput) {
  return {
    ...linkedInConversationPageFixture,
    messages: linkedInConversationPageFixture.messages.map((message) => ({
      ...message,
      accountId: input.account.accountId,
      conversationId: input.conversationId ?? message.conversationId,
      prospectId: input.prospectId,
      tenantId: input.account.tenantId,
    })),
  };
}

function canonicalEventPayload(event: NormalizedProviderEvent): string {
  switch (event.kind) {
    case "ACCOUNT_STATUS_CHANGED": {
      return JSON.stringify({
        accountId: event.accountId,
        capabilities: event.capabilities,
        health: event.health,
        kind: event.kind,
        observedAt: event.observedAt,
      });
    }
    case "INCOMING_MESSAGE":
    case "OUTGOING_MESSAGE": {
      return JSON.stringify({
        conversationId: event.scope.conversationId,
        direction: event.message.direction,
        kind: event.kind,
        messageId: event.message.messageId,
        occurredAt: event.occurredAt,
        providerMessageId: event.message.providerMessageId,
        prospectId: event.scope.prospectId,
      });
    }
    case "INVITATION_ACCEPTED": {
      return JSON.stringify({
        accountId: event.accountId,
        acceptedAt: event.acceptedAt,
        kind: event.kind,
        prospectId: event.prospectId,
      });
    }
    case "UNRECOGNIZED": {
      return JSON.stringify({
        canonicalPayloadFingerprint: event.canonicalPayloadFingerprint,
        kind: event.kind,
        observedAt: event.observedAt,
      });
    }
    default: {
      return JSON.stringify(event);
    }
  }
}

function scopedEventNormalization(input: ProviderEventNormalizationInput) {
  const { authenticated, scope } = input;
  const { providerEventId } = authenticated;
  const evidence = providerEventNormalizationFixture.evidence
    ? {
        ...providerEventNormalizationFixture.evidence,
        reference: providerEventId,
      }
    : null;
  const { conversationId, prospectId } = scope;
  const canonicalPayloadFingerprint = fingerprintPayload(input.rawBody);

  if (conversationId === null || prospectId === null) {
    return {
      ...providerEventNormalizationFixture,
      event: {
        canonicalPayloadFingerprint,
        kind: "UNRECOGNIZED" as const,
        observedAt: normalizedIncomingProviderEventFixture.occurredAt,
        providerEventId,
        scope,
      },
      evidence,
    };
  }

  const event = normalizedIncomingProviderEventFixture;
  return {
    ...providerEventNormalizationFixture,
    evidence,
    event: {
      ...event,
      providerEventId,
      message: {
        ...event.message,
        accountId: scope.accountId,
        conversationId,
        prospectId,
        tenantId: scope.tenantId,
      },
      scope,
    },
  };
}

function scopedDedupeIdentity(
  input: ProviderEventDedupeInput
): ProviderEventDedupeIdentity {
  const { event } = input;
  const { providerEventId } = event;
  const source: ProviderEventDedupeIdentity["source"] = providerEventId
    ? "PROVIDER_EVENT_ID"
    : "CANONICAL_PAYLOAD";
  const eventPart = providerEventId ?? canonicalEventPayload(event);
  return {
    ...providerEventDedupeIdentityFixture,
    dedupeKey: `${event.scope.tenantId}:${event.scope.accountId}:${eventPart}`,
    eventKind: event.kind,
    provider: "LINKEDIN",
    providerEventId,
    scope: event.scope,
    source,
  };
}

function scopedProfile(input: LinkedInReadProfileInput) {
  return {
    ...linkedInProfileFixture,
    providerProfileId: input.providerProfileId,
  };
}

function scopedInviteReceipt(input: LinkedInInviteInput) {
  const providerInvitationId = `fixture_invitation_${input.account.accountId}_${input.prospectId}`;
  return {
    ...linkedInInviteReceiptFixture,
    providerEvidence: {
      ...linkedInInviteReceiptFixture.providerEvidence,
      reference: providerInvitationId,
    },
    providerInvitationId,
  };
}

function scopedMessageReceipt(input: LinkedInSendMessageInput) {
  const providerMessageId = `fixture_message_${input.account.accountId}_${input.prospectId}_${input.step}`;
  return {
    ...linkedInMessageReceiptFixture,
    providerEvidence: {
      ...linkedInMessageReceiptFixture.providerEvidence,
      reference: providerMessageId,
    },
    providerMessageId,
  };
}

function scopedBillingSubscription(
  input: Parameters<BillingPort["readCurrentSubscription"]>[0]
) {
  return {
    ...billingSubscriptionFixture,
    tenantId: input.customer.tenantId,
  };
}

function scopedEmailDelivery(input: EmailDeliveryInput) {
  return {
    ...emailDeliveryFixture,
    deliveryIdentity: input.deliveryIdentity,
    providerMessageId: `fixture_email_${input.deliveryIdentity}`,
  };
}

function scopedPrivateObject(input: PrivateObjectInput) {
  return {
    ...privateObjectFixture,
    contentType: input.contentType,
    key: input.key,
    sizeBytes: input.content.byteLength,
    tenantId: input.tenantId,
  };
}

function scopedPresignedRead(input: PresignedReadInput) {
  return {
    ...presignedReadOperationFixture,
    key: input.key,
    tenantId: input.tenantId,
    url: `https://objects.example.test/presigned/${input.tenantId}/${input.key.relativeKey}`,
  };
}

export class FakeLinkedInPorts
  implements
    LinkedInAccountsPort,
    LinkedInDeliveryPort,
    LinkedInDiscoveryPort,
    ProviderEventPort
{
  readonly #scenario: FakeFailureScenario;

  constructor(scenario: FakeFailureScenario = fakeSuccessScenario) {
    this.#scenario = scenario;
  }

  async authenticate(
    input: ProviderEventAuthenticationInput
  ): Promise<ProviderReadResult<typeof providerEventAuthenticationFixture>> {
    const invalid = invalidIf(
      input.rawBody.trim().length === 0,
      input.context,
      "rawBody",
      "rawBody must not be empty"
    );
    if (invalid) {
      return invalid;
    }
    const failure = eventFailure<typeof providerEventAuthenticationFixture>(
      input.context,
      this.#scenario
    );
    if (failure) {
      return failure;
    }
    return providerSuccess(input.context, providerEventAuthenticationFixture);
  }

  async createConnectFlow(
    input: LinkedInConnectInput
  ): Promise<ProviderWriteResult<typeof linkedInHostedFlowFixture>> {
    const invalid = invalidIf(
      input.opaqueState.trim().length === 0,
      input.context,
      "opaqueState",
      "opaqueState must not be empty"
    );
    if (invalid) {
      return invalid;
    }
    const failure = writeFailure<typeof linkedInHostedFlowFixture>(
      input.context,
      this.#scenario,
      "LINKEDIN"
    );
    if (failure) {
      return failure;
    }
    return providerSuccess(input.context, {
      ...linkedInHostedFlowFixture,
      flowReference: `fixture_flow_${input.opaqueState}`,
    });
  }

  async createReconnectFlow(
    input: LinkedInReconnectInput
  ): Promise<ProviderWriteResult<typeof linkedInHostedFlowFixture>> {
    const invalid = invalidIf(
      input.opaqueState.trim().length === 0,
      input.context,
      "opaqueState",
      "opaqueState must not be empty"
    );
    if (invalid) {
      return invalid;
    }
    const failure = writeFailure<typeof linkedInHostedFlowFixture>(
      input.context,
      this.#scenario,
      "LINKEDIN"
    );
    if (failure) {
      return failure;
    }
    return providerSuccess(input.context, {
      ...linkedInHostedFlowFixture,
      flowReference: `fixture_flow_${input.opaqueState}`,
      mode: "RECONNECT",
    });
  }

  async deriveDedupeIdentity(
    input: ProviderEventDedupeInput
  ): Promise<ProviderReadResult<typeof providerEventDedupeIdentityFixture>> {
    const failure = eventFailure<typeof providerEventDedupeIdentityFixture>(
      input.context,
      this.#scenario
    );
    if (failure) {
      return failure;
    }
    return providerSuccess(input.context, scopedDedupeIdentity(input));
  }

  async inspectAcceptance(
    input: LinkedInAcceptanceInput
  ): Promise<ProviderReadResult<typeof linkedInAcceptanceFixture>> {
    const failure = readFailure<typeof linkedInAcceptanceFixture>(
      input.context,
      this.#scenario,
      "LINKEDIN"
    );
    if (failure) {
      return failure;
    }
    return providerSuccess(input.context, linkedInAcceptanceFixture);
  }

  async invite(
    input: LinkedInInviteInput
  ): Promise<ProviderWriteResult<typeof linkedInInviteReceiptFixture>> {
    const invalid = invalidIf(
      input.note !== null,
      input.context,
      "note",
      "invitations must not carry a note"
    );
    if (invalid) {
      return invalid;
    }
    const failure = writeFailure<typeof linkedInInviteReceiptFixture>(
      input.context,
      this.#scenario,
      "LINKEDIN"
    );
    if (failure) {
      return failure;
    }
    return providerSuccess(input.context, scopedInviteReceipt(input));
  }

  async normalize(
    input: ProviderEventNormalizationInput
  ): Promise<ProviderReadResult<typeof providerEventNormalizationFixture>> {
    const invalid = invalidIf(
      input.rawBody.trim().length === 0,
      input.context,
      "rawBody",
      "rawBody must not be empty"
    );
    if (invalid) {
      return invalid;
    }
    const failure = eventFailure<typeof providerEventNormalizationFixture>(
      input.context,
      this.#scenario
    );
    if (failure) {
      return failure;
    }
    return providerSuccess(input.context, scopedEventNormalization(input));
  }

  async readAccountCapabilities(
    input: LinkedInAccountStatusInput
  ): Promise<
    ProviderReadResult<typeof linkedInAccountStatusFixture.capabilities>
  > {
    const failure = readFailure<
      typeof linkedInAccountStatusFixture.capabilities
    >(input.context, this.#scenario, "LINKEDIN");
    if (failure) {
      return failure;
    }
    return providerSuccess(
      input.context,
      linkedInAccountStatusFixture.capabilities
    );
  }

  async readAccountStatus(
    input: LinkedInAccountStatusInput
  ): Promise<ProviderReadResult<typeof linkedInAccountStatusFixture>> {
    const failure = readFailure<typeof linkedInAccountStatusFixture>(
      input.context,
      this.#scenario,
      "LINKEDIN"
    );
    if (failure) {
      return failure;
    }
    return providerSuccess(input.context, scopedAccountStatus(input));
  }

  async readProfile(
    input: LinkedInReadProfileInput
  ): Promise<ProviderReadResult<typeof linkedInProfileFixture>> {
    const invalid = invalidIf(
      input.providerProfileId.trim().length === 0,
      input.context,
      "providerProfileId",
      "providerProfileId must not be empty"
    );
    if (invalid) {
      return invalid;
    }
    const failure = readFailure<typeof linkedInProfileFixture>(
      input.context,
      this.#scenario,
      "LINKEDIN"
    );
    if (failure) {
      return failure;
    }
    return providerSuccess(input.context, scopedProfile(input));
  }

  async readRecentConversation(
    input: LinkedInConversationInput
  ): Promise<ProviderReadResult<typeof linkedInConversationPageFixture>> {
    const invalid = invalidIf(
      input.limit < 1 || input.limit > 100,
      input.context,
      "limit",
      "limit must be between 1 and 100"
    );
    if (invalid) {
      return invalid;
    }
    const failure = readFailure<typeof linkedInConversationPageFixture>(
      input.context,
      this.#scenario,
      "LINKEDIN"
    );
    if (failure) {
      return failure;
    }
    return providerSuccess(input.context, scopedConversationPage(input));
  }

  async searchCandidates(
    input: LinkedInSearchCandidatesInput
  ): Promise<ProviderReadResult<typeof linkedInCandidatePageFixture>> {
    const invalid = invalidIf(
      input.limit < 1 || input.limit > 100,
      input.context,
      "limit",
      "limit must be between 1 and 100"
    );
    if (invalid) {
      return invalid;
    }
    const failure = readFailure<typeof linkedInCandidatePageFixture>(
      input.context,
      this.#scenario,
      "LINKEDIN"
    );
    if (failure) {
      return failure;
    }
    return providerSuccess(input.context, linkedInCandidatePageFixture);
  }

  async sendMessage(
    input: LinkedInSendMessageInput
  ): Promise<ProviderWriteResult<typeof linkedInMessageReceiptFixture>> {
    const invalid = invalidIf(
      input.text.trim().length === 0,
      input.context,
      "text",
      "text must not be empty"
    );
    if (invalid) {
      return invalid;
    }
    const failure = writeFailure<typeof linkedInMessageReceiptFixture>(
      input.context,
      this.#scenario,
      "LINKEDIN"
    );
    if (failure) {
      return failure;
    }
    return providerSuccess(input.context, scopedMessageReceipt(input));
  }
}

export class FakeModelPorts implements TypeSafeDecisionPort, WritingPort {
  readonly #scenario: FakeFailureScenario;

  constructor(scenario: FakeFailureScenario = fakeSuccessScenario) {
    this.#scenario = scenario;
  }

  async compose(
    input: WritingInput
  ): Promise<ProviderReadResult<typeof writingResultFixture>> {
    const invalid = invalidIf(
      input.outputBudget.maxCharacters < 1 || input.outputBudget.maxTokens < 1,
      input.context,
      "outputBudget",
      "output budget must be positive"
    );
    if (invalid) {
      return invalid;
    }
    const failure = readFailure<typeof writingResultFixture>(
      input.context,
      this.#scenario,
      "WRITING"
    );
    if (failure) {
      return failure;
    }
    const outputTokens = Math.min(
      writingResultFixture.usage.outputTokens,
      input.outputBudget.maxTokens
    );
    const tokenBoundCharacters =
      outputTokens >= writingResultFixture.usage.outputTokens
        ? writingResultFixture.text.length
        : Math.max(
            1,
            Math.floor(
              (writingResultFixture.text.length * outputTokens) /
                writingResultFixture.usage.outputTokens
            )
          );
    const text = writingResultFixture.text.slice(
      0,
      Math.min(input.outputBudget.maxCharacters, tokenBoundCharacters)
    );
    const truncated =
      text.length < writingResultFixture.text.length ||
      outputTokens < writingResultFixture.usage.outputTokens;
    return providerSuccess(input.context, {
      ...writingResultFixture,
      finishReason: truncated ? "TRUNCATED" : "COMPLETE",
      modelVersion: input.sourceVersions.model,
      text,
      usage: {
        ...writingResultFixture.usage,
        outputTokens,
        totalTokens: writingResultFixture.usage.inputTokens + outputTokens,
      },
    });
  }

  async decide(
    input: TypeSafeDecisionInput
  ): Promise<ProviderReadResult<typeof typeSafeDecisionFixture>> {
    if (input.question.choices.length === 0) {
      return providerInvalidInput(
        input.context,
        "question.choices",
        "question must contain at least one choice"
      );
    }
    if (input.question.choices.length > TYPESAFE_LIMITS.maxQuestionChoices) {
      return providerInvalidInput(
        input.context,
        "question.choices",
        `question cannot contain more than ${TYPESAFE_LIMITS.maxQuestionChoices} choices`,
        "OUT_OF_BOUNDS"
      );
    }
    if (input.question.prompt.length > TYPESAFE_LIMITS.maxPromptCharacters) {
      return providerInvalidInput(
        input.context,
        "question.prompt",
        `question prompt cannot exceed ${TYPESAFE_LIMITS.maxPromptCharacters} characters`,
        "OUT_OF_BOUNDS"
      );
    }
    if (input.evidence.length > TYPESAFE_LIMITS.maxEvidence) {
      return providerInvalidInput(
        input.context,
        "evidence",
        `evidence cannot contain more than ${TYPESAFE_LIMITS.maxEvidence} items`,
        "OUT_OF_BOUNDS"
      );
    }
    const failure = readFailure<typeof typeSafeDecisionFixture>(
      input.context,
      this.#scenario,
      "TYPESAFE"
    );
    if (failure) {
      return failure;
    }
    const answer = input.question.choices[0] ?? null;
    const answerEvidenceIds = input.evidence[0]
      ? [input.evidence[0].evidenceId]
      : [];
    return providerSuccess(input.context, {
      ...typeSafeDecisionFixture,
      answer,
      answerEvidenceIds,
      modelVersion: input.modelVersion,
      questionId: input.question.id,
      schemaVersion: input.question.schemaVersion,
      uncertainty: answerEvidenceIds.length > 0 ? "LOW" : "HIGH",
    });
  }
}

export class FakeBillingPort implements BillingPort {
  readonly #scenario: FakeFailureScenario;

  constructor(scenario: FakeFailureScenario = fakeSuccessScenario) {
    this.#scenario = scenario;
  }

  async createCheckoutSession(
    input: Parameters<BillingPort["createCheckoutSession"]>[0]
  ): ReturnType<BillingPort["createCheckoutSession"]> {
    const failure = writeFailure<typeof billingHostedSessionFixture>(
      input.context,
      this.#scenario,
      "BILLING"
    );
    if (failure) {
      return failure;
    }
    return providerSuccess(input.context, billingHostedSessionFixture);
  }

  async createPortalSession(
    input: Parameters<BillingPort["createPortalSession"]>[0]
  ): ReturnType<BillingPort["createPortalSession"]> {
    const failure = writeFailure<typeof billingHostedSessionFixture>(
      input.context,
      this.#scenario,
      "BILLING"
    );
    if (failure) {
      return failure;
    }
    return providerSuccess(input.context, billingHostedSessionFixture);
  }

  async readCurrentSubscription(
    input: Parameters<BillingPort["readCurrentSubscription"]>[0]
  ): ReturnType<BillingPort["readCurrentSubscription"]> {
    const failure = readFailure<typeof billingSubscriptionFixture>(
      input.context,
      this.#scenario,
      "BILLING"
    );
    if (failure) {
      return failure;
    }
    return providerSuccess(input.context, scopedBillingSubscription(input));
  }

  async verifyWebhookSignature(
    input: BillingSignatureVerificationInput
  ): ReturnType<BillingPort["verifyWebhookSignature"]> {
    const invalid = invalidIf(
      input.rawBody.trim().length === 0 ||
        input.signatureHeader.trim().length === 0,
      input.context,
      "rawBody",
      "rawBody and signatureHeader must not be empty"
    );
    if (invalid) {
      return invalid;
    }
    const failure = readFailure<typeof billingSignatureVerificationFixture>(
      input.context,
      this.#scenario,
      "BILLING"
    );
    if (failure) {
      return failure;
    }
    return providerSuccess(input.context, billingSignatureVerificationFixture);
  }
}

export class FakeEmailPort implements EmailPort {
  readonly #scenario: FakeFailureScenario;

  constructor(scenario: FakeFailureScenario = fakeSuccessScenario) {
    this.#scenario = scenario;
  }

  async send(input: EmailDeliveryInput): ReturnType<EmailPort["send"]> {
    const invalid = invalidIf(
      input.recipient.address.trim().length === 0 ||
        input.deliveryIdentity.trim().length === 0,
      input.context,
      "recipient.address",
      "recipient and deliveryIdentity must not be empty"
    );
    if (invalid) {
      return invalid;
    }
    const failure = writeFailure<typeof emailDeliveryFixture>(
      input.context,
      this.#scenario,
      "EMAIL"
    );
    if (failure) {
      return failure;
    }
    return providerSuccess(input.context, scopedEmailDelivery(input));
  }
}

export class FakeObjectStoragePort implements ObjectStoragePort {
  readonly #scenario: FakeFailureScenario;

  constructor(scenario: FakeFailureScenario = fakeSuccessScenario) {
    this.#scenario = scenario;
  }

  async createPresignedRead(
    input: PresignedReadInput
  ): ReturnType<ObjectStoragePort["createPresignedRead"]> {
    const invalid = invalidIf(
      input.expiresInSeconds < 1 || input.expiresInSeconds > 86_400,
      input.context,
      "expiresInSeconds",
      "expiry must be between 1 and 86400 seconds"
    );
    if (invalid) {
      return invalid;
    }
    const failure = readFailure<typeof presignedReadOperationFixture>(
      input.context,
      this.#scenario,
      "OBJECT_STORAGE"
    );
    if (failure) {
      return failure;
    }
    return providerSuccess(input.context, scopedPresignedRead(input));
  }

  async putPrivateObject(
    input: PrivateObjectInput
  ): ReturnType<ObjectStoragePort["putPrivateObject"]> {
    const invalid = invalidIf(
      input.content.byteLength > 5_000_000 || input.metadata.length > 20,
      input.context,
      "content",
      "fixture content or metadata exceeds the bounded limit"
    );
    if (invalid) {
      return invalid;
    }
    const failure = writeFailure<typeof privateObjectFixture>(
      input.context,
      this.#scenario,
      "OBJECT_STORAGE"
    );
    if (failure) {
      return failure;
    }
    return providerSuccess(input.context, scopedPrivateObject(input));
  }
}

export type FakeProviderPorts = Readonly<{
  billing: FakeBillingPort;
  email: FakeEmailPort;
  events: FakeLinkedInPorts;
  linkedin: FakeLinkedInPorts;
  model: FakeModelPorts;
  objects: FakeObjectStoragePort;
}>;

export function createFakeProviderPorts(
  scenario: FakeFailureScenario = fakeSuccessScenario
): FakeProviderPorts {
  return Object.freeze({
    billing: new FakeBillingPort(scenario),
    email: new FakeEmailPort(scenario),
    events: new FakeLinkedInPorts(scenario),
    linkedin: new FakeLinkedInPorts(scenario),
    model: new FakeModelPorts(scenario),
    objects: new FakeObjectStoragePort(scenario),
  });
}
