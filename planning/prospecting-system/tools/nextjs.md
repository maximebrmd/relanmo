# Next.js — customer dashboard and HTTP API

**Status: required web framework.** Deploy the Bun-backed Next.js app/API processes on Render. No separate Vercel hosting subscription is included. [Official deployment options](https://nextjs.org/docs/app/getting-started/deploying).

## Screens and endpoints

Build onboarding, LinkedIn connection status, offer/ICP settings, campaign activation/pause, prospect pipeline, conversation history, handover notifications, usage and an operator exception queue. Present user concepts such as “Waiting for acceptance” and “Your reply needed”; do not expose workflow-engine terminology in normal customer screens.

The API app receives Unipile and signed Stripe events. Customer-app handlers generate Hosted Auth links and accept authenticated campaign commands through the same browser origin as Better Auth. Keep them fast: validate, commit state/outbox records, then return. They do not run a multi-day sequence or wait for model generation to finish.

## Implementation steps

1. Start from next-forge: `apps/app` is the customer product, `apps/web` is static marketing, and `apps/api` receives provider webhooks, and `apps/docs` is the static Fumadocs help site. Use shared packages for contracts, database access and domain rules. Pin tested package versions in `bun.lock`.
2. Mount Better Auth in the customer app using its official Next.js integration. Verify the session server-side and current tenant membership for every protected operation. Use separate server/client exports in `@repo/auth`. [Better Auth Next.js integration](https://better-auth.com/docs/integrations/next).
3. Put secrets only in server modules. Public environment variables may contain public configuration, never service credentials.
4. Validate incoming payloads at runtime. Derive tenant/account ownership from verified identity or trusted provider mapping, not request parameters alone.
5. Return pending status for asynchronous actions and let the UI refresh their durable database state. Polling the small customer UI at sensible intervals is sufficient for the first version; a separate realtime service is unnecessary.
6. Disable shared caching for authenticated data, webhook responses and session-setting responses. Static marketing content can be cached independently.
7. Provide health/readiness endpoints, safe error states and clear reconnect instructions. Keep operator-only routes behind separate authorization.

## Failure handling and verification

An API restart must not erase jobs because the database/outbox persists them. A provider outage should show account/campaign status without making the dashboard unusable. Test browser refresh during activation, duplicate submissions, expired login, cross-tenant URLs, reconnect failure and mobile access.

Separate reads from commands in the domain layer so retries of a page request never send a message. User-facing counts come from confirmed ledger events, not from assumed successful requests.

## Cost

No per-customer framework fee is included. Web compute, staging and bandwidth appear under [Render](render.md). Build the standalone/container output where appropriate; do not run the development server in production.

Marketing is a static export in the baseline. Verify the chosen pages support static export and remove dynamic-only template features from that app; otherwise budget another paid web service. Product and API services remain dynamic deployments started with Bun.

Use the selected next-forge [Next Safe Action addon](next-safe-action.md) for repeated customer commands and [nuqs](nuqs.md) for pipeline URL filters. Runtime validation and authorization stay server-side.
