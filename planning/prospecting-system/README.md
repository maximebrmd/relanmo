# Relanmo — cloud prospecting technical handover

**Specification updated: 17 September 2026. Developer labour: €0, as requested.**

Build a shared cloud application around Unipile for LinkedIn, TypeSafe for structured decisions, and Claude's API for French message writing. Temporal coordinates the work. Build with next-forge, Neon PostgreSQL, Better Auth, Drizzle, Stripe, Ultracite with Oxlint and Oxfmt plus its vendored anti-slop preset, Bun as package manager, and Fumadocs for documentation. Bun runs the Next.js app and API processes; Node.js 24 runs the Temporal worker. Official TypeScript-compatible SDKs are required where available.

Customers connect LinkedIn, configure their offer and target market, and activate a bounded campaign. Prospecting continues with their laptop switched off. The first incoming prospect message ends automation for that conversation; a human takes over. No Claude Desktop, Cowork, browser extension, or customer-owned worker is required by this design.

This revision supersedes the previous Supabase stack and owned LinkedIn connector proposal. The latest user choices are fixed requirements. It documents a proposed implementation; it is not a deployed system or a report of live integration tests.

## Brand and repository

**Name: Relanmo.** Tagline: « La prospection avance. Vous aussi. » The public implementation repository is [maximebrmd/relanmo](https://github.com/maximebrmd/relanmo). Its initial commit contains this pack at `planning/prospecting-system/`, branding and coding instructions; the app implementation starts with P001.

Read the [brand guide](brand/README.md) and [visual identity preview](brand/preview.html) before creating the product UI.

## Read these first

1. [Cost estimate](cost-estimate.md): monthly bills, launch cash, assumptions, optional charges, and sensitivity.
2. [Architecture](architecture.md): component, prospect lifecycle, and reply-handling diagrams.
3. [Implementation plan](implementation-plan.md): build order, migration, and release criteria.
4. [Editable cost inputs](cost-model.json) and [calculated results](cost-results.json).
5. [SDK policy](sdk-policy.md): official package names, ownership and runtime rules.
6. [Dependency policy](dependency-policy.md) and [AGENTS.md](AGENTS.md): next-forge first, with discussion before unlisted additions.
7. [Prompt personalization](prompt-personalization.md): defaults, profile adaptation and customer editing.
8. [Parallel execution plan](execution-plan.md): 95 small Firstmate task briefs, dependency and ownership rules, and the Luna/max/Fast handoff.
9. [Searchable task board](crew/board.html), [task index](crew/task-index.md), and [prompt to give Firstmate](crew/captain-prompt.md).
10. [Readable handbook](handbook.html): core specifications and tool guides together, with nine rendered diagrams; individual task briefs live in `crew/tasks/`. Both HTML views work offline after downloading the package.

To explore different usage or exchange-rate assumptions, edit the JSON and run `python3 calculate-costs.py` using the [included calculator](calculate-costs.py). It prints revised totals without overwriting the original dated report.

## Selected stack and tool guides

Each first-class technology has its own `.md` (30 tool guides, including Firstmate for development coordination). SDKs and framework dependencies are covered in their parent guide; this is not an inventory of every transitive package.

| Tool | Purpose | Guide |
| --- | --- | --- |
| next-forge | Required monorepository foundation | [next-forge.md](tools/next-forge.md) |
| Turborepo | Workspace build/test coordination | [turborepo.md](tools/turborepo.md) |
| Bun | Required package manager and workspace installation | [bun.md](tools/bun.md) |
| Ultracite | Required lint/format policy using Oxlint, Oxfmt and vendored anti-slop | [ultracite.md](tools/ultracite.md) |
| Fumadocs | Required product documentation in `apps/docs` | [fumadocs.md](tools/fumadocs.md) |
| Next Safe Action | Validated customer commands, a documented next-forge addon | [next-safe-action.md](tools/next-safe-action.md) |
| nuqs | Typed pipeline URL filters, a documented next-forge addon | [nuqs.md](tools/nuqs.md) |
| Next.js | Customer app, marketing, docs and API | [nextjs.md](tools/nextjs.md) |
| Node.js | Temporal worker runtime | [nodejs.md](tools/nodejs.md) |
| TypeScript | Application language and shared contracts | [typescript.md](tools/typescript.md) |
| Neon | Required managed PostgreSQL host | [neon.md](tools/neon.md) |
| PostgreSQL | Authoritative product and auth state | [postgresql.md](tools/postgresql.md) |
| Drizzle ORM | Required schema, queries and migrations | [drizzle.md](tools/drizzle.md) |
| Better Auth | Required authentication running in the application | [better-auth.md](tools/better-auth.md) |
| Stripe | Required customer subscription payments | [stripe.md](tools/stripe.md) |
| Unipile | LinkedIn connection, discovery, invites, messaging and events | [unipile.md](tools/unipile.md) |
| TypeSafe AI | Structured qualification and evidence decisions | [typesafe-ai.md](tools/typesafe-ai.md) |
| Anthropic Claude API | French message writing | [anthropic.md](tools/anthropic.md) |
| Temporal Cloud | Durable schedules, waits and recovery | [temporal.md](tools/temporal.md) |
| Cloudflare R2 | Private files and backup objects | [cloudflare-r2.md](tools/cloudflare-r2.md) |
| Wrangler | Required CLI setup for R2 buckets and settings | [wrangler.md](tools/wrangler.md) |
| Render | App/API/worker hosting and static marketing | [render.md](tools/render.md) |
| Resend | Authentication and operational email | [resend.md](tools/resend.md) |
| Sentry | Errors and operational monitoring | [sentry.md](tools/sentry.md) |
| GitHub Actions | CI and release checks | [github-actions.md](tools/github-actions.md) |
| Docker | Reproducible service images | [docker.md](tools/docker.md) |
| Vitest | State, scheduling and integration tests | [vitest.md](tools/vitest.md) |
| Playwright | Customer product browser tests | [playwright.md](tools/playwright.md) |
| Firstmate | Parallel coding crewmates, independent review and task supervision | [firstmate.md](tools/firstmate.md) |

Neon and PostgreSQL describe the same database deployment. Better Auth runs in our application and stores its data there; no additional managed-auth subscription is assumed. R2 replaces the previous bundled file store; Wrangler configures it and the AWS S3 v3 SDK handles object operations. Bun installs packages and runs the Next.js app/API services while Node.js 24 runs the Temporal worker. Stripe is required, but its revenue-dependent fees are separated from infrastructure in the estimate.

The monorepository uses `apps/app`, `apps/web`, `apps/api`, `apps/docs` with Fumadocs, and `apps/worker`. Replace the template's default Clerk/Prisma integrations with Better Auth/Drizzle. Ultracite explicitly uses its Oxlint/Oxfmt providers and vendored anti-slop preset. See the [next-forge adaptation guide](tools/next-forge.md).

## Scope of the estimate

Included: customer onboarding, LinkedIn connection/reconnection, freelancer offers and ICP, LinkedIn discovery, qualification, invitation tracking, DM1–DM5, first-reply handover, customer alerts, campaign controls, basic metrics, operational monitoring, imports from the existing product, and required Stripe subscription integration.

The current skill repository supplies reusable product logic and French templates. Port those into versioned product rules and evaluation fixtures. Shared default prompts live in our own `packages/prompts`; customer edits and style profiles live in Neon. Defaults adapt to profile facts automatically while writing preferences stay editable. Excel becomes an import/export format; PostgreSQL owns live state. Existing customer histories, exclusions and past replies must survive migration.

The runtime continuously processes events and due work. Outbound scheduling uses `Europe/Paris` with configurable business hours. This means continuous service availability, not continuous sending. Sequences stop on a reply, manual takeover, opt-out, account problem, campaign pause, or their configured final step.

Profile audits, content publishing, other freelance platforms, funding-news feeds, and cold email are expansion modules. They are not required for the autonomous LinkedIn product and are not included in the baseline workload. The cost estimate explains their incremental cost drivers.

## Important implementation boundaries

- The application owns customer permissions, prospect history, campaign rules and send decisions. Unipile owns the LinkedIn connection layer.
- A reply stops automation before any model classifies it. An attachment-only message also counts.
- Reconnects and account challenges can require customer action. Unipile reduces connector work; it does not remove every LinkedIn restriction or outage. Its LinkedIn connection is not the official LinkedIn messaging API. [Unipile's explanation](https://www.unipile.com/pricing-api/).
- TypeSafe is an early-access dependency. Validate access, capacity and French-domain accuracy before making it a production requirement. [TypeSafe launch announcement](https://typesafe.ai/blog/introducing-system-one-models-and-jev).
- EU application hosting does not mean every provider processes all data exclusively in the EU. Configure regions where available and document the actual data flows.

All setup steps, schemas, workload quantities and capacity choices in these files are recommendations. Linked official documents provide evidence for provider capabilities and prices; they do not validate our unbuilt system.
