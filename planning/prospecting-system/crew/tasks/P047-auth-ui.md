# P047 — Wire auth routes and the customer application shell

**Firstmate ID:** `pros-047` · **Kind:** ship · **Review:** critical · **Profile:** Luna / max / Fast

## Outcome

Customers enter an authenticated app with explicit tenant selection.

## Ready when

Dependencies accepted on the integration base: [P046](../tasks/P046-auth-core.md), [P022](../tasks/P022-tenant-store.md).

External gates: None; use fixtures/local services until live access is explicitly available.

Read [AGENTS.md](../../AGENTS.md), [architecture.md](../../architecture.md), [contracts.md](../contracts.md), [review-checklist.md](../review-checklist.md). Contract sections: C4.

## Write ownership

- `apps/app/app/api/auth/`
- `apps/app/app/(auth)/`
- `apps/app/app/layout.tsx`
- `apps/app/app/(app)/layout.tsx`
- `apps/app/components/navigation/`
- `apps/app/proxy.ts`
- `apps/app/middleware.ts`

Only these paths and adjacent tests inside these directories are in scope. Dependencies, root configuration, package exports, shared contracts, schema exports and migration journals are owned by their named integration tasks. If this task explicitly owns one of those surfaces, its declared write scope is the exception. Do not edit a sibling task's code to get a green build; report the exact missing contract/fix. All paths are relative to the future application repository.

## Build

1. Mount Better Auth routes/providers and adapt next-forge navigation to agreed feature routes.
2. Resolve membership on the server before rendering tenant data; retain correct empty/loading/error states.
3. Use the central design system; links to unfinished features stay hidden until the final wiring task.

## Acceptance evidence

- Unauthenticated access redirects safely and revoked sessions cannot reach tenant pages.
- Two tenants cannot switch context by editing a URL alone.
- Use the actual scoped commands recorded in `tooling/commands/README.md`. Include command, result and commit in the handoff. Do not invent passing output or count mocked checks as live provider proof.

## Boundaries and handoff

One focused review unit. Aim for roughly 150–400 changed logical lines where practical; generated scaffolds/migrations may be larger and must be labeled. If the behavior no longer fits one review, return a proposed split before expanding ownership. Avoid unrelated formatting or a new abstraction used by only a hypothetical future feature.

Ship tasks: one branch/worktree and one PR, with current-base checks and independent review. Crewmates do not merge. Scout tasks: one evidence report in the path assigned by Firstmate; no fake implementation commit. Missing credentials/authorization is an external gate, not permission to test on arbitrary accounts. Never trigger production sending or deployment from a code task.

Task completion output: behavior delivered; changed paths; commands/evidence; known limits; PR URL and commit for a ship, or report path for a scout; dependency/contract decisions. Leave any blocked acceptance criterion explicit.
