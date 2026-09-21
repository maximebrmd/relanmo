# Shared contracts for independent crewmates

These are design instructions for the first contract PRs, not claims that interfaces already exist. P003–P006 implement and freeze them; P007 publishes the exact imports. Concrete TypeScript signatures and schemas on the merged application branch then become authoritative. A changed contract needs a small contract PR and affected-task review before its consumers continue. Do not create a speculative microservice, a separate contracts package, a new queue or a new SDK wrapper framework.

## C1 — domain values and rules

Owner: P003. Location: `packages/domain/src/contracts/`. IDs must distinguish tenant, user, account, prospect, campaign/version, action, message, evidence and workflow identities. Persist UTC instants; store `Europe/Paris` with sending-window configuration for local business time. Use explicit nullable values for unknown provider facts; missing data is not false.

| Contract | Required shape / behavior |
| --- | --- |
| Ownership | `BOT_ELIGIBLE` or `HUMAN_OWNED`, plus reason and recorded time. Account/prospect ownership survives campaign changes. Suppression is a separate durable exclusion. |
| Action | Immutable logical ID for tenant + account + prospect + campaign/version + step; exact payload and source versions. State is `READY`, `IN_FLIGHT`, `CONFIRMED`, `FAILED` or `UNKNOWN`. A campaign edit must not make a completed step eligible again under a new version. |
| Versions | Profile, campaign, explicit style, accepted inferred style, prompt-override, default-prompt and model versions. Draft persistence and final send authorization compare relevant current versions. |
| Message | Provider message ID when present; account/prospect/conversation identity; direction; occurrence and receipt times; optional text; attachments; provider source. Empty text with an attachment is still a message. |
| Eligibility | A pure result with allowed/hold/deny and stable reasons. It consumes an authoritative snapshot; it does not read a database or call a model. |
| Due plan | Step, intended target, earliest allowed time and closure time. Delays preserve minimum gaps and permitted windows. |
| Evidence | Source identifier/URL, captured time, bounded normalized claim, typed factual assertions and provenance. No unsupported claim becomes evidence just because a model returns it. |

The sequence invitation has no note. DM1 follows acceptance; follow-up targets are DM1 +2/+5/+9/+14 days. Minimum consecutive gaps are 2/3/4/5 days respectively, measured from the actual prior send; target scheduling uses the later constraint and moves into the next permitted window. Final closure is no earlier than DM1 +21 days and seven days after an actually delayed DM5. Clarify any imported legacy custom cadence instead of silently resetting it.

## C2 — provider ports

Owner: P004. Location: `packages/domain/src/ports/providers/`. Use typed inputs/outputs and explicit error unions. SDK classes, credentials and raw vendor responses stay inside server-only adapters. Every operation has a deadline and stable local correlation ID; a correlation ID is not a provider idempotency guarantee.

| Port | Operations / results to freeze |
| --- | --- |
| LinkedIn accounts | Create hosted connect/reconnect flow; read account status. Caller binds opaque flow state to an authorized tenant. Return supported capabilities and normalized health. |
| LinkedIn discovery | Search bounded candidate pages and read profiles; cursor, provenance and missing-field behavior are explicit. |
| LinkedIn delivery | Invite, inspect acceptance, send message and read recent conversation activity. Success returns provider evidence; definitive refusal and uncertain outcome are distinct. Disable blind SDK retries on writes. |
| Provider events | Authenticate by the supported mechanism, validate, normalize and derive scoped dedupe identity. Do not invent an HMAC header if the provider does not supply one. |
| TypeSafe decisions | Bounded inputs/questions/choices, validated answer/evidence IDs, uncertainty, model/version and billed usage. No send permission in the result. |
| Writing | Composed input, allowed evidence, source versions, normalized drafting/prospect provenance and output budget → text plus usage/error. |
| Billing | Checkout/Portal creation, current subscription reads and raw-body signature verification. Use Stripe-supported idempotency where applicable. |
| Email | Semantic notification/auth template, recipient and stable delivery identity; retries respect available provider semantics. |
| Objects | Authorized key, bounded content/metadata and expiry → private object result or presigned operation. Server chooses tenant prefix. |

Give each port deterministic fixtures for valid output, invalid input, timeout, retryable reads and unavailable credentials. Interface tests can run without real subscriptions. A fixture-backed adapter is not evidence that an endpoint actually works; P089 supplies that evidence.

## C3 — persistence and concurrency

Owner: P005. Location: `packages/domain/src/ports/persistence/`. Concrete schema fragments belong to P014–P019. Each fragment must compile independently: use shared ID/value types, local constraints and an explicit list of cross-fragment foreign keys to integrate. Do not import a sibling schema that has not merged. P020 takes temporary ownership of the merged schema directory to add those cross-table references/relations and generate the complete SQL. P021 adds RLS/roles. Fragment PRs are not a claim that the database has already enforced deferred foreign keys. Every repository has an explicit input/result type, a narrow transaction interface and an assigned implementation directory. Database methods must use the same connection when participating in one transaction.

Define these interface families before distributing repository tasks:

- Tenant/membership/profile lookup and optimistic edits; campaign creation/versioning/activation/pause; customer style and override versions.
- Provider account/connection binding and health; prospect/evidence upsert, identity collisions and suppression.
- Conversation/history reads and deduplicated messages; immutable actions/attempts/receipts; lease/fencing/quota reservations.
- Durable inbox and transactional outbox with dedupe, retry lease, acknowledgement and visible dead letters.
- Atomic reply/manual takeover and atomic send authorization, each with explicit transaction semantics.
- Current billing/entitlement state and provider mappings; idempotent usage/audit receipts; validated import records.

**Common locking protocol.** Document a global order in P005: tenant entitlement → account control → account/prospect ownership → campaign/current versions → style/current versions → action and reservation rows. Operations take the subset they need in that order. Style/campaign mutation and authorization must lock/compare the same current-version rows; updating a revision without the corresponding guard is insufficient. Network calls stay outside these short database transactions.

**Atomic reply stop.** Within one transaction, deduplicate/persist the event and message, mark the pair and conversation human-owned, invalidate future READY work, and add workflow-stop/notification events to the outbox. The incoming-message route uses this transaction immediately. If unknown mapping or malformed input prevents a safe stop, quarantine visibly and hold the affected account; do not label that event successfully processed.

**Atomic authorization.** Under the same account/pair locks, re-read ownership, suppression, account health, campaign, entitlement, due time, versions, quota and lease fence. Transition a unique eligible action to IN_FLIGHT and create its attempt/reservation atomically. After a reply-stop commit, no new authorization can pass. A prior authorization or a reply delayed at the provider remains an external race; record it rather than claiming perfect end-to-end ordering.

**Ambiguous sends.** An expired lease cannot prove that an external request did not occur. UNKNOWN blocks further conflicting outbound activity pending evidence; never release its quota or restart its action just because a timer expired. Provider history IDs and sufficient disambiguating evidence can confirm an outcome. Otherwise retain the hold. Manual outgoing messages are compared with ledger evidence before classifying them as owner activity; uncertain matches hold and reconcile.

**Tenant isolation.** Authenticated membership establishes context; a browser cannot supply a trusted tenant ID. Use transaction-local context on reused pools, RLS and nonowner roles. RLS is defense in depth, not a claim that someone with arbitrary trusted-service SQL access cannot call `set_config`. Keep login/session lookup usable before a tenant exists. Separate migration credentials and restrict workers from auth secrets.

## C4 — product interfaces

Owner: P006. Location: `packages/domain/src/contracts/product/`. Define input validation and view DTOs for profile/onboarding, connection status, campaigns, writing settings, pipeline, conversations, billing and metrics. Each includes safe errors, revision conflicts and fixture states.

Feature UI tasks receive view models and injected command/query functions. They may merge with a fixture preview but must not ship a fake production backend. Public page entrypoints keep incomplete routes disabled in the feature registry. P077 installs `features/<feature>/bindings.ts`, connects completed server functions and enables routes. Page modules should use that agreed binding entrypoint, established as a disabled stub in P007, so P077 does not have to edit every sibling page. Production must fail closed or hide unfinished features; never return demo tenant data to a customer.

P048 owns shared Next Safe Action/query middleware. Feature server code composes repositories and adapters behind it. Tenant membership, account authorization and billing identities are revalidated on the server. Activation is the one authorization for a bounded campaign; draft preview is not send approval and cannot enqueue a send. Humans answer in LinkedIn after handover for the MVP.

## C5 — Temporal interfaces and composition

Owner: P003 for signal/value shapes, P004 for external ports, P005 for persistence ports, P007 for workflow-safe exports. Freeze Workflow IDs, Activity names, small input/result DTOs and signal names before implementation. P076 alone edits aggregate workflow/activity registries.

| Unit | Responsibility |
| --- | --- |
| DiscoveryBatch | Bounded candidate page/batch, cursor/progress and qualifying Activities. |
| ProspectSequence | One bounded invitation/acceptance/DM1–DM5 lifecycle. Timers/signals are deterministic; Activities read authoritative state. |
| AccountReconciliation | Bounded health, acceptance, reply/history and uncertain-outcome checks; history limits and Continue-As-New as needed. |
| Campaign coordinator | Stable deduplicated starts, account/prospect ownership, fair batch limits and durable schedules. |
| Outbox delivery | Idempotent start/stop/pause/account-change delivery and notification dispatch; tolerate missing/completed workflows explicitly. |

Only IDs and compact results belong in workflow history. No SDK/database/Node I/O inside Workflow code. A signal helps a workflow stop promptly; database authorization is still mandatory. Activity retries consult the ledger before an external write. An exception after a send is not a safe retry signal.

## Ownership and change rules

P007 owns manifests, the lockfile and shared exports after initial scaffolding. P020/P021 own migration SQL/journals sequentially. If a later task needs one of these changes, Firstmate creates a small integration task with that ownership; it does not tell every crewmate to update the same file. Never share one mutable development database across parallel test workers: use isolated local databases or approved disposable Neon branches.

The task manifest is a planning DAG. It does not automatically enforce filesystem permissions or Firstmate dispatch. The coordinator must check current diff ownership and merged dependency commits before accepting work.
