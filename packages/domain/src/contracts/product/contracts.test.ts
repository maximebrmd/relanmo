import { describe, expect, it } from "vitest";

import {
  DEFAULT_BUSINESS_WINDOW_CONFIGURATION,
  DEFAULT_SEQUENCE_PLAN,
} from "../values";
import {
  billingPausedStateFixture,
  billingPendingViewFixture,
  billingRedirectViewFixture,
  billingViewFixture,
  campaignListViewFixture,
  campaignPausedStateFixture,
  campaignViewFixture,
  conversationTimelineViewFixture,
  draftPreviewViewFixture,
  linkedinConnectionViewFixture,
  linkedinManuallyPausedAccountFixture,
  linkedinLoadingStateFixture,
  metricsEmptyStateFixture,
  metricsViewFixture,
  onboardingViewFixture,
  pipelineEmptyStateFixture,
  pipelinePageFixture,
  profileEmptyStateFixture,
  profileLoadingStateFixture,
  profileUnauthorizedStateFixture,
  profileViewFixture,
  revisionConflictErrorFixture,
  styleLoadingStateFixture,
  styleViewFixture,
  unauthorizedErrorFixture,
  unavailableErrorFixture,
} from "./fixtures";
import {
  parseBillingCommand,
  parseBillingQuery,
  parseBillingRedirectView,
  parseBillingViewState,
  parseCampaignView,
  parseCampaignCommand,
  parseCampaignListViewState,
  parseCampaignQuery,
  parseCampaignViewState,
  parseConversationTimelineQuery,
  parseConversationTimelineViewState,
  parseDraftPreviewView,
  parseLinkedInCommand,
  parseLinkedInAccountView,
  parseLinkedInConnectionViewState,
  parseMetricsQuery,
  parseMetricsViewState,
  parseOnboardingViewState,
  parsePageInfo,
  parsePipelineQuery,
  parsePipelineRowView,
  parsePipelineViewState,
  parseProfileCommand,
  parseProfileViewState,
  parseProductCommandResult,
  parseProductError,
  parseProductViewState,
  parseStyleCommand,
  parseStyleViewState,
  safeParseCampaignCommand,
  safeParseProfileCommand,
  safeParseStyleCommand,
} from "./parsers";

const timestamp = "2026-09-17T10:00:00.000Z";
const profileInput = {
  availability: "Disponible",
  dayRateCents: 75_000,
  exclusions: [],
  geography: "France",
  offer: "Prospection B2B SaaS",
  preferredTone: "DIRECT",
  skills: ["Prospection"],
  targetMarket: "SaaS B2B",
  writingSamples: [],
};
const campaignInput = {
  businessWindow: DEFAULT_BUSINESS_WINDOW_CONFIGURATION,
  dailyQuota: 10,
  exclusions: [],
  name: "SaaS France",
  offer: "Prospection B2B SaaS",
  sequence: DEFAULT_SEQUENCE_PLAN,
  targeting: {
    companySizes: [],
    geographies: ["France"],
    industries: ["SaaS"],
    jobTitles: ["CEO"],
    seniority: [],
  },
};

describe("product DTO fixtures", () => {
  it("parses representative views for every customer surface", () => {
    expect(
      parseProfileViewState({ status: "READY", data: profileViewFixture })
    ).toEqual({
      status: "READY",
      data: profileViewFixture,
    });
    expect(
      parseOnboardingViewState({ status: "READY", data: onboardingViewFixture })
        .status
    ).toBe("READY");
    expect(
      parseLinkedInConnectionViewState({
        status: "READY",
        data: linkedinConnectionViewFixture,
      }).status
    ).toBe("READY");
    expect(
      parseCampaignViewState({ status: "READY", data: campaignViewFixture })
        .status
    ).toBe("READY");
    expect(
      parseCampaignListViewState({
        data: campaignListViewFixture,
        status: "READY",
      }).status
    ).toBe("READY");
    expect(
      parseStyleViewState({ status: "READY", data: styleViewFixture }).status
    ).toBe("READY");
    expect(
      parsePipelineViewState({ status: "READY", data: pipelinePageFixture })
        .status
    ).toBe("READY");
    expect(
      parseConversationTimelineViewState({
        status: "READY",
        data: conversationTimelineViewFixture,
      }).status
    ).toBe("READY");
    expect(
      parseBillingViewState({ status: "READY", data: billingViewFixture })
        .status
    ).toBe("READY");
    expect(
      parseMetricsViewState({ status: "READY", data: metricsViewFixture })
        .status
    ).toBe("READY");
  });

  it("covers loading, empty, paused, error and unauthorized states", () => {
    expect(parseProfileViewState(profileLoadingStateFixture).status).toBe(
      "LOADING"
    );
    expect(parseProfileViewState(profileEmptyStateFixture).status).toBe(
      "EMPTY"
    );
    expect(parseProfileViewState(profileUnauthorizedStateFixture).status).toBe(
      "UNAUTHORIZED"
    );
    expect(parseCampaignViewState(campaignPausedStateFixture).status).toBe(
      "PAUSED"
    );
    expect(parsePipelineViewState(pipelineEmptyStateFixture).status).toBe(
      "EMPTY"
    );
    expect(parseBillingViewState(billingPausedStateFixture).status).toBe(
      "PAUSED"
    );
    expect(parseMetricsViewState(metricsEmptyStateFixture).status).toBe(
      "EMPTY"
    );
    expect(
      parseLinkedInConnectionViewState(linkedinLoadingStateFixture).status
    ).toBe("LOADING");
    expect(parseStyleViewState(styleLoadingStateFixture).status).toBe(
      "LOADING"
    );
    expect(
      parseMetricsViewState({
        data: null,
        error: unavailableErrorFixture,
        status: "ERROR",
      }).status
    ).toBe("ERROR");
  });

  it("keeps selector IDs separate from server authorization context", () => {
    const command = parseProfileCommand({
      expectedRevision: 4,
      input: profileInput,
      kind: "SAVE_PROFILE",
      tenantId: "tenant_demo",
    });
    expect(command.tenantId).toBe("tenant_demo");
    expect(command).not.toHaveProperty("session");
    expect(command).not.toHaveProperty("member");
    expect(JSON.stringify(command)).not.toMatch(
      /token|secret|credential|rawResponse/iu
    );
  });

  it("validates all command families without requiring provider traffic", () => {
    expect(
      parseCampaignCommand({
        input: campaignInput,
        kind: "CREATE_CAMPAIGN",
        tenantId: "tenant_demo",
      }).kind
    ).toBe("CREATE_CAMPAIGN");
    expect(
      parseCampaignCommand({
        campaignId: "campaign_demo",
        expectedRevision: 6,
        kind: "ACTIVATE_CAMPAIGN",
        tenantId: "tenant_demo",
      }).kind
    ).toBe("ACTIVATE_CAMPAIGN");
    expect(
      parseCampaignQuery({
        kind: "LIST_CAMPAIGNS",
        page: { cursor: null, limit: 25 },
        tenantId: "tenant_demo",
      }).kind
    ).toBe("LIST_CAMPAIGNS");
    expect(
      parseLinkedInCommand({
        kind: "START_LINKEDIN_CONNECTION",
        returnTo: "/settings/linkedin",
        tenantId: "tenant_demo",
      }).kind
    ).toBe("START_LINKEDIN_CONNECTION");
    expect(
      parseStyleCommand({
        expectedRevision: 2,
        input: {
          addressForm: "VOUS",
          examples: [],
          instructions: null,
          stepOverrides: [],
          tone: "DIRECT",
        },
        kind: "SAVE_STYLE",
        tenantId: "tenant_demo",
      }).kind
    ).toBe("SAVE_STYLE");
    expect(
      parseStyleCommand({
        accountId: "account_demo",
        campaignId: "campaign_demo",
        kind: "PREVIEW_DRAFT",
        prospectId: "prospect_demo",
        step: "DM1",
        styleRevision: 2,
        tenantId: "tenant_demo",
      }).kind
    ).toBe("PREVIEW_DRAFT");
    expect(
      parsePipelineQuery({
        filters: {
          accountId: null,
          automation: "ACTIVE",
          campaignId: null,
          evidence: null,
          ownership: "ALL",
          search: null,
          sort: "RECENT_ACTIVITY",
          stage: null,
        },
        kind: "LIST_PIPELINE",
        page: { cursor: null, limit: 25 },
        tenantId: "tenant_demo",
      }).kind
    ).toBe("LIST_PIPELINE");
    expect(
      parseConversationTimelineQuery({
        accountId: "account_demo",
        conversationId: "conversation_demo",
        kind: "GET_CONVERSATION_TIMELINE",
        page: { cursor: null, limit: 25 },
        tenantId: "tenant_demo",
      }).kind
    ).toBe("GET_CONVERSATION_TIMELINE");
    expect(
      parseBillingQuery({ kind: "GET_BILLING", tenantId: "tenant_demo" }).kind
    ).toBe("GET_BILLING");
    expect(
      parseBillingCommand({
        kind: "START_CHECKOUT",
        returnTo: "/settings/billing",
        tenantId: "tenant_demo",
      }).kind
    ).toBe("START_CHECKOUT");
    expect(
      parseMetricsQuery({
        kind: "GET_METRICS",
        range: {
          from: "2026-09-01T00:00:00.000Z",
          to: timestamp,
        },
        tenantId: "tenant_demo",
      }).kind
    ).toBe("GET_METRICS");
  });

  it("keeps previews and billing redirects side-effect free", () => {
    expect(parseDraftPreviewView(draftPreviewViewFixture).sendEnqueued).toBe(
      false
    );
    expect(
      parseBillingRedirectView(billingRedirectViewFixture).entitlementChanged
    ).toBe(false);
    expect(JSON.stringify(draftPreviewViewFixture)).not.toMatch(
      /actionId|provider|secret|accessToken|rawResponse/iu
    );
    expect(JSON.stringify(billingRedirectViewFixture)).not.toMatch(
      /customerId|priceId|secret|token/iu
    );
    expect(billingPendingViewFixture.entitlement).toBe("OUTBOUND_PAUSED");
  });
});

describe("product DTO invalid cases", () => {
  it("rejects invalid commands and safe parser returns issues", () => {
    expect(
      safeParseProfileCommand({
        expectedRevision: 1,
        input: { ...profileInput, offer: "" },
        kind: "SAVE_PROFILE",
        tenantId: "tenant_demo",
      }).success
    ).toBe(false);
    expect(
      safeParseCampaignCommand({
        input: {
          ...campaignInput,
          sequence: [
            ...campaignInput.sequence.slice(1),
            campaignInput.sequence[0],
          ],
        },
        kind: "CREATE_CAMPAIGN",
        tenantId: "tenant_demo",
      }).success
    ).toBe(false);
    expect(
      safeParseStyleCommand({
        expectedRevision: 2,
        input: {
          addressForm: "VOUS",
          examples: [],
          instructions: null,
          stepOverrides: [
            { grounding: { kind: "NEUTRAL" }, step: "DM1", text: "Un" },
            { grounding: { kind: "NEUTRAL" }, step: "DM1", text: "Deux" },
          ],
          tone: "DIRECT",
        },
        kind: "SAVE_STYLE",
        tenantId: "tenant_demo",
      }).success
    ).toBe(false);
    expect(() =>
      parseStyleCommand({
        accountId: "account_demo",
        campaignId: "campaign_demo",
        kind: "PREVIEW_DRAFT",
        prospectId: "prospect_demo",
        step: "INVITATION",
        styleRevision: 2,
        tenantId: "tenant_demo",
      })
    ).toThrow();
  });

  it("rejects stale-version results without a complete conflict shape", () => {
    expect(revisionConflictErrorFixture.revision).toEqual({
      actual: 8,
      expected: 7,
    });
    expect(
      parseProductCommandResult(
        { error: revisionConflictErrorFixture, success: false },
        () => profileViewFixture
      )
    ).toEqual({ error: revisionConflictErrorFixture, success: false });
    expect(() =>
      parseProductError({
        code: "REVISION_CONFLICT",
        field: null,
        retryable: false,
        revision: null,
      })
    ).toThrow();
    expect(() =>
      parseProductViewState(
        {
          data: null,
          error: { ...unauthorizedErrorFixture, code: "NOT_FOUND" },
          status: "UNAUTHORIZED",
        },
        () => profileViewFixture
      )
    ).toThrow();
    expect(
      parseProductError({
        code: "VALIDATION_FAILED",
        field: "profile.input.offer",
        retryable: false,
        revision: null,
      }).field
    ).toBe("profile.input.offer");
    expect(() =>
      parseProductError({
        code: "VALIDATION_FAILED",
        field: "a".repeat(97),
        retryable: false,
        revision: null,
      })
    ).toThrow();
    expect(() =>
      parseProductError({
        code: "VALIDATION_FAILED",
        field: "accessToken=secret",
        retryable: false,
        revision: null,
      })
    ).toThrow();
    expect(() =>
      parseProductError({
        code: "VALIDATION_FAILED",
        field: "provider.response",
        retryable: false,
        revision: null,
      })
    ).toThrow();
  });

  it("rejects fabricated safety assertions and mixed-tenant aggregates", () => {
    const missingActivationAssertion = (() => {
      const {
        activationAuthorizesBoundedSequence:
          _activationAuthorizesBoundedSequence,
        ...rest
      } = campaignViewFixture;
      void _activationAuthorizesBoundedSequence;
      return rest;
    })();
    expect(() => parseCampaignView(missingActivationAssertion)).toThrow();
    expect(() =>
      parseCampaignView({
        ...campaignViewFixture,
        activationAuthorizesBoundedSequence: false,
      })
    ).toThrow();

    const missingReplyStopAssertion = (() => {
      const { stopOnReply: _stopOnReply, ...rest } = campaignViewFixture;
      void _stopOnReply;
      return rest;
    })();
    expect(() => parseCampaignView(missingReplyStopAssertion)).toThrow();
    expect(() =>
      parseCampaignView({
        ...campaignViewFixture,
        stopOnReply: false,
      })
    ).toThrow();

    expect(() =>
      parseOnboardingViewState({
        data: {
          ...onboardingViewFixture,
          profile: { ...profileViewFixture, tenantId: "tenant_other" },
        },
        status: "READY",
      })
    ).toThrow();
    expect(() =>
      parseCampaignListViewState({
        data: {
          ...campaignListViewFixture,
          items: [
            campaignViewFixture,
            { ...campaignViewFixture, tenantId: "tenant_other" },
          ],
        },
        status: "READY",
      })
    ).toThrow();
    expect(() =>
      parsePipelineViewState({
        data: {
          ...pipelinePageFixture,
          items: [
            pipelinePageFixture.items[0],
            { ...pipelinePageFixture.items[1], tenantId: "tenant_other" },
          ],
        },
        status: "READY",
      })
    ).toThrow();
  });

  it("requires safe LinkedIn status and pause combinations", () => {
    expect(linkedinManuallyPausedAccountFixture.pauseReason).toBe(
      "ACCOUNT_MANUAL_PAUSE"
    );
    expect(() =>
      parseLinkedInAccountView({
        ...linkedinManuallyPausedAccountFixture,
        outboundPaused: false,
        pauseReason: null,
        status: "DISCONNECTED",
      })
    ).toThrow();
    expect(() =>
      parseLinkedInAccountView({
        ...linkedinManuallyPausedAccountFixture,
        outboundPaused: false,
        pauseReason: null,
        health: "DEGRADED",
        status: "RESTRICTED",
      })
    ).toThrow();
    expect(() =>
      parseLinkedInAccountView({
        ...linkedinManuallyPausedAccountFixture,
        outboundPaused: false,
        pauseReason: null,
        health: "DEGRADED",
        reconciliationRequired: true,
        status: "RECONCILING",
      })
    ).toThrow();
  });

  it("stops active automation for replies and unknown sends", () => {
    expect(() =>
      parsePipelineRowView({
        ...pipelinePageFixture.items[0],
        nextDueAt: null,
        nextStep: null,
        stage: "REPLIED",
      })
    ).toThrow();
    expect(() =>
      parseConversationTimelineViewState({
        data: {
          ...conversationTimelineViewFixture,
          automation: "ACTIVE",
          handover: null,
          ownership: "BOT_ELIGIBLE",
          pauseReason: null,
        },
        status: "READY",
      })
    ).toThrow();
    expect(() =>
      parseConversationTimelineViewState({
        data: {
          ...conversationTimelineViewFixture,
          automation: "ACTIVE",
          handover: null,
          lastIncomingAt: null,
          messages: {
            ...conversationTimelineViewFixture.messages,
            items: [conversationTimelineViewFixture.messages.items[0]],
          },
          ownership: "BOT_ELIGIBLE",
          pauseReason: null,
        },
        status: "READY",
      })
    ).toThrow();
    const outboundOnlyMessages = {
      ...conversationTimelineViewFixture.messages,
      items: [conversationTimelineViewFixture.messages.items[0]],
      page: {
        ...conversationTimelineViewFixture.messages.page,
        totalCount: 1,
      },
    };
    expect(() =>
      parseConversationTimelineViewState({
        data: {
          ...conversationTimelineViewFixture,
          automation: "PAUSED",
          handover: conversationTimelineViewFixture.handover,
          lastIncomingAt: null,
          messages: outboundOnlyMessages,
          ownership: "BOT_ELIGIBLE",
          pauseReason: "ACCOUNT_MANUAL_PAUSE",
          unknownOutcomes: [],
        },
        status: "READY",
      })
    ).toThrow();
    expect(() =>
      parseConversationTimelineViewState({
        data: {
          ...conversationTimelineViewFixture,
          automation: "HUMAN_HANDOVER",
          handover: conversationTimelineViewFixture.handover,
          lastIncomingAt: null,
          messages: outboundOnlyMessages,
          ownership: "HUMAN_OWNED",
          pauseReason: "HUMAN_HANDOVER",
          unknownOutcomes: [],
        },
        status: "READY",
      })
    ).toThrow();
  });

  it("rejects unsafe or semantically inconsistent DTOs", () => {
    expect(() =>
      parsePageInfo({
        cursor: null,
        hasMore: true,
        nextCursor: null,
        totalCount: 2,
      })
    ).toThrow();
    expect(() =>
      parseDraftPreviewView({
        ...draftPreviewViewFixture,
        sendEnqueued: true,
      })
    ).toThrow();
    expect(() =>
      parseBillingViewState({
        data: {
          ...billingViewFixture,
          entitlement: "OUTBOUND_ENABLED",
          status: "PAST_DUE",
        },
        status: "READY",
      })
    ).toThrow();
    expect(() =>
      parsePipelineViewState({
        data: {
          ...pipelinePageFixture,
          items: [
            {
              ...pipelinePageFixture.items[0],
              unknownActionCount: 1,
            },
          ],
        },
        status: "READY",
      })
    ).toThrow();
    expect(() =>
      parsePipelineViewState({
        data: {
          ...pipelinePageFixture,
          items: [
            {
              ...pipelinePageFixture.items[0],
              holdReasons: ["SUPPRESSED"],
              stage: "SUPPRESSED",
            },
          ],
        },
        status: "READY",
      })
    ).toThrow();
    expect(() =>
      parseConversationTimelineViewState({
        data: {
          ...conversationTimelineViewFixture,
          messages: {
            ...conversationTimelineViewFixture.messages,
            items: [
              {
                ...conversationTimelineViewFixture.messages.items[0],
                attachments: [],
                text: null,
              },
            ],
          },
        },
        status: "READY",
      })
    ).toThrow();
    expect(() =>
      parseBillingCommand({
        kind: "START_CHECKOUT",
        returnTo: "https://evil.example.test/redirect",
        tenantId: "tenant_demo",
      })
    ).toThrow();
    expect(
      parseBillingCommand({
        kind: "START_CHECKOUT",
        returnTo: "/settings/billing?from=checkout",
        tenantId: "tenant_demo",
      }).returnTo
    ).toBe("/settings/billing?from=checkout");
    for (const returnTo of [
      "/settings/billing?plan=pro%2Fannual",
      "/settings/%5C-data",
      "/%2F%2Fhost",
    ]) {
      expect(
        parseBillingCommand({
          kind: "START_CHECKOUT",
          returnTo,
          tenantId: "tenant_demo",
        }).returnTo
      ).toBe(returnTo);
    }
    for (const returnTo of ["/\\host", "//host"]) {
      expect(() =>
        parseBillingCommand({
          kind: "START_CHECKOUT",
          returnTo,
          tenantId: "tenant_demo",
        })
      ).toThrow();
    }
  });
});
