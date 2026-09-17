# Sentry — errors and service health

**Status: recommended operational service.** Instrument both the web application and workers. [Budget](../cost-estimate.md).

## What to observe

Capture application errors with release, environment, workflow/action ID and a pseudonymous tenant identifier. Track provider latency, unknown send outcomes, failed outbox delivery, webhook processing lag, stale reconciliations and per-tenant usage. Keep authoritative financial and action records in Postgres; Sentry is not the audit ledger.

## Setup

1. Create separate web and worker projects/environments and choose available data-region settings deliberately.
2. Configure SDK initialization and release/source-map handling. Scrub secrets, hosted-auth links, cookies, request bodies and message contents before export.
3. Start with conservative trace sampling. Disable broad session replay of inbox/onboarding content until its data handling is explicitly designed.
4. Add an external uptime check for an application health endpoint and a scheduled-worker check-in. A process that crashed cannot report its own continued absence without an external observer.
5. Route actionable alerts to the responsible operator. Alert on sustained queue lag, unknown sends and account-reconciliation failures; aggregate repeated provider-outage errors to avoid a flood.
6. Add spending/event alerts and cap optional diagnostic features. Build a small product operations screen for affected account IDs and safe recovery actions.

The current pricing page includes uptime and cron monitoring allowances. Check the plan's actual quota and paid extras before adding monitors per customer; we need service health checks, not one paid monitor per account. [Sentry pricing and included capabilities](https://sentry.io/pricing/).

## Incident behaviour

Pause affected outgoing work when delivery state is uncertain. Continue storing inbound events. Investigate with correlation IDs and the action ledger; do not paste customer credentials or full inboxes into error reports.

## Verification and cost

Simulate an API failure, kill a worker and make the webhook endpoint unavailable in staging. Verify the right alerts arrive, contain no secrets and identify the correct environment. Confirm alert recovery after service restoration.

The estimate allocates $30/month initially, rising to $60 and $100 as traffic increases. These are operating allowances, not fixed all-inclusive quotes. The page displays Team pricing from $26/month; billing cadence and event volume determine actual spend. Paid AI debugging and unrestricted profiling are excluded.
