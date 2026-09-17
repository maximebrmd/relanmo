# Node.js — server and worker runtime

**Status: required runtime.** Start with Node.js 24 LTS and pin a tested patch release. The official release table currently marks 24 as LTS. [Node.js release policy](https://nodejs.org/en/about/previous-releases).

## What runs here

The Next.js server, Temporal workers, vendor adapters, database access and import/maintenance commands all run in Node.js. A single language/runtime keeps shared domain rules consistent across web and worker processes. Python services are not required for this design.

## Setup

1. Pin the same runtime family in local development, CI and Docker images. Verify Temporal, TypeSafe and other SDK compatibility in the integration spike.
2. Use next-forge with separate app, API and worker entry points. Bun manages dependencies and scripts; explicit `node` entry points run production code. Workers have no public customer HTTP surface except any platform-required health mechanism.
3. Use explicit timeouts and bounded concurrency for network requests. Account-scoped outbound serialization belongs in persistent shared state, not just an in-memory JavaScript queue.
4. Use small database pools per process; count the sum across replicas. Close pools and stop accepting new work on shutdown.
5. Handle `SIGTERM` by draining supported worker activities within the deployment grace period. Persist uncertain sends for reconciliation if a process cannot finish cleanly.
6. Emit structured logs containing correlation IDs and statuses. Redact message bodies, tokens, authentication links and customer credentials.

## Reliability checks

Restart a worker during a long wait and during an external call. Verify the database/Temporal recovery paths. Measure heap use and queue age while processing a realistic batch. Async I/O still consumes memory and connections; unlimited concurrency is not free throughput.

Keep UTC instants in storage and perform customer scheduling with explicit `Europe/Paris` rules. The host machine's timezone must not determine when a French campaign sends.

## Cost

Node.js has no runtime subscription in this plan. Its CPU and memory are included in Render's web/worker line. Upgrade instance size based on measured memory and scheduling latency, not simply on customer count.
