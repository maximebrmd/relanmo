# Stripe — required customer subscription billing

**Status: required by the user.** Stripe manages subscription payments; verified entitlements govern new outreach while inbound reply handling remains available. [Payment cost examples](../cost-estimate.md).

## Implementation

1. Use the company's existing Stripe account and customer records where possible. Create product/price records for the chosen subscription model; no selling price is assumed by this architecture.
2. Use hosted Checkout and the customer portal to minimize payment UI and card-handling work.
3. Use the official `stripe` TypeScript-compatible server SDK in `packages/payments`. Persist tenant-to-customer/subscription mappings. In `apps/api`, verify webhook signatures against the raw request body before parsing or trusting it, and deduplicate event IDs. Keep test/live keys and endpoints separate.
4. Derive entitlements from verified server-side subscription state. Do not activate paid access solely from the browser's success redirect.
5. Handle failed payments, cancellation, renewal, refunds and changes without assuming event order. Fetch authoritative provider state when necessary. [Subscription webhook guidance](https://docs.stripe.com/billing/subscriptions/webhooks).
6. Translate entitlement changes into product commands. If a subscription expires, pause new outreach under the configured grace policy, but retain the ability to ingest replies and reconcile actions during the transition.
7. If a customer leaves, separate billing cancellation, provider-account removal and data-retention workflows. Simply hiding the customer in our UI does not necessarily stop connector billing.

## Verification

Use test-mode subscriptions for successful checkout, payment failure, duplicate/out-of-order events, cancellation and reactivation. A webhook replay must not create duplicate customers or campaigns.

## Cost

Stripe's charge is tied to collected revenue, payment method and merchant country. The main estimate provides a France/standard-EEA-card example plus Stripe Billing fees. [France Payments pricing](https://stripe.com/fr/pricing), [Billing pricing](https://stripe.com/fr/billing/pricing).

No Stripe Connect marketplace, automated tax product, identity verification or premium billing contract is required by the described freelancer SaaS. Add those only when the business model needs them. Existing contracts may have different rates. Reuse existing Stripe records where possible rather than creating duplicate customer subscriptions.

Use server-created Checkout Sessions and the Customer Portal for the MVP. Only tenant billing administrators can create them, and price IDs come from a server allowlist. Persist current entitlements transactionally and emit outbox events to pause affected campaigns. Subscription-state ownership stays here, without a second Better Auth billing plugin. [Stripe SDK](https://github.com/stripe/stripe-node), [signature verification](https://docs.stripe.com/webhooks/signature).
