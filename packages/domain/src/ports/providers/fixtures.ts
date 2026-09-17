import {
  attachmentOnlyInboundEventFixture,
  attachmentOnlyInboundMessageFixture,
  outgoingBotEchoMessageFixture,
} from "../../contracts/fixtures";
import {
  parseAccountId,
  parseActionId,
  parseConversationId,
  parseEvidenceId,
  parseModelVersion,
  parseProspectId,
  parseSendAttemptId,
  parseTenantId,
} from "../../contracts/ids";
import { parseDraftSourceVersions } from "../../contracts/parsers";
import { parseUtcTimestamp } from "../../contracts/values";
import type {
  BillingCheckoutInput,
  BillingCustomerRef,
  BillingHostedSession,
  BillingPortalInput,
  BillingSignatureVerification,
  BillingSubscription,
  BillingSubscriptionInput,
} from "./billing";
import type { ModelUsage, ProviderOperationContext } from "./common";
import type {
  TypeSafeChoice,
  TypeSafeDecision,
  TypeSafeDecisionInput,
} from "./decisions";
import type { EmailDelivery, EmailDeliveryInput } from "./email";
import type {
  ProviderEventAuthentication,
  ProviderEventDedupeIdentity,
  ProviderEventNormalization,
  ProviderIncomingMessageEvent,
} from "./events";
import type {
  LinkedInAcceptance,
  LinkedInAcceptanceInput,
  LinkedInAccountRef,
  LinkedInAccountStatus,
  LinkedInAccountStatusInput,
  LinkedInCapabilities,
  LinkedInCandidatePage,
  LinkedInConnectInput,
  LinkedInConversationInput,
  LinkedInConversationPage,
  LinkedInHostedFlow,
  LinkedInInviteInput,
  LinkedInInviteReceipt,
  LinkedInMessageReceipt,
  LinkedInProfileSnapshot,
  LinkedInReadProfileInput,
  LinkedInReconnectInput,
  LinkedInSearchCandidatesInput,
  LinkedInSendMessageInput,
} from "./linkedin";
import type {
  AuthorizedObjectKey,
  PresignedReadInput,
  PresignedReadOperation,
  PrivateObject,
  PrivateObjectInput,
} from "./objects";
import type { WritingInput, WritingResult } from "./writing";

export const providerOperationContextFixture: ProviderOperationContext =
  Object.freeze({
    correlationId: "correlation_provider_demo_1",
    deadlineAt: parseUtcTimestamp("2026-09-17T10:05:00.000Z"),
  });

export const linkedInAccountFixture: LinkedInAccountRef = Object.freeze({
  accountId: parseAccountId("account_demo"),
  providerAccountId: "linkedin_account_demo",
  tenantId: parseTenantId("tenant_demo"),
});

export const linkedInConnectInputFixture: LinkedInConnectInput = Object.freeze({
  callbackUrl: "https://app.example.test/settings/accounts/callback",
  context: providerOperationContextFixture,
  opaqueState: "connection_attempt_demo_1",
  tenantId: parseTenantId("tenant_demo"),
});

export const linkedInReconnectInputFixture: LinkedInReconnectInput =
  Object.freeze({
    account: linkedInAccountFixture,
    callbackUrl: "https://app.example.test/settings/accounts/reconnect",
    context: providerOperationContextFixture,
    opaqueState: "reconnect_attempt_demo_1",
  });

export const linkedInCapabilitiesFixture: LinkedInCapabilities = Object.freeze({
  canInvite: true,
  canReadAcceptance: true,
  canReadConversation: true,
  canReadProfiles: true,
  canSendMessages: true,
  canUseEvents: true,
  searchModes: Object.freeze({
    classic: true,
    recruiter: null,
    salesNavigator: false,
  }),
});

export const linkedInHostedFlowFixture: LinkedInHostedFlow = Object.freeze({
  authorizationUrl: "https://provider.example.test/hosted-auth/demo",
  expiresAt: parseUtcTimestamp("2026-09-17T10:15:00.000Z"),
  flowReference: "provider_flow_demo_1",
  mode: "CONNECT",
});

export const linkedInAccountStatusInputFixture: LinkedInAccountStatusInput =
  Object.freeze({
    account: linkedInAccountFixture,
    context: providerOperationContextFixture,
  });

export const linkedInAccountStatusFixture: LinkedInAccountStatus =
  Object.freeze({
    account: linkedInAccountFixture,
    capabilities: linkedInCapabilitiesFixture,
    health: Object.freeze({
      checkedAt: parseUtcTimestamp("2026-09-17T10:00:00.000Z"),
      reason: null,
      status: "CONNECTED",
    }),
    observedAt: parseUtcTimestamp("2026-09-17T10:00:00.000Z"),
  });

export const linkedInSearchCandidatesInputFixture: LinkedInSearchCandidatesInput =
  Object.freeze({
    account: linkedInAccountFixture,
    context: providerOperationContextFixture,
    cursor: null,
    limit: 25,
    query: Object.freeze({
      currentCompanies: ["Relanmo customer example"],
      keywords: ["recrutement"],
      locations: ["France"],
      titles: ["CTO"],
    }),
  });

export const linkedInCandidatePageFixture: LinkedInCandidatePage =
  Object.freeze({
    candidates: [
      Object.freeze({
        currentCompany: "Entreprise exemple",
        currentRole: "CTO",
        displayName: "Camille Exemple",
        headline: "CTO · recrutement tech",
        location: "Paris",
        missingFields: [],
        observedAt: parseUtcTimestamp("2026-09-17T10:00:00.000Z"),
        profileUrl: "https://www.linkedin.com/in/camille-exemple",
        providerProfileId: "linkedin_profile_demo",
        provenance: "SEARCH_RESULT",
      }),
    ],
    exhausted: false,
    nextCursor: "cursor_demo_2",
    observedAt: parseUtcTimestamp("2026-09-17T10:00:00.000Z"),
  });

export const linkedInReadProfileInputFixture: LinkedInReadProfileInput =
  Object.freeze({
    account: linkedInAccountFixture,
    context: providerOperationContextFixture,
    providerProfileId: "linkedin_profile_demo",
  });

export const linkedInProfileFixture: LinkedInProfileSnapshot = Object.freeze({
  currentCompany: "Entreprise exemple",
  currentRole: "CTO",
  displayName: "Camille Exemple",
  headline: "CTO · recrutement tech",
  location: "Paris",
  missingFields: [],
  observedAt: parseUtcTimestamp("2026-09-17T10:00:00.000Z"),
  profileUrl: "https://www.linkedin.com/in/camille-exemple",
  providerProfileId: "linkedin_profile_demo",
  provenance: "PROFILE_READ",
});

export const linkedInInviteInputFixture: LinkedInInviteInput = Object.freeze({
  account: linkedInAccountFixture,
  actionId: parseActionId("action_invitation_1"),
  context: providerOperationContextFixture,
  note: null,
  prospectId: parseProspectId("prospect_demo"),
  providerProfileId: "linkedin_profile_demo",
});

export const linkedInInviteReceiptFixture: LinkedInInviteReceipt =
  Object.freeze({
    providerEvidence: Object.freeze({
      observedAt: parseUtcTimestamp("2026-09-17T10:00:00.000Z"),
      reference: "provider_invitation_demo_1",
      source: "PROVIDER_RECEIPT",
    }),
    providerInvitationId: "provider_invitation_demo_1",
    submittedAt: parseUtcTimestamp("2026-09-17T10:00:00.000Z"),
  });

export const linkedInAcceptanceInputFixture: LinkedInAcceptanceInput =
  Object.freeze({
    account: linkedInAccountFixture,
    context: providerOperationContextFixture,
    prospectId: parseProspectId("prospect_demo"),
    providerProfileId: "linkedin_profile_demo",
  });

export const linkedInAcceptanceFixture: LinkedInAcceptance = Object.freeze({
  accepted: true,
  observedAt: parseUtcTimestamp("2026-09-17T10:00:00.000Z"),
  providerEvidence: Object.freeze({
    observedAt: parseUtcTimestamp("2026-09-17T10:00:00.000Z"),
    reference: "provider_invitation_demo_1",
    source: "PROVIDER_HISTORY",
  }),
  source: "PROVIDER_HISTORY",
});

export const linkedInSendMessageInputFixture: LinkedInSendMessageInput =
  Object.freeze({
    account: linkedInAccountFixture,
    actionId: parseActionId("action_dm1_ready"),
    attemptId: parseSendAttemptId("attempt_dm1_1"),
    context: providerOperationContextFixture,
    conversationId: parseConversationId("conversation_demo"),
    prospectId: parseProspectId("prospect_demo"),
    providerProfileId: "linkedin_profile_demo",
    step: "DM1",
    text: "Bonjour, votre expérience en recrutement m’intéresse.",
  });

export const linkedInMessageReceiptFixture: LinkedInMessageReceipt =
  Object.freeze({
    providerEvidence: Object.freeze({
      observedAt: parseUtcTimestamp("2026-09-17T10:00:00.000Z"),
      reference: "provider_message_outbound_2",
      source: "PROVIDER_RECEIPT",
    }),
    providerMessageId: "provider_message_outbound_2",
    submittedAt: parseUtcTimestamp("2026-09-17T10:00:00.000Z"),
  });

export const linkedInConversationInputFixture: LinkedInConversationInput =
  Object.freeze({
    account: linkedInAccountFixture,
    context: providerOperationContextFixture,
    conversationId: parseConversationId("conversation_demo"),
    cursor: null,
    limit: 50,
    prospectId: parseProspectId("prospect_demo"),
  });

export const linkedInConversationPageFixture: LinkedInConversationPage =
  Object.freeze({
    messages: [
      attachmentOnlyInboundMessageFixture,
      outgoingBotEchoMessageFixture,
    ],
    nextCursor: null,
    observedAt: parseUtcTimestamp("2026-09-17T10:00:00.000Z"),
  });

export const providerEventAuthenticationInputFixture = Object.freeze({
  context: providerOperationContextFixture,
  headers: Object.freeze([
    Object.freeze({ name: "Provider-Auth", value: "fixture-secret" }),
  ]),
  rawBody: '{"event_id":"provider_event_inbound_1"}',
});

export const providerEventAuthenticationFixture: ProviderEventAuthentication =
  Object.freeze({
    authenticatedAt: parseUtcTimestamp("2026-09-17T10:00:00.000Z"),
    authenticationReference: "provider_event_inbound_1",
    mechanism: "PROVIDER_DEFINED",
    providerEventId: "provider_event_inbound_1",
  });

export const normalizedIncomingProviderEventFixture: ProviderIncomingMessageEvent =
  Object.freeze({
    kind: "INCOMING_MESSAGE",
    message: attachmentOnlyInboundEventFixture.message,
    occurredAt: parseUtcTimestamp("2026-09-17T10:00:00.000Z"),
    providerEventId: "provider_event_inbound_1",
    scope: Object.freeze({
      accountId: parseAccountId("account_demo"),
      tenantId: parseTenantId("tenant_demo"),
    }),
  });

export const providerEventNormalizationFixture: ProviderEventNormalization =
  Object.freeze({
    event: normalizedIncomingProviderEventFixture,
    evidence: Object.freeze({
      observedAt: parseUtcTimestamp("2026-09-17T10:00:00.000Z"),
      reference: "provider_event_inbound_1",
      source: "PROVIDER_EVENT",
    }),
  });

export const providerEventDedupeIdentityFixture: ProviderEventDedupeIdentity =
  Object.freeze({
    dedupeKey: "tenant_demo:account_demo:provider_event_inbound_1",
    eventKind: "INCOMING_MESSAGE",
    providerEventId: "provider_event_inbound_1",
    scope: normalizedIncomingProviderEventFixture.scope,
    source: "PROVIDER_EVENT_ID",
  });

export const typeSafeChoiceFixture: TypeSafeChoice = Object.freeze({
  id: "SUITABLE",
  label: "Profil adapté",
});

export const typeSafeDecisionInputFixture: TypeSafeDecisionInput =
  Object.freeze({
    context: providerOperationContextFixture,
    evidence: [
      Object.freeze({
        claim: "L’entreprise recrute des développeurs.",
        evidenceId: parseEvidenceId("evidence_offer_1"),
      }),
    ],
    modelVersion: parseModelVersion("typesafe-fixture-1"),
    prospectId: parseProspectId("prospect_demo"),
    question: Object.freeze({
      choices: [
        typeSafeChoiceFixture,
        Object.freeze({ id: "INSUFFICIENT", label: "Preuves insuffisantes" }),
      ],
      id: "icp-fit",
      prompt: "Le profil correspond-il à l’ICP ?",
      schemaVersion: "qualification-v1",
    }),
    tenantId: parseTenantId("tenant_demo"),
  });

export const modelUsageFixture: ModelUsage = Object.freeze({
  billedAmountMicros: 1200,
  currency: "USD",
  inputTokens: 80,
  outputTokens: 12,
  totalTokens: 92,
});

export const typeSafeDecisionFixture: TypeSafeDecision = Object.freeze({
  answer: typeSafeChoiceFixture,
  answerEvidenceIds: [parseEvidenceId("evidence_offer_1")],
  evaluatedAt: parseUtcTimestamp("2026-09-17T10:00:00.000Z"),
  modelVersion: parseModelVersion("typesafe-fixture-1"),
  questionId: "icp-fit",
  schemaVersion: "qualification-v1",
  uncertainty: "LOW",
  usage: modelUsageFixture,
});

export const writingInputFixture: WritingInput = Object.freeze({
  allowedEvidenceIds: [parseEvidenceId("evidence_offer_1")],
  composedInput:
    "Rédige un DM1 court en français à partir des preuves autorisées.",
  context: providerOperationContextFixture,
  outputBudget: Object.freeze({ maxCharacters: 500, maxTokens: 120 }),
  prospectId: parseProspectId("prospect_demo"),
  sourceVersions: parseDraftSourceVersions({
    acceptedInferredStyle: null,
    campaign: {
      createdAt: "2026-09-17T10:00:00.000Z",
      id: "campaign_version_alpha_1",
      kind: "CAMPAIGN",
      revision: 1,
    },
    defaultPrompt: {
      createdAt: "2026-09-17T10:00:00.000Z",
      id: "version_prompt_default_1",
      kind: "PROMPT_DEFAULT",
      revision: 3,
    },
    explicitStyle: {
      createdAt: "2026-09-17T10:00:00.000Z",
      id: "version_style_explicit_1",
      kind: "STYLE_EXPLICIT",
      revision: 2,
    },
    model: "writer-fixture-1",
    profile: {
      createdAt: "2026-09-17T10:00:00.000Z",
      id: "version_profile_1",
      kind: "PROFILE",
      revision: 4,
    },
  }),
  step: "DM1",
  tenantId: parseTenantId("tenant_demo"),
});

export const writingResultFixture: WritingResult = Object.freeze({
  modelVersion: parseModelVersion("writer-fixture-1"),
  observedAt: parseUtcTimestamp("2026-09-17T10:00:00.000Z"),
  text: "Bonjour, votre expérience en recrutement m’intéresse.",
  usage: modelUsageFixture,
});

export const billingCustomerFixture: BillingCustomerRef = Object.freeze({
  providerCustomerId: "billing_customer_demo",
  tenantId: parseTenantId("tenant_demo"),
});

export const billingCheckoutInputFixture: BillingCheckoutInput = Object.freeze({
  cancelUrl: "https://app.example.test/billing/cancel",
  context: providerOperationContextFixture,
  customer: billingCustomerFixture,
  priceId: "price_fixture_monthly",
  providerIdempotencyKey: "billing_checkout_attempt_demo_1",
  successUrl: "https://app.example.test/billing/success",
});

export const billingPortalInputFixture: BillingPortalInput = Object.freeze({
  context: providerOperationContextFixture,
  customer: billingCustomerFixture,
  providerIdempotencyKey: null,
  returnUrl: "https://app.example.test/settings/billing",
});

export const billingHostedSessionFixture: BillingHostedSession = Object.freeze({
  expiresAt: parseUtcTimestamp("2026-09-17T11:00:00.000Z"),
  sessionUrl: "https://billing.example.test/session/demo",
});

export const billingSubscriptionInputFixture: BillingSubscriptionInput =
  Object.freeze({
    context: providerOperationContextFixture,
    customer: billingCustomerFixture,
  });

export const billingSubscriptionFixture: BillingSubscription = Object.freeze({
  cancelAtPeriodEnd: false,
  currentPeriodEndsAt: parseUtcTimestamp("2026-10-17T10:00:00.000Z"),
  observedAt: parseUtcTimestamp("2026-09-17T10:00:00.000Z"),
  providerSubscriptionId: "billing_subscription_demo",
  status: "ACTIVE",
  tenantId: parseTenantId("tenant_demo"),
});

export const billingSignatureVerificationInputFixture = Object.freeze({
  context: providerOperationContextFixture,
  rawBody: '{"id":"billing_event_demo"}',
  signatureHeader: "provider-signature-fixture",
});

export const billingSignatureVerificationFixture: BillingSignatureVerification =
  Object.freeze({
    eventId: "billing_event_demo",
    verifiedAt: parseUtcTimestamp("2026-09-17T10:00:00.000Z"),
  });

export const emailDeliveryInputFixture: EmailDeliveryInput = Object.freeze({
  context: providerOperationContextFixture,
  deliveryIdentity: "notification_reply_demo_1",
  recipient: Object.freeze({
    address: "customer@example.test",
    displayName: "Client exemple",
  }),
  template: Object.freeze({
    kind: "NOTIFICATION",
    locale: "fr-FR",
    name: "INCOMING_REPLY",
    parameters: [
      Object.freeze({ key: "prospectName", value: "Camille Exemple" }),
    ],
  }),
  tenantId: parseTenantId("tenant_demo"),
});

export const emailDeliveryFixture: EmailDelivery = Object.freeze({
  acceptedAt: parseUtcTimestamp("2026-09-17T10:00:00.000Z"),
  deliveryIdentity: "notification_reply_demo_1",
  providerMessageId: "email_message_demo_1",
});

export const authorizedObjectKeyFixture: AuthorizedObjectKey = Object.freeze({
  purpose: "WRITING_SAMPLE",
  relativeKey: "sample-demo.txt",
});

export const privateObjectInputFixture: PrivateObjectInput = Object.freeze({
  content: Uint8Array.from([82, 101, 108, 97, 110, 109, 111]),
  contentType: "text/plain",
  context: providerOperationContextFixture,
  key: authorizedObjectKeyFixture,
  metadata: [Object.freeze({ key: "source", value: "fixture" })],
  tenantId: parseTenantId("tenant_demo"),
});

export const privateObjectFixture: PrivateObject = Object.freeze({
  contentType: "text/plain",
  key: authorizedObjectKeyFixture,
  observedAt: parseUtcTimestamp("2026-09-17T10:00:00.000Z"),
  sizeBytes: 7,
  tenantId: parseTenantId("tenant_demo"),
});

export const presignedReadInputFixture: PresignedReadInput = Object.freeze({
  context: providerOperationContextFixture,
  expiresInSeconds: 300,
  key: authorizedObjectKeyFixture,
  tenantId: parseTenantId("tenant_demo"),
});

export const presignedReadOperationFixture: PresignedReadOperation =
  Object.freeze({
    expiresAt: parseUtcTimestamp("2026-09-17T10:05:00.000Z"),
    key: authorizedObjectKeyFixture,
    method: "GET",
    tenantId: parseTenantId("tenant_demo"),
    url: "https://objects.example.test/presigned/demo",
  });
