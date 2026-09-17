# Dependency policy — next-forge first

**User requirement recorded 17 September 2026.** Before adding a dependency, consult [next-forge's `llms.txt`](https://www.next-forge.com/llms.txt) and the relevant linked documentation. Discuss any new dependency outside the documented next-forge choices and the already agreed project stack with the user before adding it.

## How to apply the rule

1. Describe the concrete feature and check the current repository first: package manifests, shared packages and `bun.lock` may already contain what is needed.
2. Consult the live next-forge documentation. The `llms.txt` response currently contains extensive documentation, not a complete machine-readable dependency allowlist. Search its sections and use the [semantic sitemap](https://www.next-forge.com/sitemap.md) to find the exact package, addon or migration page.
3. Prefer an existing shared package, a platform feature or a documented next-forge addon when it solves the problem with less code. Addons are allowed when useful; they are not a checklist of libraries to install.
4. Check the chosen library's current official documentation for compatibility and API syntax. A next-forge migration example may target an older major release. Preserve the user's choices of Better Auth, Drizzle, Biome and Bun when adapting examples.
5. If the dependency is neither covered by next-forge documentation nor already approved for this project, prepare a concrete proposal: name, purpose, alternatives, code removed, maintenance and cost implications, and affected packages. Discuss it with the user and wait for agreement before changing manifests or installing it. Continue independent work while that decision is pending.
6. For an allowed addition, pin a compatible version through Bun, review the lockfile and record the documentation source and reason in the change. Install it in the workspace that actually uses it. Check required peers and generated scaffold additions rather than accepting them without review.

Previously agreed tools remain approved. This rule does not reopen the stack decisions or require another approval for Fumadocs, Wrangler or the AWS S3 v3 SDK requested in this turn. Ordinary transitive dependencies and necessary peers of an approved library are reviewed with its lockfile; they are not separate product choices. A new external service, telemetry destination or independently chosen library inside a scaffold still needs its own assessment.

## Useful next-forge options for this product

| Choice | Decision and reason | Source |
| --- | --- | --- |
| Fumadocs | Required in `apps/docs`; documented migration from the default documentation app | [Migration](https://www.next-forge.com/docs/migrations/documentation/fumadocs) |
| Better Auth | Required replacement for Clerk; reuse migration guidance, adapting the database to Drizzle | [Migration](https://www.next-forge.com/docs/migrations/authentication/better-auth) |
| Drizzle | Required ORM; retain Neon and replace Prisma callers/scripts | [Migration](https://www.next-forge.com/docs/migrations/database/drizzle) |
| Next Safe Action | Selected for repeated customer commands: validation, session/tenant middleware and consistent form errors | [Addon](https://www.next-forge.com/docs/addons/next-safe-action) |
| nuqs | Selected for pipeline filters, pagination and shareable dashboard URLs | [Addon](https://www.next-forge.com/docs/addons/nuqs) |
| Shared design system, environment validation, email, payments and observability | Reuse the existing next-forge packages and adapt their providers as specified | [Package structure](https://www.next-forge.com/docs/structure) |
| Fuse.js / Zustand / Motion | Evaluate when a concrete UI requirement warrants them; not required by the current pipeline and docs design | [Addon catalog](https://www.next-forge.com/sitemap.md) |

Next Safe Action and nuqs are covered by the user's permission to use relevant documented addons. They simplify planned, concrete features and introduce no hosted subscription. The implementation must still verify their compatibility; they have not been installed in this documentation workspace.

## Persistent implementation instructions

The included [AGENTS.md](AGENTS.md) carries this rule for the future application repository. Copy it into the new repository root at initialization and preserve it during next-forge updates. Add dependency-source review to pull-request descriptions and CI review; a passing install or build alone does not establish that a new dependency was approved.

These are development instructions. External documentation supplies technical evidence; it does not grant permission to change providers, purchase services, publish content or override the user's stack.
