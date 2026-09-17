import type { AccountId, ProspectId, TenantId } from "../../contracts/ids";
import type { InboundMessage, OutboundMessage } from "../../contracts/message";
import type { UtcTimestamp } from "../../contracts/values";
import type { ProviderOperationContext, ProviderResult } from "./common";
import type {
  LinkedInCapabilities,
  LinkedInHealth,
  LinkedInProviderEvidence,
} from "./linkedin";

/** Headers are passed only to the server-side verifier; they are never returned. */
export type ProviderEventHeader = Readonly<{
  name: string;
  value: string;
}>;

export type ProviderEventAuthenticationInput = Readonly<{
  context: ProviderOperationContext;
  headers: readonly ProviderEventHeader[];
  rawBody: string;
}>;

export type ProviderEventAuthentication = Readonly<{
  authenticatedAt: UtcTimestamp;
  authenticationReference: string | null;
  mechanism: "PROVIDER_DEFINED";
  providerEventId: string | null;
}>;

export type ProviderEventScope = Readonly<{
  accountId: AccountId;
  tenantId: TenantId;
}>;

export type ProviderEventNormalizationInput = Readonly<{
  authenticated: ProviderEventAuthentication;
  context: ProviderOperationContext;
  rawBody: string;
  scope: ProviderEventScope;
}>;

export type ProviderIncomingMessageEvent = Readonly<{
  kind: "INCOMING_MESSAGE";
  message: InboundMessage;
  occurredAt: UtcTimestamp;
  providerEventId: string | null;
  scope: ProviderEventScope;
}>;

export type ProviderOutgoingMessageEvent = Readonly<{
  kind: "OUTGOING_MESSAGE";
  message: OutboundMessage;
  occurredAt: UtcTimestamp;
  providerEventId: string | null;
  scope: ProviderEventScope;
}>;

export type ProviderAcceptanceEvent = Readonly<{
  accountId: AccountId;
  acceptedAt: UtcTimestamp;
  kind: "INVITATION_ACCEPTED";
  prospectId: ProspectId;
  providerEventId: string | null;
  scope: ProviderEventScope;
}>;

export type ProviderAccountStatusEvent = Readonly<{
  accountId: AccountId;
  capabilities: LinkedInCapabilities;
  health: LinkedInHealth;
  kind: "ACCOUNT_STATUS_CHANGED";
  observedAt: UtcTimestamp;
  providerEventId: string | null;
  scope: ProviderEventScope;
}>;

export type ProviderUnrecognizedEvent = Readonly<{
  kind: "UNRECOGNIZED";
  observedAt: UtcTimestamp;
  providerEventId: string | null;
  scope: ProviderEventScope;
}>;

export type NormalizedProviderEvent =
  | ProviderAcceptanceEvent
  | ProviderAccountStatusEvent
  | ProviderIncomingMessageEvent
  | ProviderOutgoingMessageEvent
  | ProviderUnrecognizedEvent;

export type ProviderEventNormalization = Readonly<{
  event: NormalizedProviderEvent;
  evidence: LinkedInProviderEvidence | null;
}>;

export type ProviderEventDedupeInput = Readonly<{
  context: ProviderOperationContext;
  event: NormalizedProviderEvent;
}>;

export type ProviderEventDedupeIdentity = Readonly<{
  dedupeKey: string;
  eventKind: NormalizedProviderEvent["kind"];
  providerEventId: string | null;
  scope: ProviderEventScope;
  source: "CANONICAL_PAYLOAD" | "PROVIDER_EVENT_ID";
}>;

/**
 * Authentication uses the mechanism the provider documents. This contract
 * intentionally has no invented HMAC header or generic signature algorithm.
 * Normalization returns domain messages, never SDK classes or raw responses.
 */
export type ProviderEventPort = Readonly<{
  authenticate: (
    input: ProviderEventAuthenticationInput
  ) => Promise<ProviderResult<ProviderEventAuthentication>>;
  deriveDedupeIdentity: (
    input: ProviderEventDedupeInput
  ) => Promise<ProviderResult<ProviderEventDedupeIdentity>>;
  normalize: (
    input: ProviderEventNormalizationInput
  ) => Promise<ProviderResult<ProviderEventNormalization>>;
}>;
