import type { Action, InvitationActionPayload } from "./action";
import { parseCampaignId } from "./ids";
import type { CampaignId } from "./ids";
import type { IncomingMessageEvent, Message } from "./message";
import type { AccountProspectOwnership, Ownership } from "./ownership";
import {
  parseAccountProspectOwnership,
  parseAction,
  parseIncomingMessageEvent,
  parseMessage,
  parseOwnership,
} from "./parsers";
import type { DefaultSequencePlan } from "./values";
import { DEFAULT_SEQUENCE_PLAN } from "./values";

const FIXTURE_TIME = "2026-09-17T10:00:00.000Z";
const SOURCE_VERSIONS = {
  acceptedInferredStyle: null,
  campaign: {
    createdAt: FIXTURE_TIME,
    id: "version_campaign_1",
    kind: "CAMPAIGN",
    revision: 1,
  },
  defaultPrompt: {
    createdAt: FIXTURE_TIME,
    id: "version_prompt_default_1",
    kind: "PROMPT_DEFAULT",
    revision: 3,
  },
  explicitStyle: {
    createdAt: FIXTURE_TIME,
    id: "version_style_explicit_1",
    kind: "STYLE_EXPLICIT",
    revision: 2,
  },
  model: "claude-sonnet-4-5",
  profile: {
    createdAt: FIXTURE_TIME,
    id: "version_profile_1",
    kind: "PROFILE",
    revision: 4,
  },
} as const;

export const attachmentOnlyInboundMessageFixture: Message = parseMessage({
  accountId: "account_demo",
  actor: "PROSPECT",
  attachments: [
    {
      contentType: "application/pdf",
      kind: "FILE",
      name: "brief.pdf",
      providerAttachmentId: "provider_attachment_1",
      sizeBytes: 2048,
      url: null,
    },
  ],
  conversationId: "conversation_demo",
  direction: "INBOUND",
  messageId: "message_inbound_attachment",
  occurredAt: FIXTURE_TIME,
  prospectId: "prospect_demo",
  providerMessageId: "provider_message_inbound_1",
  receivedAt: FIXTURE_TIME,
  source: "PROVIDER_EVENT",
  tenantId: "tenant_demo",
  text: null,
});

export const attachmentOnlyInboundEventFixture: IncomingMessageEvent =
  parseIncomingMessageEvent({
    dedupeKey: "provider-event-inbound-attachment-1",
    message: attachmentOnlyInboundMessageFixture,
    receivedAt: FIXTURE_TIME,
    type: "INCOMING_MESSAGE",
  });

export const outgoingBotEchoMessageFixture: Message = parseMessage({
  accountId: "account_demo",
  actor: "BOT",
  attachments: [],
  conversationId: "conversation_demo",
  direction: "OUTBOUND",
  messageId: "message_outgoing_bot_echo",
  occurredAt: FIXTURE_TIME,
  prospectId: "prospect_demo",
  providerMessageId: "provider_message_outbound_1",
  receivedAt: FIXTURE_TIME,
  source: "PROVIDER_EVENT",
  tenantId: "tenant_demo",
  text: "Bonjour, merci pour votre retour.",
});

export const invitationWithoutNoteActionFixture: Action = parseAction({
  accountId: "account_demo",
  actionId: "action_invitation_1",
  attemptId: null,
  campaignId: "campaign_alpha",
  campaignVersionId: "campaign_version_alpha_1",
  createdAt: FIXTURE_TIME,
  evidenceIds: [],
  failureReason: null,
  lease: null,
  payload: {
    kind: "INVITATION_WITHOUT_NOTE",
    note: null,
    step: "INVITATION",
  } satisfies InvitationActionPayload,
  prospectId: "prospect_demo",
  providerMessageId: null,
  sourceVersions: SOURCE_VERSIONS,
  step: "INVITATION",
  state: "READY",
  stateAt: FIXTURE_TIME,
  tenantId: "tenant_demo",
  unknownReason: null,
});

export const uncertainSendActionFixture: Action = parseAction({
  accountId: "account_demo",
  actionId: "action_dm1_unknown",
  attemptId: "attempt_dm1_1",
  campaignId: "campaign_alpha",
  campaignVersionId: "campaign_version_alpha_1",
  createdAt: FIXTURE_TIME,
  evidenceIds: ["evidence_offer_1"],
  failureReason: null,
  lease: null,
  payload: {
    kind: "DIRECT_MESSAGE",
    step: "DM1",
    text: "Bonjour, votre expérience en recrutement m’intéresse.",
  },
  prospectId: "prospect_demo",
  providerMessageId: null,
  sourceVersions: SOURCE_VERSIONS,
  step: "DM1",
  state: "UNKNOWN",
  stateAt: FIXTURE_TIME,
  tenantId: "tenant_demo",
  unknownReason: "TIMEOUT",
});

export const humanOwnershipFixture: Ownership = parseOwnership({
  kind: "HUMAN_OWNED",
  ownerUserId: "user_demo",
  reason: "INCOMING_MESSAGE",
  recordedAt: FIXTURE_TIME,
});

export const campaignChangeOwnershipContinuityFixture: Readonly<{
  accountProspect: AccountProspectOwnership;
  fromCampaignId: CampaignId;
  toCampaignId: CampaignId;
}> = Object.freeze({
  accountProspect: parseAccountProspectOwnership({
    accountId: "account_demo",
    ownership: humanOwnershipFixture,
    prospectId: "prospect_demo",
    tenantId: "tenant_demo",
  }),
  fromCampaignId: parseCampaignId("campaign_alpha"),
  toCampaignId: parseCampaignId("campaign_beta"),
});

export const defaultSequencePlanFixture: DefaultSequencePlan =
  DEFAULT_SEQUENCE_PLAN;
