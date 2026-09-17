# Crewmate task index

95 small review units. `93 ship` tasks and `2 scout` reports. All are planned; none has been executed. IDs identify task cards, not GitHub issues.

Read [the operating guide](README.md) and [contracts](contracts.md) before dispatch. A task is ready when its dependencies are accepted, external gates satisfied and paths unclaimed. Tasks in the same group are not necessarily independent.

## Foundation

| Task | Depends on | External gate |
| --- | --- | --- |
| [P001 — Create the next-forge workspace and remove conflicting defaults](tasks/P001-bootstrap.md) | Preflight | — |
| [P002 — Pin Bun, Node, Ultracite and Biome commands](tasks/P002-toolchain.md) | P001 | — |
| [P003 — Freeze domain identifiers and state contracts](tasks/P003-domain-contracts.md) | P002 | — |
| [P004 — Freeze provider ports and error semantics](tasks/P004-provider-contracts.md) | P003 | — |
| [P005 — Freeze repository and transaction interfaces](tasks/P005-store-contracts.md) | P003 | — |
| [P006 — Freeze customer command and view DTOs](tasks/P006-ui-contracts.md) | P003 | — |
| [P007 — Land the approved dependency and export baseline](tasks/P007-dependency-integration.md) | P004, P005, P006 | — |
| [P008 — Add the pull-request verification workflow](tasks/P008-ci.md) | P007 | — |

## Domain

| Task | Depends on | External gate |
| --- | --- | --- |
| [P009 — Implement the pure outbound eligibility rules](tasks/P009-eligibility.md) | P007 | — |
| [P010 — Implement the French business-window cadence](tasks/P010-cadence.md) | P007 | — |
| [P011 — Implement prospect identity and suppression matching](tasks/P011-identity.md) | P007 | — |
| [P012 — Implement deterministic message checks](tasks/P012-content-guard.md) | P007 | — |

## Data

| Task | Depends on | External gate |
| --- | --- | --- |
| [P013 — Implement the Postgres connection and transaction layer](tasks/P013-database-pool.md) | P007 | — |
| [P014 — Generate and review the Better Auth schema](tasks/P014-auth-schema.md) | P007 | — |
| [P015 — Define tenants, memberships and freelancer profiles](tasks/P015-tenant-schema.md) | P007 | — |
| [P016 — Define campaigns and editable prompt versions](tasks/P016-campaign-schema.md) | P007 | — |
| [P017 — Define accounts, prospects, evidence and conversations](tasks/P017-lead-schema.md) | P007 | — |
| [P018 — Define actions, attempts, leases and event queues](tasks/P018-ledger-schema.md) | P007 | — |
| [P019 — Define billing, usage and audit records](tasks/P019-billing-schema.md) | P007 | — |
| [P020 — Integrate the initial Drizzle migrations](tasks/P020-migrations.md) | P013, P014, P015, P016, P017, P018, P019 | — |
| [P021 — Enforce tenant isolation and runtime database roles](tasks/P021-rls.md) | P020 | — |

## Repositories

| Task | Depends on | External gate |
| --- | --- | --- |
| [P022 — Implement membership and freelancer profile repositories](tasks/P022-tenant-store.md) | P021 | — |
| [P023 — Implement versioned campaign persistence](tasks/P023-campaign-store.md) | P021 | — |
| [P024 — Implement customer style and prompt version persistence](tasks/P024-style-store.md) | P021 | — |
| [P025 — Implement candidate, evidence and suppression persistence](tasks/P025-prospect-store.md) | P021, P011 | — |
| [P026 — Implement conversation history persistence and reads](tasks/P026-timeline-store.md) | P021 | — |
| [P027 — Implement immutable actions and send attempts](tasks/P027-ledger-store.md) | P021 | — |
| [P028 — Implement account leases and quota reservations](tasks/P028-lease-quota.md) | P021 | — |
| [P029 — Implement the inbox and transactional outbox](tasks/P029-event-store.md) | P021 | — |
| [P030 — Implement the atomic reply and manual-takeover transaction](tasks/P030-reply-stop.md) | P021, P027, P029 | — |
| [P031 — Implement subscription state and entitlement persistence](tasks/P031-billing-store.md) | P021, P029 | — |
| [P032 — Implement usage and audit persistence](tasks/P032-usage-store.md) | P021 | — |

## Adapters

| Task | Depends on | External gate |
| --- | --- | --- |
| [P033 — Implement Unipile connection and account status](tasks/P033-unipile-accounts.md) | P007 | — |
| [P034 — Implement Unipile people search and profile reads](tasks/P034-unipile-reads.md) | P007 | — |
| [P035 — Implement Unipile invitations, sends and history](tasks/P035-unipile-messages.md) | P007 | — |
| [P036 — Validate and normalize Unipile webhook payloads](tasks/P036-unipile-events.md) | P007 | — |
| [P037 — Implement the TypeSafe decision adapter](tasks/P037-typesafe.md) | P007 | — |
| [P038 — Implement the Claude writing adapter](tasks/P038-anthropic.md) | P007 | — |
| [P039 — Implement Stripe Checkout, Portal and subscription reads](tasks/P039-stripe-adapter.md) | P007 | — |
| [P040 — Implement the private R2 object adapter](tasks/P040-storage.md) | P007 | — |
| [P041 — Implement transactional authentication and handover email](tasks/P041-email.md) | P007 | — |
| [P042 — Implement structured logging and Sentry adapters](tasks/P042-observability.md) | P007 | — |

## Writing

| Task | Depends on | External gate |
| --- | --- | --- |
| [P043 — Port French defaults and message evaluation fixtures](tasks/P043-prompt-defaults.md) | P007 | — |
| [P044 — Compose grounded prompts with editable style precedence](tasks/P044-prompt-composer.md) | P043, P012 | — |
| [P045 — Infer an optional writing style from customer examples](tasks/P045-style-inference.md) | P044, P038, P024 | — |

## Authentication

| Task | Depends on | External gate |
| --- | --- | --- |
| [P046 — Implement Better Auth with Drizzle and auth mail](tasks/P046-auth-core.md) | P021, P041 | — |
| [P047 — Wire auth routes and the customer application shell](tasks/P047-auth-ui.md) | P046, P022 | — |

## Customer product

| Task | Depends on | External gate |
| --- | --- | --- |
| [P048 — Build authenticated Next Safe Action middleware](tasks/P048-command-auth.md) | P046, P022, P007 | — |
| [P049 — Implement onboarding and freelancer profile commands](tasks/P049-profile-commands.md) | P048, P022 | — |
| [P050 — Build the French onboarding and profile screens](tasks/P050-profile-ui.md) | P007 | — |
| [P051 — Implement LinkedIn connect, reconnect and pause commands](tasks/P051-account-commands.md) | P048, P033, P023 | — |
| [P052 — Build account status and reconnection screens](tasks/P052-account-ui.md) | P007 | — |
| [P053 — Implement campaign editing, activation and pause](tasks/P053-campaign-commands.md) | P048, P023, P010, P009 | — |
| [P054 — Build campaign setup and activation screens](tasks/P054-campaign-ui.md) | P007 | — |
| [P055 — Implement editable style, templates, preview and reset](tasks/P055-style-commands.md) | P048, P024, P044, P038, P012 | — |
| [P056 — Build the writing-style and message-template editor](tasks/P056-style-ui.md) | P007 | — |
| [P057 — Implement authorized pipeline filters and pagination](tasks/P057-pipeline-query.md) | P048, P025 | — |
| [P058 — Build the lead pipeline with nuqs filters](tasks/P058-pipeline-ui.md) | P007 | — |
| [P059 — Build the conversation timeline and handover view](tasks/P059-timeline-ui.md) | P007 | — |
| [P060 — Implement tenant billing Checkout and Portal commands](tasks/P060-billing-commands.md) | P048, P039, P031 | — |
| [P061 — Build subscription and billing-status screens](tasks/P061-billing-ui.md) | P007 | — |
| [P062 — Implement basic prospecting metrics queries](tasks/P062-metrics-query.md) | P048, P032 | — |
| [P063 — Build the customer metrics dashboard](tasks/P063-metrics-ui.md) | P007 | — |

## Automation

| Task | Depends on | External gate |
| --- | --- | --- |
| [P064 — Wire durable Unipile webhook ingestion](tasks/P064-unipile-webhook.md) | P036, P029, P030, P051 | — |
| [P065 — Wire verified Stripe webhooks and entitlement updates](tasks/P065-stripe-webhook.md) | P039, P031 | — |
| [P066 — Implement atomic send authorization](tasks/P066-authorization.md) | P009, P010, P023, P024, P028, P027, P030, P031 | — |
| [P067 — Implement the outbound dispatch Activity](tasks/P067-dispatch.md) | P066, P035, P042 | — |
| [P068 — Reconcile uncertain sends and expired in-flight attempts](tasks/P068-reconcile.md) | P027, P028, P035, P030 | — |
| [P069 — Deliver product events to Temporal and notifications](tasks/P069-outbox-delivery.md) | P029, P041, P042 | — |
| [P070 — Generate and persist versioned unsent drafts](tasks/P070-draft-generation.md) | P044, P038, P024, P027, P012, P032 | — |
| [P071 — Implement evidence-based prospect qualification](tasks/P071-qualification.md) | P037, P025, P032 | — |
| [P072 — Implement bounded discovery batch workflows](tasks/P072-discovery.md) | P034, P025, P071 | — |
| [P073 — Implement acceptance and account-history reconciliation](tasks/P073-account-sync.md) | P033, P035, P030, P068, P051 | — |
| [P074 — Implement the deterministic prospect sequence Workflow](tasks/P074-sequence.md) | P010, P067, P070, P068 | — |
| [P075 — Implement campaign scheduling and bounded account coordination](tasks/P075-scheduler.md) | P023, P072, P073, P074, P069 | — |
| [P076 — Wire worker entry points, registries and health checks](tasks/P076-worker-wiring.md) | P075, P045, P042 | — |

## Integration

| Task | Depends on | External gate |
| --- | --- | --- |
| [P077 — Connect completed feature screens to server functions](tasks/P077-product-wiring.md) | P047, P049, P050, P051, P052, P053, P054, P055, P056, P057, P058, P059, P026, P060, P061, P062, P063 | — |

## Public content

| Task | Depends on | External gate |
| --- | --- | --- |
| [P078 — Build the static Fumadocs application](tasks/P078-docs-app.md) | P007 | — |
| [P079 — Write French onboarding and handover help](tasks/P079-docs-content.md) | P078 | — |
| [P080 — Build the static marketing site with accurate product copy](tasks/P080-marketing.md) | P007 | — |

## Operations

| Task | Depends on | External gate |
| --- | --- | --- |
| [P081 — Create reproducible app, API and worker images](tasks/P081-docker.md) | P076, P077 | — |
| [P082 — Define the Render service topology and environment map](tasks/P082-render-config.md) | P081, P079, P080 | — |
| [P083 — Prepare Wrangler setup for private EU buckets](tasks/P083-r2-setup.md) | P007 | — |
| [P084 — Implement CI release and serialized migration procedures](tasks/P084-release.md) | P008, P082, P021, P083 | — |
| [P085 — Write outage, restore and account-recovery runbooks](tasks/P085-runbooks.md) | P082, P084, P042 | — |

## Migration

| Task | Depends on | External gate |
| --- | --- | --- |
| [P086 — Parse legacy exports into a validated import preview](tasks/P086-migration-parser.md) | P011, P007 | — |
| [P087 — Implement idempotent historical-data import](tasks/P087-migration-import.md) | P086, P022, P023, P024, P025, P026, P030, P031 | — |
| [P088 — Implement cutover checks and the rollback rehearsal](tasks/P088-cutover.md) | P087, P073, P075, P085 | — |

## Release evidence

| Task | Depends on | External gate |
| --- | --- | --- |
| [P089 — Prove live provider capabilities on enrolled test accounts](tasks/P089-provider-proof.md) | P033, P034, P035, P036, P037, P038, P039 | controlled-provider-access |
| [P090 — Verify reply races, crashes and uncertain delivery](tasks/P090-delivery-fault-tests.md) | P076, P064 | — |
| [P091 — Verify authentication, tenancy and billing isolation end to end](tasks/P091-tenant-billing-tests.md) | P077, P065, P021 | — |
| [P092 — Evaluate French qualification and writing quality](tasks/P092-quality-evaluation.md) | P071, P070, P045, P043 | model-evaluation-access |
| [P093 — Verify the complete customer journey in the browser](tasks/P093-product-e2e.md) | P077, P076, P064, P065, P079, P040 | — |
| [P094 — Run the controlled staging pilot and recovery drills](tasks/P094-pilot.md) | P089, P090, P091, P092, P093, P088, P084 | staging-pilot-authorized |
| [P095 — Calibrate costs and assemble the launch decision](tasks/P095-launch-evidence.md) | P094, P032, P085 | — |
