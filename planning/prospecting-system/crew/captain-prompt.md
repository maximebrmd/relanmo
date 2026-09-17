# Prompt to give Firstmate

Use this after cloning/registering the public repository https://github.com/maximebrmd/relanmo with Firstmate. Its planning pack is already at `planning/prospecting-system/`. This prompt is for the future coding run; preparing the repository has not launched that run.

```text
Implement Relanmo, the French freelance prospecting SaaS, in the existing public repository https://github.com/maximebrmd/relanmo. The project name is relanmo. Read the specification in planning/prospecting-system; preserve the initial Git history, planning and brand assets. Do not create a second repository.

Use GPT-5.6-Luna with max reasoning and Fast mode for implementation crewmates and independent reviewers. Use the Codex CLI harness with a supported Firstmate backend. Check the actual child model/effort and /fast status before scaling out. Do not silently substitute another model or reduce reasoning.

Start by reading README.md, brand/README.md, architecture.md, dependency-policy.md, AGENTS.md, crew/README.md, crew/contracts.md, crew/review-checklist.md and crew/tasks.json under that pack. The task index and individual cards are the implementation backlog. Preserve the user's required stack: next-forge, Neon PostgreSQL, Better Auth, Drizzle, Stripe, Ultracite + Biome, Bun package management, Node production runtimes, Fumadocs in apps/docs, Temporal, Unipile, TypeSafe and official TypeScript-compatible SDKs. R2 uses AWS SDK v3 at runtime and Wrangler for setup.

Before any new dependency, consult next-forge's live llms.txt and the relevant docs. Reuse our existing stack and documented addons when they simplify a real feature. Discuss a dependency outside next-forge's documented choices and our already agreed stack with me before changing manifests or installing it. Continue unrelated tasks while waiting.

Translate the planning manifest into your native backlog/brief workflow. Do not treat tasks.json as a supported native import format. For each task, generate your current native brief and fill it from the task card, keeping actual captain intent distinct from implementation recommendations. Honor existing project delivery requirements. The proposed default is direct-PR with independent review, CI and yolo off; do not merge without the configured captain authority.

Begin with P001, then P002 and P003. Once P003 is merged, run P004, P005 and P006 independently; P007 integrates their exports and approved dependencies. Then select ready tasks from the dependency graph. Start with at most three implementation crewmates plus one reviewer, increasing only when review capacity supports it. One isolated worktree, one focused task, one PR. Keep generated scaffolding separate in review. Aim for small, coherent patches; split a task if it grows beyond one reviewable behavior.

Only dispatch work whose dependency results are accepted on the integration base and whose write paths are unclaimed. Assign one integration crewmate to manifests, bun.lock, shared contracts/exports and migration journals. Schema fragments may run in parallel; generated migration integration stays serial. If a crewmate needs an unassigned shared change, create a small integration task instead of letting multiple agents edit the same file. Review current commits independently and return fixes to the owning crewmate.

Preserve the central behavior: bounded invitations/DM1–DM5, France business windows, autonomous sending until the first incoming message, then human replies. Any incoming message including attachment-only must persist human ownership before model classification. Manual owner messages also stop automation after checking bot echoes. Never blindly retry an ambiguous external send. Human ownership, authorization, quota, billing entitlement and draft versions are database/code controls, not model decisions.

Use fixture/local verification for ordinary coding. Live provider tests require named authorized test accounts and controlled recipients. Track the external gates in the manifest; do not invent credentials, mock a passing live proof or let one missing credential block unrelated coding. Do not send production prospecting messages, provision paid services, publish a deployment, create a GitHub repository or migrate real customers merely because a code task is complete. Bring me a concrete reviewable release/cutover result when that boundary is reached.

Keep me informed about reviewed/merged tasks, ready parallel work, actual blockers and any decisions I need to make. Completion means acceptance evidence and a reviewed merged commit, or an accepted scout report—not merely code written or a PR opened.
```
