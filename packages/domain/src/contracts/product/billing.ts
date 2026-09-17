import type { TenantId } from "../ids";
import type { UtcTimestamp } from "../values";
import type {
  ProductCommandResult,
  ProductViewState,
  TenantSelector,
} from "./common";

export const BILLING_SUBSCRIPTION_STATUSES = [
  "PENDING",
  "ACTIVE",
  "PAST_DUE",
  "CANCELED",
  "INCOMPLETE",
  "UNKNOWN",
] as const;
export type BillingSubscriptionStatus =
  (typeof BILLING_SUBSCRIPTION_STATUSES)[number];

export const BILLING_ENTITLEMENT_STATUSES = [
  "OUTBOUND_ENABLED",
  "OUTBOUND_PAUSED",
  "UNKNOWN",
] as const;
export type BillingEntitlementStatus =
  (typeof BILLING_ENTITLEMENT_STATUSES)[number];

export type BillingView = Readonly<{
  cancelAtPeriodEnd: boolean | null;
  currentPeriodEnd: UtcTimestamp | null;
  entitlement: BillingEntitlementStatus;
  lastUpdatedAt: UtcTimestamp | null;
  revision: number;
  status: BillingSubscriptionStatus;
  tenantId: TenantId;
}>;

export type BillingQuery = Readonly<
  TenantSelector & {
    kind: "GET_BILLING";
  }
>;

export const BILLING_COMMAND_KINDS = [
  "START_CHECKOUT",
  "OPEN_BILLING_PORTAL",
] as const;
export type BillingCommandKind = (typeof BILLING_COMMAND_KINDS)[number];

export type StartCheckoutCommand = Readonly<
  TenantSelector & {
    kind: "START_CHECKOUT";
    returnTo: string;
  }
>;

export type OpenBillingPortalCommand = Readonly<
  TenantSelector & {
    kind: "OPEN_BILLING_PORTAL";
    returnTo: string;
  }
>;

export type BillingCommand = StartCheckoutCommand | OpenBillingPortalCommand;

export type BillingRedirectView = Readonly<{
  entitlementChanged: false;
  expiresAt: UtcTimestamp | null;
  operation: "CHECKOUT" | "PORTAL";
  url: string;
}>;

export type BillingCommandResult = ProductCommandResult<BillingRedirectView>;
export type BillingViewResult = ProductViewState<BillingView>;

export type BillingCommandHandler = (
  command: BillingCommand
) => Promise<BillingCommandResult>;
export type BillingQueryHandler = (
  query: BillingQuery
) => Promise<BillingViewResult>;
