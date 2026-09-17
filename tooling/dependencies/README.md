# Dependency integration baseline

P007 owns the workspace dependency pins and export boundaries. This inventory is the review record for the direct dependencies added by this task. Versions are exact so that the single `bun.lock` remains reproducible.

| Area | Direct packages | Reason and source |
| --- | --- | --- |
| Auth | `better-auth@1.7.5`, `@better-auth/drizzle-adapter@1.7.5` | Better Auth sessions and the documented Drizzle adapter. See [Better Auth Drizzle](https://better-auth.com/docs/adapters/drizzle) and [Next integration](https://better-auth.com/docs/integrations/next). |
| Database | `drizzle-orm@0.45.2`, `pg@8.23.0`, `drizzle-kit@0.31.10`, `@types/pg@8.23.1` | Neon PostgreSQL access and schema tooling through the approved Drizzle stack. |
| Temporal | `@temporalio/{activity,client,common,worker,workflow,testing}@1.24.0` | Workflow contracts and the Node worker. Every Temporal package is pinned to the same release; workers stay on Node 24 because Temporal worker features require Node APIs. See [Temporal TypeScript SDK](https://github.com/temporalio/sdk-typescript). |
| Connectors | `unipile-node-sdk@1.9.3`, `@typesafe-ai/sdk@0.6.0`, `@anthropic-ai/sdk@0.126.0` | Approved Unipile, TypeSafe and Anthropic adapters. SDK imports belong in server adapters, never in workflow-safe modules. |
| Billing | `stripe@22.6.2` | Approved Stripe adapter for server-side billing operations. |
| Email | `resend@6.28.1`, `@react-email/components@1.0.12`, `@react-email/render@2.1.0` | Approved Resend delivery with the React Email template path documented by next-forge. `@react-email/render` satisfies Resend's optional peer for rendered templates. |
| Object storage | `@aws-sdk/client-s3@3.1135.0`, `@aws-sdk/s3-request-presigner@3.1135.0` | Cloudflare R2 runtime operations through the AWS SDK v3. Bucket configuration remains Wrangler-owned. See [R2 AWS SDK v3](https://developers.cloudflare.com/r2/examples/aws/aws-sdk-js-v3/). |
| R2 tooling | `wrangler@4.134.0`, `@cloudflare/workers-types@5.20260917.1` | Approved Wrangler setup and its required type peer. No R2 API traffic is performed by P007. See [Wrangler R2 CLI](https://developers.cloudflare.com/r2/get-started/cli/). |
| App actions and telemetry | `next-safe-action@8.7.3`, `nuqs@2.10.1`, `@sentry/nextjs@10.75.0`, `@sentry/node@10.75.0` | Approved next-forge add-ons and the agreed observability package split. |

`server-only@0.0.1` is used by server entrypoints as a boundary marker. React, React DOM, Zod, and the existing next-forge packages remain on the workspace's approved pins. No Clerk, Prisma, Supabase, Mintlify, or unapproved provider is introduced here.

The export maps publish only planned package surfaces. Future implementation tasks replace the `DISABLED` entrypoints without changing import paths. The `@relanmo/domain/workflow-safe` and `@relanmo/workflows/workflow-safe` surfaces are deterministic and contain no Node, SDK, database, billing, email, storage, telemetry, or `server-only` imports. Run `bun run verify:exports` to check those claims and all disabled app feature bindings.
