import {
  DEFAULT_BUSINESS_WINDOW_CONFIGURATION,
  DEFAULT_SEQUENCE_PLAN,
} from "../values";
import type { BillingRedirectView, BillingView } from "./billing";
import type { CampaignListView, CampaignView } from "./campaign";
import type { ProductViewState } from "./common";
import type { LinkedInConnectionView, LinkedInAccountView } from "./connection";
import type { MetricsView } from "./metrics";
import {
  parseBillingRedirectView,
  parseBillingView,
  parseCampaignListView,
  parseCampaignView,
  parseConversationTimelineView,
  parseDraftPreviewView,
  parseLinkedInAccountView,
  parseLinkedInConnectionView,
  parseMetricsView,
  parseOnboardingView,
  parsePipelinePageView,
  parseProfileView,
  parseProductError,
  parseStyleView,
} from "./parsers";
import type { PipelinePageView } from "./pipeline";
import type { OnboardingView, ProfileView } from "./profile";
import type { DraftPreviewView, StyleView } from "./style";
import type { ConversationTimelineView } from "./timeline";

export const PRODUCT_FIXTURE_TIME = "2026-09-17T10:00:00.000Z";

const PROFILE_INPUT = {
  availability: "Disponible 3 jours par semaine",
  dayRateCents: 75_000,
  exclusions: ["Pas de missions full-time"],
  geography: "France et télétravail UE",
  offer: "J’aide les équipes SaaS à structurer leur prospection B2B.",
  preferredTone: "DIRECT",
  skills: ["Prospection B2B", "Stratégie commerciale"],
  targetMarket: "Éditeurs SaaS B2B",
  writingSamples: ["Bonjour, je vous contacte au sujet de votre recrutement."],
} as const;

export const profileViewFixture: ProfileView = parseProfileView({
  ...PROFILE_INPUT,
  onboardingComplete: true,
  profileVersionId: "profile_version_demo_1",
  revision: 4,
  styleAdaptation: "PROFILE_FACTS_ONLY",
  tenantId: "tenant_demo",
  updatedAt: PRODUCT_FIXTURE_TIME,
});

export const onboardingViewFixture: OnboardingView = parseOnboardingView({
  completedAt: PRODUCT_FIXTURE_TIME,
  currentStep: "READY",
  profile: profileViewFixture,
  revision: 4,
  status: "COMPLETE",
  tenantId: "tenant_demo",
});

export const profileLoadingStateFixture: ProductViewState<ProfileView> = {
  data: null,
  status: "LOADING",
};

export const profileEmptyStateFixture: ProductViewState<ProfileView> = {
  data: null,
  status: "EMPTY",
};

export const unauthorizedErrorFixture = Object.freeze({
  ...parseProductError({
    code: "UNAUTHORIZED",
    field: null,
    retryable: false,
    revision: null,
  }),
  code: "UNAUTHORIZED" as const,
});

export const revisionConflictErrorFixture = parseProductError({
  code: "REVISION_CONFLICT",
  field: null,
  retryable: false,
  revision: {
    actual: 8,
    expected: 7,
  },
});

export const unavailableErrorFixture = parseProductError({
  code: "UNAVAILABLE",
  field: null,
  retryable: true,
  revision: null,
});

export const profileUnauthorizedStateFixture: ProductViewState<ProfileView> = {
  data: null,
  error: unauthorizedErrorFixture,
  status: "UNAUTHORIZED",
};

export const linkedinConnectedAccountFixture: LinkedInAccountView =
  parseLinkedInAccountView({
    accountId: "account_demo",
    capabilities: {
      canInvite: true,
      canMessage: true,
      canReadMessages: true,
      canSearch: true,
    },
    connectedAt: PRODUCT_FIXTURE_TIME,
    displayName: "Compte LinkedIn de démonstration",
    health: "HEALTHY",
    lastCheckedAt: PRODUCT_FIXTURE_TIME,
    outboundPaused: false,
    pauseReason: null,
    reconciliationRequired: false,
    revision: 3,
    status: "CONNECTED",
    tenantId: "tenant_demo",
  });

export const linkedinRestrictedAccountFixture: LinkedInAccountView =
  parseLinkedInAccountView({
    accountId: "account_restricted",
    capabilities: {
      canInvite: false,
      canMessage: false,
      canReadMessages: true,
      canSearch: null,
    },
    connectedAt: PRODUCT_FIXTURE_TIME,
    displayName: "Compte soumis à vérification",
    health: "DEGRADED",
    lastCheckedAt: PRODUCT_FIXTURE_TIME,
    outboundPaused: true,
    pauseReason: "ACCOUNT_RESTRICTED",
    reconciliationRequired: false,
    revision: 5,
    status: "RESTRICTED",
    tenantId: "tenant_demo",
  });

export const linkedinManuallyPausedAccountFixture: LinkedInAccountView =
  parseLinkedInAccountView({
    accountId: "account_manual_pause",
    capabilities: {
      canInvite: true,
      canMessage: true,
      canReadMessages: true,
      canSearch: true,
    },
    connectedAt: PRODUCT_FIXTURE_TIME,
    displayName: "Compte mis en pause manuellement",
    health: "HEALTHY",
    lastCheckedAt: PRODUCT_FIXTURE_TIME,
    outboundPaused: true,
    pauseReason: "ACCOUNT_MANUAL_PAUSE",
    reconciliationRequired: false,
    revision: 4,
    status: "CONNECTED",
    tenantId: "tenant_demo",
  });

export const linkedinConnectionViewFixture: LinkedInConnectionView =
  parseLinkedInConnectionView({
    accounts: [
      linkedinConnectedAccountFixture,
      linkedinManuallyPausedAccountFixture,
      linkedinRestrictedAccountFixture,
    ],
    selectedAccountId: "account_demo",
    tenantId: "tenant_demo",
  });

export const linkedinLoadingStateFixture: ProductViewState<LinkedInConnectionView> =
  {
    data: null,
    status: "LOADING",
  };

const CAMPAIGN_INPUT = {
  businessWindow: DEFAULT_BUSINESS_WINDOW_CONFIGURATION,
  dailyQuota: 20,
  exclusions: ["Agences concurrentes"],
  name: "SaaS France",
  offer: "Structuration de la prospection B2B SaaS",
  sequence: DEFAULT_SEQUENCE_PLAN,
  targeting: {
    companySizes: ["11-50", "51-200"],
    geographies: ["France"],
    industries: ["SaaS"],
    jobTitles: ["Head of Sales", "CEO"],
    seniority: ["DIRECTOR", "C_LEVEL"],
  },
} as const;

export const campaignViewFixture: CampaignView = parseCampaignView({
  ...CAMPAIGN_INPUT,
  activationAuthorizesBoundedSequence: true,
  activatedAt: PRODUCT_FIXTURE_TIME,
  campaignId: "campaign_demo",
  campaignVersionId: "campaign_version_demo_1",
  outboundPaused: false,
  pauseReason: null,
  pausedAt: null,
  revision: 6,
  status: "ACTIVE",
  stopOnReply: true,
  tenantId: "tenant_demo",
  updatedAt: PRODUCT_FIXTURE_TIME,
});

export const campaignListViewFixture: CampaignListView = parseCampaignListView({
  items: [campaignViewFixture],
  page: {
    cursor: null,
    hasMore: false,
    nextCursor: null,
    totalCount: 1,
  },
  tenantId: "tenant_demo",
});

export const pausedCampaignViewFixture: CampaignView = parseCampaignView({
  ...campaignViewFixture,
  outboundPaused: true,
  pauseReason: "CAMPAIGN_PAUSED",
  pausedAt: PRODUCT_FIXTURE_TIME,
  status: "PAUSED",
});

export const campaignPausedStateFixture: ProductViewState<CampaignView> = {
  data: pausedCampaignViewFixture,
  reason: "CAMPAIGN_PAUSED",
  status: "PAUSED",
};

export const styleViewFixture: StyleView = parseStyleView({
  examples: ["Bonjour, votre expérience m’intéresse."],
  instructions: "Rester précis, humain et concis.",
  acceptedInferredStyleVersionId: null,
  explicitStyleVersionId: "style_explicit_demo_2",
  inferredEvidenceIds: ["evidence_style_demo"],
  revision: 2,
  source: "EXPLICIT",
  stepOverrides: [
    {
      step: "DM1",
      text: "Bonjour, votre expérience chez {{company}} m’intéresse.",
    },
  ],
  suggestedInferredStyleVersionId: null,
  tenantId: "tenant_demo",
  tone: "DIRECT",
  updatedAt: PRODUCT_FIXTURE_TIME,
});

export const styleLoadingStateFixture: ProductViewState<StyleView> = {
  data: null,
  status: "LOADING",
};

export const draftPreviewViewFixture: DraftPreviewView = parseDraftPreviewView({
  expiresAt: "2026-09-17T10:05:00.000Z",
  generatedAt: PRODUCT_FIXTURE_TIME,
  previewId: "preview_demo_1",
  sendAuthorization: "NOT_REQUESTED",
  sendEnqueued: false,
  step: "DM1",
  tenantId: "tenant_demo",
  text: "Bonjour, votre expérience chez Acme m’intéresse.",
});

export const pipelinePageFixture: PipelinePageView = parsePipelinePageView({
  items: [
    {
      accountId: "account_demo",
      automation: "ACTIVE",
      campaignId: "campaign_demo",
      campaignName: "SaaS France",
      conversationId: null,
      displayName: "Camille Martin",
      evidenceCount: 2,
      evidenceStatus: "VALID",
      headline: "Head of Sales chez Acme",
      holdReasons: [],
      lastActivityAt: PRODUCT_FIXTURE_TIME,
      nextDueAt: "2026-09-18T09:00:00.000Z",
      nextStep: "INVITATION",
      ownership: "BOT_ELIGIBLE",
      prospectId: "prospect_demo",
      stage: "DISCOVERED",
      tenantId: "tenant_demo",
      unknownActionCount: 0,
    },
    {
      accountId: "account_demo",
      automation: "HUMAN_HANDOVER",
      campaignId: "campaign_demo",
      campaignName: "SaaS France",
      conversationId: "conversation_demo",
      displayName: "Alex Dubois",
      evidenceCount: 1,
      evidenceStatus: "VALID",
      headline: "CEO chez Beta",
      holdReasons: ["INCOMING_MESSAGE", "UNKNOWN_SEND"],
      lastActivityAt: PRODUCT_FIXTURE_TIME,
      nextDueAt: null,
      nextStep: null,
      ownership: "HUMAN_OWNED",
      prospectId: "prospect_replied",
      stage: "REPLIED",
      tenantId: "tenant_demo",
      unknownActionCount: 1,
    },
  ],
  page: {
    cursor: null,
    hasMore: false,
    nextCursor: null,
    totalCount: 2,
  },
  tenantId: "tenant_demo",
});

export const pipelineEmptyStateFixture: ProductViewState<PipelinePageView> = {
  data: null,
  status: "EMPTY",
};

export const conversationTimelineViewFixture: ConversationTimelineView =
  parseConversationTimelineView({
    accountId: "account_demo",
    automation: "HUMAN_HANDOVER",
    conversationId: "conversation_demo",
    handover: {
      instruction: "REPLY_IN_LINKEDIN",
      reason: "INCOMING_MESSAGE",
      required: true,
    },
    lastIncomingAt: PRODUCT_FIXTURE_TIME,
    linkedinConversationUrl: "https://www.linkedin.com/messaging/thread/demo",
    linkedinProfileUrl: "https://www.linkedin.com/in/prospect-demo",
    messages: {
      items: [
        {
          actor: "BOT",
          attachments: [],
          direction: "OUTBOUND",
          messageId: "message_bot_demo",
          occurredAt: "2026-09-16T10:00:00.000Z",
          receivedAt: "2026-09-16T10:00:01.000Z",
          source: "SEND_LEDGER",
          text: "Bonjour, votre expérience m’intéresse.",
        },
        {
          actor: "PROSPECT",
          attachments: [
            {
              contentType: "application/pdf",
              kind: "FILE",
              name: "brief.pdf",
              sizeBytes: 2048,
            },
          ],
          direction: "INBOUND",
          messageId: "message_attachment_demo",
          occurredAt: PRODUCT_FIXTURE_TIME,
          receivedAt: PRODUCT_FIXTURE_TIME,
          source: "PROVIDER_EVENT",
          text: null,
        },
      ],
      page: {
        cursor: null,
        hasMore: false,
        nextCursor: null,
        totalCount: 2,
      },
    },
    ownership: "HUMAN_OWNED",
    pauseReason: "HUMAN_HANDOVER",
    prospectId: "prospect_replied",
    revision: 9,
    tenantId: "tenant_demo",
    unknownOutcomes: [
      {
        occurredAt: "2026-09-15T10:00:00.000Z",
        reason: "TIMEOUT",
        step: "DM1",
      },
    ],
    updatedAt: PRODUCT_FIXTURE_TIME,
  });

export const billingViewFixture: BillingView = parseBillingView({
  cancelAtPeriodEnd: false,
  currentPeriodEnd: "2026-10-17T00:00:00.000Z",
  entitlement: "OUTBOUND_ENABLED",
  lastUpdatedAt: PRODUCT_FIXTURE_TIME,
  revision: 2,
  status: "ACTIVE",
  tenantId: "tenant_demo",
});

export const billingPendingViewFixture: BillingView = parseBillingView({
  cancelAtPeriodEnd: null,
  currentPeriodEnd: null,
  entitlement: "OUTBOUND_PAUSED",
  lastUpdatedAt: PRODUCT_FIXTURE_TIME,
  revision: 3,
  status: "PENDING",
  tenantId: "tenant_demo",
});

export const billingPausedStateFixture: ProductViewState<BillingView> = {
  data: billingPendingViewFixture,
  reason: "ENTITLEMENT_INACTIVE",
  status: "PAUSED",
};

export const billingRedirectViewFixture: BillingRedirectView =
  parseBillingRedirectView({
    entitlementChanged: false,
    expiresAt: "2026-09-17T10:05:00.000Z",
    operation: "CHECKOUT",
    url: "https://billing.example.test/checkout/session_demo",
  });

export const metricsViewFixture: MetricsView = parseMetricsView({
  asOf: PRODUCT_FIXTURE_TIME,
  coverage: "COMPLETE",
  counts: {
    confirmedMessages: 4,
    handovers: 2,
    invitationsAccepted: 3,
    invitationsSent: 5,
    replies: 2,
    unknownActions: 1,
  },
  rates: {
    acceptanceRate: 0.6,
    handoverRate: 0.5,
    replyRate: 0.4,
  },
  range: {
    from: "2026-09-01T00:00:00.000Z",
    to: PRODUCT_FIXTURE_TIME,
  },
  spend: {
    amountCents: 1250,
    currency: "EUR",
  },
  tenantId: "tenant_demo",
});

export const metricsEmptyStateFixture: ProductViewState<MetricsView> = {
  data: null,
  status: "EMPTY",
};

export const unavailableErrorStateFixture: ProductViewState<MetricsView> = {
  data: null,
  error: unavailableErrorFixture,
  status: "ERROR",
};
