# TypeScript SDK and integration policy

**Required implementation rule, updated 17 September 2026.** Prefer each vendor's official TypeScript or TypeScript-compatible JavaScript SDK. “Tempora” is interpreted as **Temporal**, the workflow service already selected. All application code is TypeScript; Bun is the package manager and Node.js 24 LTS is the deployment runtime.

Consult the [dependency policy](dependency-policy.md) and next-forge documentation before adding a package. An official SDK preference does not bypass the user’s approval rule for a new unlisted dependency. Wrangler setup and the existing AWS SDK v3 R2 adapter are explicitly requested.

## SDK inventory and ownership

| Integration | Package / import | Repository owner | Evidence |
| --- | --- | --- | --- |
| Temporal orchestration | `@temporalio/client`, `@temporalio/common`, `@temporalio/worker`, `@temporalio/workflow`, `@temporalio/activity`; `@temporalio/testing` in tests | `packages/workflows`, `apps/worker`; client entry point available to dispatchers | [Official SDK](https://github.com/temporalio/sdk-typescript) |
| TypeSafe decisions | `@typesafe-ai/sdk` | `packages/connectors/typesafe` | [Official SDK docs](https://docs.typesafe.ai/sdk/javascript), [SDK repository](https://github.com/typesafe-ai/typesafe-sdk-js) |
| LinkedIn through Unipile | `unipile-node-sdk` | `packages/connectors/unipile` | [Official SDK](https://github.com/unipile/unipile-node-sdk) |
| Claude writing | `@anthropic-ai/sdk` | `packages/connectors/anthropic` | [Official SDK](https://github.com/anthropics/anthropic-sdk-typescript) |
| Authentication | `better-auth`, `@better-auth/drizzle-adapter`; integration imports `better-auth/next-js`, `better-auth/react` | `packages/auth` | [Drizzle adapter](https://better-auth.com/docs/adapters/drizzle), [Next.js integration](https://better-auth.com/docs/integrations/next) |
| SQL / schema | `drizzle-orm`, `pg`; development `drizzle-kit`, `@types/pg` | `packages/database` | [Drizzle PostgreSQL integration](https://orm.drizzle.team/docs/get-started-postgresql) |
| Neon administration, only if automated | `@neon/sdk` | Isolated infrastructure scripts | [Neon management API](https://neon.com/docs/reference/api/projects/list-projects.md) |
| Payments | `stripe` server SDK; `@stripe/stripe-js` only if the browser integration actually needs it | `packages/payments` | [Stripe Node SDK](https://github.com/stripe/stripe-node) |
| Transactional email | `resend` | `packages/email` | [Resend Node SDK](https://resend.com/docs/send-with-nodejs) |
| Private R2 objects | `@aws-sdk/client-s3`, `@aws-sdk/s3-request-presigner` | `packages/storage` | [Cloudflare's SDK example](https://developers.cloudflare.com/r2/examples/aws/aws-sdk-js-v3/) |
| R2 setup CLI | `wrangler` (development tooling) | Repository infrastructure tooling | [R2 CLI](https://developers.cloudflare.com/r2/get-started/cli/) |
| Fumadocs docs | `fumadocs-core`, `fumadocs-ui`, `fumadocs-mdx`, required MDX types | `apps/docs` | [Next.js setup](https://www.fumadocs.dev/docs/manual-installation/next) |
| Customer commands / filters | `next-safe-action`, existing `zod`, `nuqs` | `apps/app` | [Next Safe Action addon](https://www.next-forge.com/docs/addons/next-safe-action), [nuqs addon](https://www.next-forge.com/docs/addons/nuqs) |
| Monitoring | `@sentry/nextjs`, `@sentry/node` for worker processes | `packages/observability` and app-specific bootstraps | [Next.js SDK](https://docs.sentry.io/platforms/javascript/guides/nextjs/), [Node SDK](https://docs.sentry.io/platforms/javascript/guides/node/) |

`@neondatabase/serverless` is Neon's official HTTP/WebSocket SQL driver for deployments that need it. The baseline uses `pg` because Render services are persistent Node processes and the send ledger needs short interactive transactions. Management SDKs, SQL drivers and ORMs are different layers; installing one does not substitute for the others. [Neon connection guide](https://neon.com/docs/connect/choose-connection).

## Required adapter behaviour

1. Pin tested SDK versions and API/model versions where supported. Keep every `@temporalio/*` package on the same SDK release. Record vendor versions alongside integration test evidence.
2. Keep SDK objects within server-only adapter modules. Domain rules consume our contracts, such as a normalized incoming message, rather than vendor classes. Separate workflow-safe exports from modules that import SDKs, Node APIs or the database.
3. Validate incoming webhook bodies at runtime. TypeScript typings do not authenticate a request or prove an account belongs to a tenant.
4. Set request timeouts and review SDK automatic retry defaults. Disable blind retries around an ambiguous Unipile send; a timeout becomes `UNKNOWN` and enters reconciliation. Stripe calls use supported idempotency keys, while webhook event IDs are still deduplicated locally.
5. Bound concurrency and record request IDs, durations and billed usage without logging credentials or full private messages. Check rate-limit errors and distinguish retryable failures from account restrictions.
6. Run outbound network calls in Temporal Activities, not Workflow code. Workflow definitions use the SDK's deterministic primitives for timers, signals and cancellation.
7. If an essential vendor endpoint is absent from its official SDK, first confirm that gap against the pinned release. Use a small typed HTTP implementation behind the same adapter, with endpoint-specific tests and a comment explaining why. Do not invent a method name or silently switch to a third-party wrapper.

## Version acceptance before building

The guide identifies packages, not a prevalidated lockfile. The build must record exact next-forge, Bun, Node, Next.js, Better Auth, Drizzle, Temporal, TypeSafe, Ultracite and Biome versions after a clean-install compatibility run. In particular, choose a compatible released Better Auth adapter/Drizzle relation API; do not combine an old generated auth schema with a newer adapter by assumption.

Acceptance requires a frozen Bun install, an actual Node worker boot, migrated auth tables, a working sign-in, signed Stripe webhook verification, one evaluated TypeSafe decision and a provider integration report. Those checks have not been executed on an application in this documentation task.
