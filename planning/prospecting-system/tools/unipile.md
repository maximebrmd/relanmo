# Unipile — LinkedIn connector

**Status: required.** Replaces the customer's local Claude/browser connection. Our application retains campaign logic and customer data. [Architecture](../architecture.md) · [Costs](../cost-estimate.md).

## Responsibilities

Connect and reconnect LinkedIn identities, search candidates, read profiles, send invitations, inspect invitation state, read conversations, send messages and receive account/message events. Do not use a second provider-managed campaign engine alongside Temporal: one scheduler should own each sequence.

Search modes vary with the linked account's Classic, Sales Navigator or Recruiter capabilities. Detect capability rather than assuming every customer has premium access. [Search documentation](https://developer.unipile.com/docs/linkedin-search).

## Setup and implementation

1. Create separate provider configurations for staging and production. Keep the API key and assigned API base URL in server-side secrets, using application variables such as `UNIPILE_API_KEY` and `UNIPILE_BASE_URL`.
2. Build a server endpoint that creates a short-lived Hosted Auth link restricted to LinkedIn. Map its correlation value to an expiring, single-use connection attempt in our database. Never accept a client-selected tenant ID as account ownership.
3. Use Hosted Auth's supported login/challenge path. After its callback, retrieve and verify the connected account before binding it. Keep the success redirect as a UI transition only. Generate a new link for reconnects. [Hosted Auth](https://developer.unipile.com/docs/hosted-auth).
4. Register message and account-state webhooks with a configured secret header, such as the documented `Unipile-Auth` example, and explicitly set JSON content type where needed. Verify the secret and payload before processing. Persist accepted events, then return HTTP 200 promptly. The documentation describes five retries and a 30-second response deadline; design well below that deadline and retain reconciliation for outages beyond retries. This secret-header mechanism is not a claimed HMAC signature. [Webhook authentication and retries](https://developer.unipile.com/docs/webhooks-2).
5. Normalize provider responses behind our own interface. Suggested internal methods are `searchProspects`, `getProfile`, `invite`, `getRelationship`, `listMessages`, `sendMessage` and `getAccountHealth`. These are proposed application contracts, not claims about SDK method names.
6. Bootstrap relevant conversation history at connection, then ingest events and run periodic reconciliation. Bound reconciliation batches and keep a cursor per account. Refresh a thread before a pending send when inbox freshness is uncertain.
7. Route every outbound request through the database send ledger, account lease and quota checks described in the architecture. Preserve returned provider IDs.

## Events and handover

Normalize actual messages into `INBOUND`, `BOT_OUTBOUND` or `OWNER_OUTBOUND`. Provider message events can contain both incoming and outgoing activity; the sender identity matters. Initial connection does not emit all old messages as webhooks, so migration needs explicit history loading. [Message event documentation](https://developer.unipile.com/docs/new-messages-webhook).

An incoming prospect message atomically marks the conversation human-owned and cancels pending actions. An outgoing event not matched to an in-flight or confirmed bot action is treated as possible owner activity and reconciled before further automation. Never rely on “unread” status: the freelancer may have read a reply elsewhere.

## Failure behaviour

- Authentication/challenge/restriction: pause the account and show a reconnect or intervention task.
- Rate limit: respect the provider response and delay relevant work; do not switch identities to bypass it.
- Read failure: bounded retry and backoff.
- Ambiguous send timeout: mark `UNKNOWN`, reconcile history, and hold if still unresolved.
- Event endpoint outage: recover from durable storage plus provider reconciliation; do not assume webhooks alone cover every failure.

## Release checks

Prove hosted login without a required extension, ordinary-account search, acceptance recognition, incoming and manual outgoing events, duplicate-event deduplication, reconnect catch-up, and ambiguous-send recovery. Run live sends only on explicitly enrolled test accounts/recipients during implementation.

## Cost and ownership

The bill scales with linked identities, not browser servers. Exact tiers and a discrepancy in the published pricing examples are captured in the [cost estimate](../cost-estimate.md). Also measure customer reconnection frequency and support incidents: those are important product costs even with free developers.

Unipile's API billing does not remove LinkedIn account limits. Its connector is a dependency that can fail; keep our adapter replaceable and preserve provider-independent IDs in product records.

## Required SDK integration

Use the official `unipile-node-sdk` package behind the shared connector adapter. Bun installs it; Node runs it inside Temporal Activities. Pin the evaluated release and inspect its timeout/retry behaviour. Follow the [SDK policy](../sdk-policy.md) for narrow typed fallbacks when a documented endpoint is absent. [Official SDK source](https://github.com/unipile/unipile-node-sdk).
