# Next Safe Action — consistent customer commands

**Selected next-forge addon.** Use `next-safe-action` in `apps/app` to share input validation, authenticated context and form status/error handling across campaign controls and writing-style settings. Reuse the Zod version already used for application validation. [next-forge addon](https://www.next-forge.com/docs/addons/next-safe-action).

Create one application action client with middleware that verifies Better Auth's session and current tenant membership. Derive authorization context on the server. Each command then validates its input and invokes domain logic. Never accept a submitted tenant ID as proof of access.

Apply it to saving style preferences, updating offer/ICP settings, activating or pausing a campaign, and creating billing portal sessions. Keep outbound work asynchronous through the database/outbox. A repeated form submission must still be deduplicated by domain/database rules.

Webhook routes continue to use provider-specific authentication. Temporal Activities use their own execution context. This addon does not replace either path, guarantee idempotency, or enforce our reply-stop policy automatically.

Verify exact API syntax against the pinned library version; older template examples may differ. [Official documentation](https://next-safe-action.dev/).

No new workspace package or hosted service is needed for the initial action client. Check invalid input, expired sessions, cross-tenant attempts and repeat submissions. Its build/runtime work fits existing hosting allowances.
