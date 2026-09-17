# Vitest — business logic and integration tests

**Status: recommended test runner.** It runs in development and CI, not as an always-on production service. [Vitest guide](https://vitest.dev/guide/).

## Tests that matter for this product

- First incoming text or attachment message stops a sequence regardless of classification.
- Duplicate/out-of-order events do not resurrect automation or duplicate a notification.
- Unmatched manual outbound activity triggers takeover after bot-echo reconciliation.
- A past reply blocks a new campaign for the same account/prospect until explicitly re-enrolled.
- A send timeout followed by a worker retry enters reconciliation rather than an unconditional resend.
- France business windows and daylight-saving transitions produce correct due times; delayed steps retain minimum gaps.
- Import preserves original IDs, reply state, exclusions and completed steps.
- Tenant A cannot access or schedule work for Tenant B's provider account.

## Setup

1. Put deterministic domain tests beside their modules. Inject clocks and provider adapters where necessary.
2. Use a disposable real Postgres instance for locking, unique constraints, tenant roles and transactional-outbox behaviour. An in-memory mock cannot verify these properties.
3. Use Temporal's testing facilities for workflows and time skipping, with activity mocks for most provider calls.
4. Keep synthetic/redacted provider fixtures that represent actual payload shapes established during the integration spike.
5. Separate deterministic tests from paid live-model evaluations. Version the French evaluation set and record model/prompt versions alongside results.

## Release interpretation

Passing tests demonstrates the behaviours covered by those tests. It does not prove LinkedIn availability, model quality in every case or exactly-once external delivery. Add regression cases when production incidents reveal a missing failure mode.

## Cost

No separate service subscription is needed. CI minutes, temporary test databases and occasional live API evaluations are the costs. The baseline includes CI allowance; the launch budget includes extra evaluation spend.
