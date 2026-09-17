# Resend — customer email notifications

**Status: recommended transactional email service.** It serves our customers, not cold prospects. [Costs](../cost-estimate.md).

## Emails to implement

Authentication emails through Better Auth's verification/reset callbacks using the official `resend` SDK, “a prospect replied”, account reconnect required, campaign paused for an operational issue, and optional activity summaries. Keep billing emails under a single owner—Stripe or our application—to avoid duplicates.

## Setup

1. Verify a company-owned sending subdomain and configure the provider's required DNS records. Add an appropriate DMARC policy. Use a separate staging sender. [Domain setup](https://resend.com/docs/dashboard/domains/introduction).
2. Store the API credentials in the relevant server configuration. Never expose them to customers or frontend JavaScript.
3. Create short French templates with a link to the authenticated conversation or account page. Avoid putting full private conversation histories in email.
4. Insert a notification request in the product's transactional outbox when a reply or account event is committed. A failed email must not undo the reply stop.
5. Deduplicate on event, recipient and notification type. Use provider idempotency where supported and retain our own delivery record.
6. Handle bounces and failures; show critical account status in the application even if email cannot be delivered. Batch non-urgent activity into summaries.

## Tests

Verify a single customer alert after duplicate message events, safe links after session expiry, delivery failures, template escaping and separation of staging recipients from real customers. A customer opening an email must not automatically reactivate a campaign.

## Cost

The model uses Pro at $20/month and assumes 40 transactional messages per customer/month. At 1,000 customers that leaves some room within 50,000 emails for other events, but measure authentication and operational bursts too. The free plan has both a monthly and daily cap and is suitable for limited internal testing. [Resend pricing](https://resend.com/pricing).

No marketing-email automation product or dedicated sending IP is included. Cold-email prospecting would be a separate channel with separate account, product and cost decisions.

Keep the SDK client and templates in `packages/email`. Better Auth uses this package from `apps/app`; background notifications use it from `apps/worker`. [Resend Node SDK](https://resend.com/docs/send-with-nodejs).
