# Implementation and migration plan

**Labour is priced at €0.** The steps below define the work that still needs to happen. They are not a vendor setup service or a fixed calendar commitment.

For coding delegation, use the [Firstmate execution plan](execution-plan.md) and its [95 task cards](crew/task-index.md). The phases below describe product milestones; the task dependency graph is the detailed dispatch order. Shared contracts precede independent work, with one owner for lockfiles, exports and migrations.

## Phase 0 — establish the required stack

1. Consult next-forge’s live `llms.txt` and [dependency policy](dependency-policy.md). Initialize next-forge with Bun, copy the included [AGENTS.md](AGENTS.md) to the application repository root, record the upstream revision, and commit the single `bun.lock`. Pin tested Bun and Node.js 24 releases.
2. Replace the default Prisma integration with Drizzle in `packages/database`. Replace Clerk with Better Auth in `packages/auth`, including UI providers, route guards, user controls, webhooks and environment keys.
3. Create separate Neon environments and generate Better Auth's Drizzle schema from the configured auth features. Review and apply auth plus product migrations through one Drizzle release process.
4. Add `apps/worker`, deterministic workflow definitions and official SDK adapters. Keep the existing `apps/app`, `apps/web` and `apps/api` roles, and add `apps/docs` with Fumadocs instead of Mintlify. Use Node.js to run compiled Temporal workers.
5. Configure Ultracite with its Biome provider, root lint/format commands and strict TypeScript checks. Verify frozen Bun installation and native SDK startup in Linux images.
6. Configure Stripe Checkout, Portal and verified subscription webhooks as a required integration. Add billing-to-tenant mappings and test-mode fixtures.
7. Set up private EU R2 buckets through Wrangler, implement AWS SDK v3 object access, and configure Resend auth mail and Sentry. Validate only the environment keys each service needs, and ensure production services cannot silently start with missing required integration keys.

8. Add the selected next-forge addons where used: Next Safe Action for customer commands and nuqs for pipeline query state. Build docs as a static site with browser search.

**Exit:** a clean install builds the monorepository, Drizzle creates a fresh database, Better Auth login works, Stripe test-mode entitlements update, and the Node worker can poll its isolated Temporal task queue. See [SDK policy](sdk-policy.md) for package names and compatibility checks.

## Phase 1 — prove the integrations

Create development accounts and an isolated staging environment. Confirm TypeSafe production access and test its official TypeScript-compatible SDK. With accounts explicitly enrolled in the pilot, test Unipile hosted connection, reconnection, people search, profile reads, invitations, acceptance detection, message sends, incoming messages and owner messages from LinkedIn itself.

Record real request/response shapes with personal data redacted. Determine how each webhook can be authenticated, how duplicate events behave, which account statuses require a pause, and how to reconcile a timed-out send. Check capabilities on ordinary LinkedIn accounts; test premium features separately if those customers are in scope.

**Exit:** a reproducible capability report. No essential feature is accepted merely because a marketing page lists it. The release cannot depend on an untested assumed provider idempotency guarantee.

## Phase 2 — durable state and reply handling

Implement tenant membership, account binding, schema migrations, event deduplication, send ledger, outbox, suppression and first-reply takeover. Add Temporal workflows and worker health checks.

Test the difficult cases before scaling outbound activity: incoming event twice; incoming event before send confirmation; API timeout after an actual send; worker crash after dispatch; reply during a timer; reconnect after downtime; database restoration; and unmatched manual outbound activity. Preserve inbound events even while AI or workflow services are down.

**Exit:** recorded replies prevent new sends; unknown outcomes are held; crash recovery does not blindly resend; two tenants cannot read or operate each other's accounts.

## Phase 3 — discovery and French message quality

Convert the existing offer/ICP definitions into structured customer settings. Port the current DM templates and factuality rules into versioned prompt assets. Use TypeSafe for independent qualification/evidence decisions, followed by dependent offer and angle selection. Claude writes the message. Code and evidence checks decide whether the draft is usable. Implement the [hybrid style system](prompt-personalization.md): shared defaults, automatic profile context, optional style inference, tenant-owned editable overrides and versioned drafts. A style change must invalidate stale unsent drafts without restarting sequences.

Build an evaluation set covering French freelancers, decision-makers, recruiters/ESNs, ambiguous roles, irrelevant hiring signals, outdated facts and unsupported claims. Measure both accepted and rejected examples so a strict threshold does not hide poor recall. Compare Sonnet and Haiku on the same fixtures before changing the cost model's writing model.

**Exit:** an agreed quality threshold passes on held-out examples, with uncertainty routed to skip/hold or a neutral template. Model confidence alone is not a measured success rate.

## Phase 4 — customer product

Build onboarding, account status/reconnect, offer and target settings, editable writing style/templates with previews and reset, campaign activation/pause, lead pipeline, conversation history, handover alerts and basic metrics. Publish French help through `apps/docs`. A customer should understand why a lead was selected, what was sent and why sending stopped.

For the MVP, a human can answer directly in LinkedIn after handover. A fully featured shared inbox is an expansion; the bot does not need it to stop correctly. If an in-app composer is added, it must use the same tenant controls and create an explicit manual-send record.

Use Stripe Checkout, the customer portal and verified subscription webhooks. Reuse existing Stripe customer/subscription records if available, with explicit mappings and no duplicate subscriptions. Configure Resend for customer notifications and authentication email; it is not the cold-prospecting channel in this plan.

**Exit:** the customer journey works with the laptop off, including reconnect, pause and manual reply.

## Phase 5 — migration and controlled launch

1. Export each customer's profile, offers, templates, pipeline, exclusions, message history and original identifiers.
2. Import into staging first; report duplicates, invalid dates and unresolved account mappings.
3. Mark historical replies and human conversations before creating any scheduled work.
4. Disable that customer's plugin scheduling and sending. Record a cutover timestamp.
5. Connect the cloud account and reconcile recent LinkedIn activity, including activity around cutover.
6. Activate only the remaining eligible steps. Do not restart completed sequences.
7. Observe a small cohort through a complete follow-up cycle, including actual replies and reconnects.
8. Expand only after confirming cost per customer, event reliability and message quality.

If rollback is needed, pause cloud sending first. Export the latest receipts and replies before re-enabling any legacy sender. At no point should the old and new runtimes both own sending for the same account.

## Release evidence to retain

| Area | Evidence |
| --- | --- |
| Reply stop | Integration runs covering text, attachments, duplicates, delays and simultaneous sends |
| Delivery recovery | A timed-out send reconciled without duplicate delivery |
| Tenant isolation | Cross-tenant API and database access tests |
| Scheduling | Europe/Paris daylight-saving, business windows, delayed-step spacing and campaign pause tests |
| Migration | Before/after counts, preserved IDs, historical-reply exclusions and signed-off cutover record |
| Quality | French evaluation results, explicit-versus-inferred style precedence, customer overrides, stale draft invalidation and model/prompt versions |
| Documentation | Static Fumadocs build, public-content boundary, valid links and browser search |
| Dependencies | next-forge source and reason for each addition, with user agreement recorded for choices outside the catalog/agreed stack |
| Required stack | Frozen Bun install, Node worker boot, Better Auth/Drizzle schema compatibility, Biome checks and Stripe test-mode event recovery |
| Operations | Restore drill, account outage drill, deployment rollback and actionable alerts |
| Cost | Seven days of measured tokens, Temporal actions/history, network use and database growth |

## Suggested sequencing of cash spend

Defer production-sized subscriptions until the integration spike proves the essential operations. Use local development and mocked provider responses for most tests. Start the full pilot stack when there are real enrolled customers to validate it. The [cost estimate](cost-estimate.md) deliberately assumes paid months without promotional credits so it remains useful after trials expire.
