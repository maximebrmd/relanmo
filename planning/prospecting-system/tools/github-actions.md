# GitHub Actions — continuous integration and releases

**Status: recommended development service.** Reuse the existing GitHub repository/account setup. The research has not changed or published anything to GitHub.

## Repository layout

See the [next-forge guide](next-forge.md) for the authoritative workspace layout: `apps/app`, `apps/web`, `apps/api`, `apps/docs`, `apps/worker` and shared `@repo/*` packages. Keep tests near their owning packages plus a cross-application integration suite.


## Pipeline

1. Install the pinned Bun and Node.js versions on a standard Linux runner. Run `bun install --frozen-lockfile` from the root.
2. Run root Ultracite/Biome checks, strict TypeScript checks and focused Vitest suites under Node. A Bun package-manager choice does not change the test runtime.
3. Start a disposable Postgres database and verify schema migrations, isolation and concurrency invariants.
4. Run Temporal workflow tests and replay-compatible checks for orchestration changes.
5. Build separate customer-app/API/worker artifacts and the static marketing and Fumadocs documentation outputs and run Playwright against the staging/test application.
6. Deploy the same reviewed revision to staging, then production through the chosen release control. Run migrations once and preserve a known-good rollback build.

Provider tests in ordinary CI use synthetic fixtures. Keep separately scheduled or manually invoked contract tests for explicitly enrolled live pilot accounts. Forked or untrusted code must not receive production secrets or live sending credentials.

## Secrets and artifacts

Scope deployment credentials narrowly, use protected deployment environments where available in the existing GitHub plan, and pin critical external actions. Keep artifacts short-lived and redact screenshots/traces before storing them. Avoid uploading real inbox fixtures to the repository.

## Cost

The baseline assumes included standard-runner minutes and existing GitHub access. The free quota and overage rate used in the estimate are documented in [Actions billing](https://docs.github.com/en/billing/concepts/product-billing/github-actions). Excess minutes and artifact storage fit within the explicit CI/usage allowance until measured otherwise.

Paid organization features or developer seats are optional additions, not hidden requirements of the worker runtime. Docker image storage is also a cost driver if retained indefinitely; use retention rules and avoid duplicate large artifacts.

Keep database migrations and live-provider tests uncached in Turborepo. Preview databases use synthetic or sanitized records and no production sending credentials; never branch live authentication sessions into publicly accessible preview apps.

Review every new direct dependency against [the dependency policy](../dependency-policy.md) before installation. Include the documentation source and reason in the PR. Validate docs links and static search, and ensure public MDX/search indexes contain no customer records or private prompt settings.
