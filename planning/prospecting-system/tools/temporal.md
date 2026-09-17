# Temporal Cloud — durable orchestration

**Status: recommended core service.** Use the TypeScript SDK and run its workers on Render. [Architecture](../architecture.md) · [Cost calculation](../cost-estimate.md).

## Why use it

Prospecting involves waits lasting days, external events, cancellations and retries across deployments. Temporal provides durable orchestration for this kind of workflow. Our code still owns the prospecting state machine and the safety of external sends. [TypeScript developer guide](https://docs.temporal.io/develop/typescript).

## Workflow design

- `DiscoveryBatch`: fetch a bounded page/batch, normalize candidates and evaluate them. Avoid one indefinitely running workflow containing every candidate.
- `ProspectSequence`: one campaign's invitation/acceptance/DM lifecycle for one prospect. Stable workflow identity includes tenant, account, prospect and campaign version.
- `AccountReconciliation`: periodically verify health and reconcile relevant provider state using bounded batches.
- `NotificationDelivery`: deliver handover or reconnect alerts from durable product events.

Use Temporal activities for database and network I/O. Workflow code must remain replay-safe. Pass record IDs and small results; keep raw profiles, drafts and inbox content out of workflow history where possible.

## Setup steps

1. Create production and staging namespaces. Select Frankfurt or another suitable EU region. Use separate task queues and service credentials. [Supported regions](https://docs.temporal.io/cloud/regions).
2. Configure application variables such as `TEMPORAL_ADDRESS`, `TEMPORAL_NAMESPACE`, `TEMPORAL_API_KEY` and task queue names. Keep credentials server-side.
3. Implement durable timers using dates computed from the campaign's `Europe/Paris` rules. Persist the campaign version and due-step identity.
4. Use workflow signals for replies, account problems and pauses. Database state remains authoritative: signal delivery may be delayed.
5. Deliver start/stop requests from a transactional outbox. Make start and signal delivery idempotent, with stable workflow IDs and explicit handling of completed or missing workflows.
6. Configure timeouts and bounded retries per activity. Reads can often retry; sends must consult the action ledger and reconcile uncertain outcomes.
7. Use worker versioning/replay-compatible changes. Keep old workers available until affected workflow versions can migrate or finish.

## Reliability details

The reply webhook first commits `HUMAN_OWNED` to Postgres, then queues a workflow signal. Cancelling a timer is helpful, but every send activity must also check current database state. Cancellation does not retract a message already dispatched to an external provider.

Handle a worker restart after a successful provider request but before completion was recorded. On recovery, mark or retain an uncertain send and reconcile the provider conversation. A durable workflow does not make LinkedIn message delivery exactly once.

Bound history size. Use Continue-As-New for account-level work as needed and finish prospect workflows once their sequence ends. Avoid tiny polling activities running every second across all accounts.

## Acceptance checks

Use time-skipping workflow tests for the entire cadence. Test pause/reply signals before, during and after waits; worker restarts; incompatible deployment prevention; and an API outage while reply events continue to arrive. Replay representative histories before deploying workflow changes.

## Cost

The current Developer offering has no base monthly fee and adds 10% support to usage. The cost model includes actions, active history and retained history rather than actions alone. [Temporal pricing](https://docs.temporal.io/cloud/pricing).

Our baseline allowance is approximately $1.48/customer/month at the stated workload. This is an estimate to replace with measured history and action counts. Worker hosting is billed separately under Render. Premium support and multi-region HA are separate choices.

A Postgres job queue could lower provider spend, but it would require us to own more orchestration behaviour. I recommend Temporal here because reliable long-lived sequences are central to the product; there is no separate Redis queue in this design.

## Monorepo and runtime requirements

Use `@temporalio/client`, `@temporalio/common`, `@temporalio/worker`, `@temporalio/workflow` and `@temporalio/activity`, with `@temporalio/testing` for tests, all on the same release. Workflow definitions live in `packages/workflows`; `apps/worker` boots the Node worker and registers Activities. Vendor SDK calls and Drizzle transactions run in Activities, outside deterministic Workflow code. Bun manages installation while Node.js 24 runs the worker. [Official SDK and runtime requirements](https://github.com/temporalio/sdk-typescript).
