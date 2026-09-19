# CI operator helpers

The workflow in `.github/workflows/ci.yml` runs on pull requests with read-only permissions. It also exposes a manual `workflow_dispatch` input for one-off diagnostics. A manual run checks out the selected pull request's head commit and uses the same dependency install, lint, typecheck, build, and test jobs; it does not receive production secrets or write permissions. GitHub does not associate a manual run with a pull request's Checks section, so use the event-based helper below when fresh PR evidence is required.

To refresh the five schema checks after the workflow lands, first run this dry run from the repository root with an authenticated `gh-axi` session:

```sh
bun tooling/ci/requeue-open-schema-checks.mjs
```

After reviewing the five printed URLs, add `--apply` to close and immediately reopen each one. The `reopened` event triggers the workflow and associates its checks with the pull request. The helper has a fixed allowlist, verifies that the workflow exists and each URL is still open, and requires the explicit `--apply` flag before changing PR state. It does not comment on, merge, or enable auto-merge for any pull request. If a reopen operation fails, retry that URL before moving on. See GitHub's [workflow event documentation](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows) for the pull-request event and manual-dispatch association behavior.

The test job sets `DATABASE_TEST_ADMIN_URL` to its disposable Postgres service. `run-database-tests.mjs` runs the database/schema Vitest files explicitly because the current database package intentionally has no package-local `test` script. Each database test process creates a unique database name and drops it after the test, so a missing service is an error in CI rather than a silent skip.
