import type { AccountId, TenantId } from "../ids";
import type { UtcTimestamp } from "../values";
import type {
  AccountSelector,
  ProductCommandResult,
  ProductPauseReason,
  ProductViewState,
  RevisionGuard,
  TenantSelector,
} from "./common";

export const LINKEDIN_CONNECTION_STATUSES = [
  "DISCONNECTED",
  "WAITING_FOR_AUTH",
  "CONNECTED",
  "RECONCILING",
  "RECONNECT_REQUIRED",
  "CHALLENGE_REQUIRED",
  "RESTRICTED",
] as const;
export type LinkedInConnectionStatus =
  (typeof LINKEDIN_CONNECTION_STATUSES)[number];

export const LINKEDIN_HEALTH_STATUSES = [
  "HEALTHY",
  "DEGRADED",
  "UNAVAILABLE",
  "UNKNOWN",
] as const;
export type LinkedInHealthStatus = (typeof LINKEDIN_HEALTH_STATUSES)[number];

export type LinkedInCapabilities = Readonly<{
  canInvite: boolean | null;
  canMessage: boolean | null;
  canReadMessages: boolean | null;
  canSearch: boolean | null;
}>;

export type LinkedInAccountView = Readonly<{
  accountId: AccountId;
  capabilities: LinkedInCapabilities;
  connectedAt: UtcTimestamp | null;
  health: LinkedInHealthStatus;
  lastCheckedAt: UtcTimestamp | null;
  outboundPaused: boolean;
  pauseReason: ProductPauseReason | null;
  reconciliationRequired: boolean;
  revision: number;
  status: LinkedInConnectionStatus;
  tenantId: TenantId;
  /** Provider account IDs, cookies, tokens and raw responses are intentionally absent. */
  displayName: string | null;
}>;

export type LinkedInConnectionView = Readonly<{
  accounts: readonly LinkedInAccountView[];
  selectedAccountId: AccountId | null;
  tenantId: TenantId;
}>;

export type LinkedInConnectionStartView = Readonly<{
  expiresAt: UtcTimestamp;
  hostedAuthUrl: string;
  tenantId: TenantId;
}>;

export const LINKEDIN_COMMAND_KINDS = [
  "START_LINKEDIN_CONNECTION",
  "RECONNECT_LINKEDIN_ACCOUNT",
  "PAUSE_LINKEDIN_ACCOUNT",
  "RESUME_LINKEDIN_ACCOUNT",
] as const;
export type LinkedInCommandKind = (typeof LINKEDIN_COMMAND_KINDS)[number];

export type StartLinkedInConnectionCommand = Readonly<
  TenantSelector & {
    kind: "START_LINKEDIN_CONNECTION";
    returnTo: string;
  }
>;

export type ReconnectLinkedInAccountCommand = Readonly<
  AccountSelector &
    RevisionGuard & {
      kind: "RECONNECT_LINKEDIN_ACCOUNT";
    }
>;

export type PauseLinkedInAccountCommand = Readonly<
  AccountSelector &
    RevisionGuard & {
      kind: "PAUSE_LINKEDIN_ACCOUNT";
    }
>;

export type ResumeLinkedInAccountCommand = Readonly<
  AccountSelector &
    RevisionGuard & {
      kind: "RESUME_LINKEDIN_ACCOUNT";
    }
>;

export type LinkedInCommand =
  | StartLinkedInConnectionCommand
  | ReconnectLinkedInAccountCommand
  | PauseLinkedInAccountCommand
  | ResumeLinkedInAccountCommand;

export type LinkedInQuery = TenantSelector;
export type LinkedInViewResult = ProductViewState<LinkedInConnectionView>;
export type LinkedInCommandResult = ProductCommandResult<
  LinkedInAccountView | LinkedInConnectionStartView
>;

export type LinkedInCommandHandler = (
  command: LinkedInCommand
) => Promise<LinkedInCommandResult>;
export type LinkedInQueryHandler = (
  query: LinkedInQuery
) => Promise<LinkedInViewResult>;
