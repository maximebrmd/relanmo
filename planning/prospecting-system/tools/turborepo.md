# Turborepo — workspace task coordination

**Status: part of the required next-forge monorepository.** Bun installs workspace dependencies; Turborepo orders and caches repository tasks. They serve different purposes. [Repository structure](https://turborepo.com/docs/crafting-your-repository/structuring-a-repository).

Define `build`, `typecheck`, `test` and development tasks in `turbo.json`. Make builds depend on required package builds, declare generated output directories, and include relevant configuration/environment inputs in cache keys. Use package exports and `workspace:*` dependencies instead of reaching into another package's private files.

Run formatting checks once at the repository root. Each package owns its TypeScript and test scope; avoid a root script recursively invoking itself through Turbo. Mark long-running development tasks persistent and uncached. Database migrations, live provider tests and deployment commands must never reuse cached execution results.

Keep production secrets out of build artifacts and caches. Pin the Bun version in `packageManager`, keep the lockfile, and test the worker's dependency closure in its actual Docker image. A cached dashboard build says nothing about native Temporal worker compatibility.

Local caching is sufficient initially. Remote caching is optional and excluded from the cost baseline. Verify a clean build and a cached repeat produce the same artifact before trusting cache reuse. [Caching guidance](https://turborepo.com/docs/crafting-your-repository/caching).
