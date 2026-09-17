# Neon — managed PostgreSQL

**Status: required by the user.** Neon hosts the product and Better Auth tables. Drizzle owns their schema and migrations. Better Auth runs in our application; this design does not require Neon's managed Auth service. [Architecture](../architecture.md) · [Costs](../cost-estimate.md).

## Configuration

1. Create separate production and staging projects in an available EU region close to Render Frankfurt. Confirm the region before provisioning. Use the production root branch for live state and configure a seven-day restore history window on the paid Launch plan.
2. Keep production compute available continuously. Staging may suspend when idle; disable its periodic jobs outside test sessions so they do not keep waking the database. The cost model includes 160 staging compute hours per month.
3. Use a small `pg` pool through the pooled Neon connection string in `apps/app`, `apps/api` and `apps/worker`. Size the total across replicas, including Better Auth connections. These are long-running application and worker processes, so the PostgreSQL wire driver fits their interactive transactions. [Connection choices](https://neon.com/docs/connect/choose-connection), [pooling](https://neon.com/docs/connect/connection-pooling).
4. Keep an unpooled connection string and privileged migration role in the controlled release environment. Application roles should not own tables or have unrestricted administrative rights.
5. Treat preview databases as separate environments. Use synthetic fixtures or sanitized data; a database branch can copy authentication sessions, personal data and send state. Never give preview workers production provider credentials.
6. Set compute bounds, spend alerts and retention limits. Monitor query latency and average billed compute instead of assuming every deployment scales to zero.

Application SQL uses Drizzle plus `pg`. The official `@neon/sdk` is for optional infrastructure automation, not the SQL query path. `@neondatabase/serverless` is an alternative if a future serverless deployment needs it; it is not required in the Render baseline. [Neon API documentation](https://neon.com/docs/reference/api/projects/list-projects.md).

## Recovery

Test restore procedures before onboarding customers. Stop outbound workers before recovery, invalidate restored login sessions as appropriate, and reconcile provider receipts before any campaign resumes. Neon restore changes database state; it cannot undo a LinkedIn message. Root branches support instant restore, while child branches have different recovery behaviour. [Instant restore](https://neon.com/docs/postgres/backup-restore/branch-restore).

Keep periodic encrypted logical exports in private object storage for an independently recoverable copy. Restore history and exports have separate retention settings. File storage is covered by [Cloudflare R2](cloudflare-r2.md).

## Pricing

The current Launch tariff is $0.106/CU-hour, $0.35/GB-month of database storage and $0.20/GB-month of restore history, with no fixed monthly minimum. Compute, storage and history assumptions are separate inputs in the calculator. Launch permits up to seven days of history; this is a configured window, not a flat $100 backup add-on. [Current official pricing](https://neon.com/pricing.md).

Launch is the pilot recommendation. If the business requires a contractual uptime SLA or Scale-only network controls, evaluate Scale and recalculate its compute rate. The baseline does not purchase those features.
