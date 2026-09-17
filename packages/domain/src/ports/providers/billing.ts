import type { TenantId } from "../../contracts/ids";
import type { UtcTimestamp } from "../../contracts/values";
import type {
  ProviderOperationContext,
  ProviderReadResult,
  ProviderResult,
  ProviderWriteResult,
} from "./common";

export type BillingCustomerRef = Readonly<{
  providerCustomerId: string;
  tenantId: TenantId;
}>;

export type BillingCheckoutInput = Readonly<{
  cancelUrl: string;
  context: ProviderOperationContext;
  customer: BillingCustomerRef;
  priceId: string;
  providerIdempotencyKey: string;
  successUrl: string;
}>;

export type BillingPortalInput = Readonly<{
  context: ProviderOperationContext;
  customer: BillingCustomerRef;
  returnUrl: string;
  /** Present only when the selected billing API documents write idempotency. */
  providerIdempotencyKey: string | null;
}>;

export type BillingHostedSession = Readonly<{
  expiresAt: UtcTimestamp | null;
  sessionUrl: string;
}>;

export const BILLING_SUBSCRIPTION_STATUSES = [
  "ACTIVE",
  "CANCELED",
  "INCOMPLETE",
  "PAST_DUE",
  "TRIALING",
  "UNKNOWN",
] as const;
export type BillingSubscriptionStatus =
  (typeof BILLING_SUBSCRIPTION_STATUSES)[number];

export type BillingSubscriptionInput = Readonly<{
  context: ProviderOperationContext;
  customer: BillingCustomerRef;
}>;

export type BillingSubscription = Readonly<{
  cancelAtPeriodEnd: boolean | null;
  currentPeriodEndsAt: UtcTimestamp | null;
  observedAt: UtcTimestamp;
  providerSubscriptionId: string | null;
  status: BillingSubscriptionStatus;
  tenantId: TenantId;
}>;

export type BillingSignatureVerificationInput = Readonly<{
  context: ProviderOperationContext;
  rawBody: string;
  signatureHeader: string;
}>;

export type BillingSignatureVerification = Readonly<{
  eventId: string | null;
  verifiedAt: UtcTimestamp;
}>;

export type BillingPort = Readonly<{
  createCheckoutSession: (
    input: BillingCheckoutInput
  ) => Promise<ProviderWriteResult<BillingHostedSession>>;
  createPortalSession: (
    input: BillingPortalInput
  ) => Promise<ProviderWriteResult<BillingHostedSession>>;
  readCurrentSubscription: (
    input: BillingSubscriptionInput
  ) => Promise<ProviderReadResult<BillingSubscription>>;
  verifyWebhookSignature: (
    input: BillingSignatureVerificationInput
  ) => Promise<ProviderResult<BillingSignatureVerification>>;
}>;
