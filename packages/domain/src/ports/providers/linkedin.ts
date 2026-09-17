import type {
  AccountId,
  ActionId,
  ConversationId,
  ProspectId,
  SendAttemptId,
  TenantId,
} from "../../contracts/ids";
import type { Message } from "../../contracts/message";
import type { DirectMessageStep, UtcTimestamp } from "../../contracts/values";
import type {
  ProviderOperationContext,
  ProviderReadResult,
  ProviderWriteResult,
} from "./common";

export const LINKEDIN_CONNECTION_MODES = ["CONNECT", "RECONNECT"] as const;
export type LinkedInConnectionMode = (typeof LINKEDIN_CONNECTION_MODES)[number];

export type LinkedInAccountRef = Readonly<{
  accountId: AccountId;
  providerAccountId: string;
  tenantId: TenantId;
}>;

export type LinkedInHostedFlow = Readonly<{
  authorizationUrl: string;
  expiresAt: UtcTimestamp;
  flowReference: string | null;
  mode: LinkedInConnectionMode;
}>;

export type LinkedInConnectInput = Readonly<{
  callbackUrl: string;
  context: ProviderOperationContext;
  /** The caller binds this opaque state to an authorized tenant and one attempt. */
  opaqueState: string;
  tenantId: TenantId;
}>;

export type LinkedInReconnectInput = Readonly<{
  account: LinkedInAccountRef;
  callbackUrl: string;
  context: ProviderOperationContext;
  /** The caller binds this opaque state to the authorized account and attempt. */
  opaqueState: string;
}>;

export type LinkedInCapabilityState = boolean | null;

export type LinkedInCapabilities = Readonly<{
  canInvite: LinkedInCapabilityState;
  canReadAcceptance: LinkedInCapabilityState;
  canReadConversation: LinkedInCapabilityState;
  canReadProfiles: LinkedInCapabilityState;
  canSendMessages: LinkedInCapabilityState;
  canUseEvents: LinkedInCapabilityState;
  searchModes: Readonly<{
    classic: LinkedInCapabilityState;
    recruiter: LinkedInCapabilityState;
    salesNavigator: LinkedInCapabilityState;
  }>;
}>;

export const LINKEDIN_HEALTH_STATUSES = [
  "CHALLENGE_REQUIRED",
  "CONNECTED",
  "DISCONNECTED",
  "LIMITED",
  "UNKNOWN",
] as const;
export type LinkedInHealthStatus = (typeof LINKEDIN_HEALTH_STATUSES)[number];

export type LinkedInHealth = Readonly<{
  checkedAt: UtcTimestamp | null;
  reason:
    | "ACCOUNT_RESTRICTED"
    | "CHALLENGE_REQUIRED"
    | "DISCONNECTED"
    | "NOT_OBSERVED"
    | "RATE_LIMITED"
    | null;
  status: LinkedInHealthStatus;
}>;

export type LinkedInAccountStatus = Readonly<{
  account: LinkedInAccountRef;
  capabilities: LinkedInCapabilities;
  health: LinkedInHealth;
  observedAt: UtcTimestamp;
}>;

export type LinkedInAccountsPort = Readonly<{
  createConnectFlow: (
    input: LinkedInConnectInput
  ) => Promise<ProviderWriteResult<LinkedInHostedFlow>>;
  createReconnectFlow: (
    input: LinkedInReconnectInput
  ) => Promise<ProviderWriteResult<LinkedInHostedFlow>>;
  readAccountCapabilities: (
    input: LinkedInAccountStatusInput
  ) => Promise<ProviderReadResult<LinkedInCapabilities>>;
  readAccountStatus: (
    input: LinkedInAccountStatusInput
  ) => Promise<ProviderReadResult<LinkedInAccountStatus>>;
}>;

export type LinkedInAccountStatusInput = Readonly<{
  account: LinkedInAccountRef;
  context: ProviderOperationContext;
}>;

export type LinkedInSearchQuery = Readonly<{
  currentCompanies: readonly string[];
  keywords: readonly string[];
  locations: readonly string[];
  titles: readonly string[];
}>;

export type LinkedInSearchCandidatesInput = Readonly<{
  account: LinkedInAccountRef;
  context: ProviderOperationContext;
  cursor: string | null;
  limit: number;
  query: LinkedInSearchQuery;
}>;

export const LINKEDIN_PROFILE_FIELDS = [
  "CURRENT_COMPANY",
  "CURRENT_ROLE",
  "DISPLAY_NAME",
  "HEADLINE",
  "LOCATION",
  "PROFILE_URL",
] as const;
export type LinkedInProfileField = (typeof LINKEDIN_PROFILE_FIELDS)[number];

export const LINKEDIN_PROFILE_PROVENANCE = [
  "PROFILE_READ",
  "SEARCH_RESULT",
] as const;
export type LinkedInProfileProvenance =
  (typeof LINKEDIN_PROFILE_PROVENANCE)[number];

export type LinkedInProfileSnapshot = Readonly<{
  currentCompany: string | null;
  currentRole: string | null;
  displayName: string | null;
  headline: string | null;
  location: string | null;
  missingFields: readonly LinkedInProfileField[];
  observedAt: UtcTimestamp;
  profileUrl: string | null;
  providerProfileId: string;
  provenance: LinkedInProfileProvenance;
}>;

export type LinkedInCandidate = Readonly<
  Pick<
    LinkedInProfileSnapshot,
    | "currentCompany"
    | "currentRole"
    | "displayName"
    | "headline"
    | "location"
    | "missingFields"
    | "profileUrl"
    | "providerProfileId"
  > & {
    observedAt: UtcTimestamp;
    provenance: "SEARCH_RESULT";
  }
>;

export type LinkedInCandidatePage = Readonly<{
  candidates: readonly LinkedInCandidate[];
  exhausted: boolean;
  nextCursor: string | null;
  observedAt: UtcTimestamp;
}>;

export type LinkedInReadProfileInput = Readonly<{
  account: LinkedInAccountRef;
  context: ProviderOperationContext;
  providerProfileId: string;
}>;

export type LinkedInDiscoveryPort = Readonly<{
  readProfile: (
    input: LinkedInReadProfileInput
  ) => Promise<ProviderReadResult<LinkedInProfileSnapshot>>;
  searchCandidates: (
    input: LinkedInSearchCandidatesInput
  ) => Promise<ProviderReadResult<LinkedInCandidatePage>>;
}>;

export type LinkedInProviderEvidence = Readonly<{
  observedAt: UtcTimestamp;
  reference: string | null;
  source: "PROVIDER_EVENT" | "PROVIDER_HISTORY" | "PROVIDER_RECEIPT";
}>;

export type LinkedInInviteInput = Readonly<{
  account: LinkedInAccountRef;
  actionId: ActionId;
  context: ProviderOperationContext;
  /** Invitations intentionally carry no note. */
  note: null;
  prospectId: ProspectId;
  providerProfileId: string;
}>;

export type LinkedInInviteReceipt = Readonly<{
  providerEvidence: LinkedInProviderEvidence;
  providerInvitationId: string | null;
  submittedAt: UtcTimestamp;
}>;

export type LinkedInAcceptanceInput = Readonly<{
  account: LinkedInAccountRef;
  context: ProviderOperationContext;
  prospectId: ProspectId;
  providerProfileId: string;
}>;

export type LinkedInAcceptance = Readonly<{
  accepted: boolean | null;
  observedAt: UtcTimestamp;
  providerEvidence: LinkedInProviderEvidence | null;
  source: "PROVIDER_EVENT" | "PROVIDER_HISTORY" | "UNKNOWN";
}>;

export type LinkedInSendMessageInput = Readonly<{
  account: LinkedInAccountRef;
  actionId: ActionId;
  attemptId: SendAttemptId;
  context: ProviderOperationContext;
  conversationId: ConversationId | null;
  prospectId: ProspectId;
  providerProfileId: string;
  step: DirectMessageStep;
  text: string;
}>;

export type LinkedInMessageReceipt = Readonly<{
  providerEvidence: LinkedInProviderEvidence;
  providerMessageId: string;
  submittedAt: UtcTimestamp;
}>;

export type LinkedInConversationInput = Readonly<{
  account: LinkedInAccountRef;
  context: ProviderOperationContext;
  conversationId: ConversationId | null;
  cursor: string | null;
  limit: number;
  prospectId: ProspectId;
}>;

export type LinkedInConversationPage = Readonly<{
  messages: readonly Message[];
  nextCursor: string | null;
  observedAt: UtcTimestamp;
}>;

/**
 * Writes intentionally expose no idempotency claim. A successful receipt is
 * evidence from the provider; an ambiguous result must be reconciled first.
 */
export type LinkedInDeliveryPort = Readonly<{
  inspectAcceptance: (
    input: LinkedInAcceptanceInput
  ) => Promise<ProviderReadResult<LinkedInAcceptance>>;
  invite: (
    input: LinkedInInviteInput
  ) => Promise<ProviderWriteResult<LinkedInInviteReceipt>>;
  readRecentConversation: (
    input: LinkedInConversationInput
  ) => Promise<ProviderReadResult<LinkedInConversationPage>>;
  sendMessage: (
    input: LinkedInSendMessageInput
  ) => Promise<ProviderWriteResult<LinkedInMessageReceipt>>;
}>;
