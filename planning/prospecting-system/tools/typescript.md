# TypeScript — domain contracts

**Status: required implementation language.** Use it in the web application, workers and shared packages. It is distinct from **TypeSafe AI**, the model API.

## Design

Define explicit types for campaign status, account health, message direction, action state and human ownership. A qualified prospect is not automatically an authorized send. Make these separate records and functions so a model result cannot accidentally be passed straight to a sender.

Example of an internal application contract—not a provider API:

```typescript
type ActionState = 'READY' | 'IN_FLIGHT' | 'CONFIRMED' | 'FAILED' | 'UNKNOWN';
type Ownership = 'AUTOMATED' | 'HUMAN_OWNED';
type MessageDirection = 'INBOUND' | 'BOT_OUTBOUND' | 'OWNER_OUTBOUND';

type DraftCandidate = {
  tenantId: string;
  prospectId: string;
  campaignVersion: string;
  step: number;
  body: string;
  evidenceIds: string[];
};
```

## Implementation

1. Enable strict compiler checks and run type checking in CI.
2. Parse external JSON with runtime validators before turning it into domain data. TypeScript types disappear at runtime; a type assertion does not validate a webhook. [TypeScript basics](https://www.typescriptlang.org/docs/handbook/2/basic-types.html).
3. Keep domain contracts vendor-independent. Translate Unipile/TypeSafe/Claude responses in dedicated adapters.
4. Make status transitions explicit and exhaustive. Unexpected provider values should produce a recoverable exception, not default to “active”.
5. Share date/window calculation and eligibility logic between workers and the UI, while keeping final authorization server-side.
6. Version persisted payloads. Deployed workers may read jobs created by an earlier release.

## Verification and cost

Compile-time checks catch mismatched interfaces; integration tests verify actual provider behaviour and permissions. A well-typed program can still send the wrong message if its business logic is wrong.

No separate language subscription is included. Compiler work consumes CI/build minutes already accounted for in the cost model.

Official TypeScript-compatible vendor SDKs are required where available; see the [SDK policy and package matrix](../sdk-policy.md). Run strict `tsc --noEmit` checks separately from Ultracite/Oxlint/Oxfmt formatting and linting.
