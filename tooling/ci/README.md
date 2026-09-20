# CI operator helpers

The workflow in `.github/workflows/ci.yml` runs on pull requests with read-only permissions. Use the event-based helper below when fresh PR evidence is required for pull requests that predate the workflow.

To refresh the five schema checks after the workflow lands, first run this dry run from the repository root with an authenticated `gh-axi` session:

```sh
bun tooling/ci/requeue-open-schema-checks.mjs
```

After reviewing the five printed URLs, add `--apply` to close and immediately reopen each one. The `reopened` event triggers the workflow and associates its checks with the pull request. The helper has a fixed allowlist, verifies that the workflow exists and each URL is still open, and requires the explicit `--apply` flag before changing PR state. It does not comment on, merge, or enable auto-merge for any pull request. If reopening fails, the helper retries once before stopping and prints the exact single-PR recovery command. Run that command before retrying the helper. See GitHub's [workflow event documentation](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows) for the pull-request event behavior.

The test job sets `DATABASE_TEST_ADMIN_URL` to its disposable Postgres service. `run-database-tests.mjs` runs the database and auth schema Vitest files explicitly because those packages intentionally have no package-local `test` scripts. Each database test process creates a unique database name and drops it after the test, so a missing service is an error in CI rather than a silent skip.
