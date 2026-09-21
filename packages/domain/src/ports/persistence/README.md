# Persistence port contract (C3)

This directory freezes the domain-facing repository and transaction seams. It contains no Drizzle/Neon code, provider SDK, network operation, schema or migration. The concrete implementations belong to later database tasks and must satisfy these interfaces without widening their transaction context.

## Transaction boundary

Every repository method receives `PersistenceTransaction`. Only a `PersistenceTransactionRunner` may create that value. The value represents one tenant-scoped, checked-out database connection; it is not a pool and cannot be used to smuggle a second client into an operation. A caller that needs several repositories to commit atomically passes the same `tx` to all of them inside one runner callback. Separate calls on separate transactions are not atomic.

The callback returns a `PersistenceResult`; the runner rolls back on `ok: false` (or a thrown database error) and commits only an `ok: true` result.

`tx.scope.tenantId` is the authoritative tenant. Every tenant-bearing input and nested record must match it; a mismatch returns the shared `TENANT_SCOPE_MISMATCH_ERROR` (`FORBIDDEN`) before any read or write. A caller cannot use a customer-supplied tenant ID to widen the transaction scope.

Provider/network calls are outside the transaction. A worker authorizes and records an action using these ports, performs the provider call, then records a receipt using the action fence. An exception or timeout after the provider call is `UNKNOWN`, not permission to retry.

## Lock protocol

Multi-row implementations acquire only the locks they need, always in this global order:

`entitlement -> account -> pair ownership -> campaign versions -> style versions -> action/reservations`

The order is shared by campaign/style mutations, reply/manual takeover and send authorization. The `CurrentVersionGuard` is shared by mutations and authorization: implementations compare the supplied snapshot with the current version rows while holding the relevant locks. A stale revision returns a typed `REVISION_CONFLICT` result.

## Safety guarantees

- The action identity carries tenant + account + prospect + campaign + campaign version + step, while `getByStep` also checks the stable tenant/account/prospect/campaign/step key across versions so a campaign edit cannot replay a completed step. The action payload and source versions are immutable.
- Reusing an action ID with a changed payload or source-version snapshot is an `IMMUTABLE_CONFLICT`; reusing the stable step key across campaign versions returns the existing action instead of creating a new send.
- Pair ownership is one account/prospect row and survives campaign changes; a new campaign cannot reset `HUMAN_OWNED` to `BOT_ELIGIBLE`.
- `stopIncoming` persists the inbox event and message, marks the pair and conversation human-owned, invalidates future `READY` actions, and enqueues workflow-stop and customer-notification events in the same transaction. The event is persisted before any model classification. Attachment-only inbound messages are messages because attachments are sufficient.
- Inbox envelopes carry a dedupe identity, canonical payload fingerprint and bounded scope for incoming, outgoing and unrecognized provider events. Webhook dedupe identity is `tenantId` + `provider` + `dedupeKey`; `inboxEventDedupeIdentityFromProvider` round-trips that triple from `ProviderEventDedupeIdentity`. `validateInboxEventScope` requires every normalized account, prospect, conversation and tenant identifier to equal the nested message identity before state changes; a mismatch is quarantined rather than mapped to either side. `accountIdsToHoldForInboxEvent` derives the exact, deduplicated scope-first account candidate set that belongs to `tx.scope.tenantId`; implementations hold every `affectedAccountIds` atomically with quarantine. The empty tuple is the only no-known-account result and implies `holdAccount: false`; a non-empty tuple implies `holdAccount: true`.
- `recordManualTakeover` atomically persists and deduplicates the outgoing envelope before comparing it with the send ledger while holding the account/pair/action locks. An exact ledger match is a bot echo; an unmatched owner message takes over; an inconclusive match holds the account for reconciliation; redelivery returns `DUPLICATE` without repeating side effects.
- `authorize` re-reads ownership, suppression, health, campaign activation, entitlement, due time, versions, quota and the lease fence, then transitions a unique `READY` action to `IN_FLIGHT` and creates its attempt and reservation atomically. A committed reply stop makes new authorization deny. An already authorized provider request remains an external race and is recorded.
- Account lease fences increase strictly for each tenant/account acquisition and never reset after expiry or release. Quota reservations retain the lease fence; settlement rejects a stale fence explicitly.
- A lease expiry does not prove a send did not happen. `UNKNOWN` actions and their quota reservations remain held (`RETAINED_UNKNOWN`) until provider evidence resolves them; they are never blindly retried.
- Inbox, outbox, billing, usage and audit records use explicit dedupe keys or IDs and expose visible quarantine/dead-letter outcomes.

## Cross-fragment integration keys

P020 adds database foreign keys/relations after the independent fragments are merged. The intended integration list is explicit here: `tenantId` links every tenant-scoped record to tenants/memberships; `accountId` links account, prospect-pair, conversation, action, lease and usage records to provider accounts; `(tenantId, accountId, prospectId)` links ownership, suppression, conversation and action records; `campaignId`/version IDs link campaign and action records; style/profile/prompt version IDs link the current-version snapshot to their version rows; action/attempt/reservation IDs link the send ledger; and inbox/outbox/billing/audit/import IDs remain unique within their tenant. This port PR does not claim those database constraints already exist.

Any fake used by a consumer test is test-only documentation of the port shape; it is not evidence of PostgreSQL locking, isolation, RLS or multi-replica concurrency correctness.
