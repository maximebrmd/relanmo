# Drizzle ORM — required schema and query layer

Drizzle owns all application and Better Auth database schemas and SQL migrations in `packages/database`. Neon hosts the single PostgreSQL deployment per environment; Drizzle adds no hosted service bill.

## Driver and connections

Use `drizzle-orm/node-postgres` with `pg` for the persistent Render processes. Use a small pool per process and the pooled Neon URL for ordinary runtime transactions. Keep a separate direct URL and migration role for schema changes and database exports. Do not use an HTTP-only one-shot driver for code that expects an interactive transaction with locks and dependent reads. [Drizzle PostgreSQL driver](https://orm.drizzle.team/docs/get-started-postgresql), [Neon connections](https://neon.com/docs/connect/choose-connection).

## Schema ownership

1. Replace next-forge's Prisma client, schema files, migration commands and callers. Preserve the shared package name `@repo/database`.
2. Generate auth definitions from the configured Better Auth version and plugins using its official CLI, then incorporate them alongside product definitions. The current adapter docs use `@better-auth/drizzle-adapter`. Verify relation API compatibility before choosing a release pair. [Auth schema generation](https://better-auth.com/docs/adapters/drizzle).
3. Keep auth identities distinct from `provider_accounts`. Add tenant-consistent foreign keys, deduplication constraints, unique step keys and indexes for pending work.
4. Generate reviewed SQL with the pinned `drizzle-kit`, commit the migration and apply it once through the release pipeline. Run commands with Bun-managed dependencies. Never leave next-forge's original Prisma migration script active.
5. Use additive schema changes during rolling deployments. Backfill before switching reads; remove old columns only after all workers are compatible.

Drizzle is the single migration authority. Do not run a separate auth schema-migration engine or production `db push` in parallel with reviewed migrations. Generated TypeScript definitions are inputs, not proof that SQL has already been applied.

## Transactions and tenancy

The reply-stop transaction stores the message, changes ownership, cancels pending work and inserts outbox records together. Send authorization checks current ownership and reserves quota in a short transaction. Both paths lock the same account/prospect coordination row so a reply and send reservation cannot bypass one another. External calls happen after the transaction; uncertain outcomes remain explicit.

Use typed repositories requiring verified tenant context. If using RLS, set the validated tenant context transaction-locally on the same connection and query within that transaction. Neon pooling uses transaction semantics, so session state must not be assumed to survive. Use row locks and lease/fencing records, not session advisory locks through the pooler. RLS must be tested using actual runtime roles; owner/admin connections can bypass policies. [Neon pooling](https://neon.com/docs/connect/connection-pooling), [PostgreSQL RLS](https://www.postgresql.org/docs/current/ddl-rowsecurity.html).

## Verification and cost

Apply migrations to an empty database and the previous schema. Test account ownership, duplicate actions, concurrent sends and reply races against real PostgreSQL. Verify Better Auth can create, read and revoke sessions through the chosen adapter.

No Drizzle subscription is needed. Database compute is in Neon; CI and migration execution are in the existing build budget.
