# Small-PR review and integration contract

One task delivers one observable behavior or one evidence report. A task being coded, a PR being opened, checks passing and a dependency being available on the integration branch are different states. Only reviewed, accepted results unblock dependent tasks.

## Before dispatch

1. Read the exact task and relevant contract/tool docs; verify the task's dependency commits are on the integration base. Scout dependencies need an accepted evidence report instead of a commit.
2. Resolve model `gpt-5.6-luna`, reasoning `max` and Fast mode on the installed Codex CLI. Check the actual child, not just the parent settings.
3. Allocate an isolated worktree and unclaimed paths. Give tests unique database names, ports and queues. No production credentials are needed for normal code tasks.
4. Check external gates only for the task that needs them. A missing TypeSafe key need not block Fumadocs or fixture-based UI work.
5. Use actual commands from the bootstrap task; if new dependencies are required, follow the next-forge discussion rule before changing manifests.

## Before requesting review

- Keep the patch about the stated behavior, usually 150–400 logical lines where practical. This is a review target, not an incentive to hide necessary checks or split tightly coupled invariants incorrectly. Generated next-forge output and migration SQL are identified separately.
- Compare changed paths with the brief. Do not edit global AGENTS.md, bun.lock, manifests, barrel exports or migration journals unless assigned that surface. Route useful global knowledge and integration changes back to their owner.
- Explain the concrete before/after behavior, important design choice and acceptance evidence. Name untested live operations explicitly. Avoid an implementation diary.
- Run scoped lint/typecheck/tests plus affected build checks. Use risk-focused tests for tenant boundaries, retries, reply races and scheduling; a trivial text/docs edit needs a build/link/visual check rather than a test that repeats the implementation.
- State whether any dependency was added and cite next-forge/current official documentation or prior agreement. A fresh new vendor or unlisted dependency needs the captain's agreement.

## Independent review

Use a separate reviewer context from the implementation crewmate, with the same requested Luna/max/Fast profile unless the captain chooses otherwise. Read the spec and diff, inspect the relevant callers and challenge the behavior. Re-running green tests alone is not review. The reviewer reports blocking findings with concrete reproduction and does not silently modify another task's worktree. Return fixes to its owner.

For critical tasks, examine the actual transaction/authorization paths and adversarial cases: reply vs authorization, two worker replicas, unknown outcome, lost lease, duplicate events, stale drafts, cross-tenant access and entitlement removal. A fake repository cannot establish database race correctness.

For UI, inspect the normal, empty, loading, error and unauthorized states in the browser. For public docs, check static navigation/search and that private source content is absent. No screenshot may stand in for a functional server authorization check.

## Merge sequence

The initial recommendation is one PR at a time, with captain review/merge authority retained (`yolo=off`). Autonomous coding does not imply autonomous merging or production launch. If the captain later authorizes merges, preserve this same review sequence.

1. Rebase/update onto the current integration base after predecessor merges; regenerate migrations only in the migration lane.
2. Resolve conflicts in the task's own worktree and obtain review again for materially changed code.
3. Run required checks on the current candidate commit; a green earlier commit is not evidence for a changed one.
4. Record merged SHA, PR/review reference and check evidence in the handoff. Only then release dependent tasks.
5. Keep a separate, initially single review slot. Start with three implementation crewmates and one reviewer; increase only while review latency and conflict rate remain manageable. This is our operating recommendation, not a claimed Firstmate concurrency setting.

## Handoff format

```text
Task: Pxxx / pros-xxx
Behavior delivered:
Changed paths:
Acceptance commands and results:
Dependency/contract changes:
Remaining limitations or external checks:
PR URL + commit, or accepted scout report:
Reviewer decision:
```

The Firstmate status/report/PR lifecycle comes from its generated brief. These fields supplement that lifecycle; they do not replace its native status files or authorize writing fake completion records.
