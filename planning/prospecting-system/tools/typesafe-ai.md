# TypeSafe AI — structured prospect decisions

**Status: connector adapter implemented; live use remains subject to an early-access production gate.** It supplies repeated bounded decisions. Our code controls side effects. [Architecture](../architecture.md) · [Costs](../cost-estimate.md).

## What to ask it

| Decision | Proposed representation | Product use |
| --- | --- | --- |
| Is this person in the freelancer's ICP? | Choice: suitable / unsuitable / insufficient evidence | Filter candidates |
| What kind of contact is this? | Choice: decision-maker / recruiter / ESN / other / unknown | Select the appropriate sequence |
| Which verified offer fits? | Choice over existing offer IDs plus none | Keep outreach relevant |
| Which observed signal is relevant? | Choice over evidence IDs plus none | Choose a factual opener |
| Does this draft claim more than its evidence supports? | Choice per proposed claim | Reject invented specificity |
| How strongly does the evidence support a ranking criterion? | Score or Noul, according to the task | Rank suitable prospects |

These are application schema proposals, not a promise of model accuracy. Jev does not generate arbitrary message strings; use a writing model for that part. [TypeSafe's system-one design guidance](https://docs.typesafe.ai/concepts/how-to-build-with-system-one), [primitives](https://docs.typesafe.ai/primitives).

## Implementation steps

1. Confirm API access, commercial terms, capacity and data handling. Store `TYPESAFE_API_KEY` only in the worker environment. Pin the evaluated SDK/model version.
2. Use [`createTypeSafeDecisionPort`](../../../packages/connectors/src/typesafe/decision-port.ts) from the connector package. It keeps vendor answer types inside the adapter and exposes versioned domain results through the shared provider contract.
3. Normalize candidate data from source records. Include only relevant skills, role, company facts, location, customer offer and selected evidence. External profile text is data; it must not override product instructions.
4. Batch independent questions against the same state where appropriate. The batch owns the request usage once; individual decisions do not each repeat it. Make dependent decisions only after their inputs exist—for example, select evidence after the offer is selected. [Fan-out pattern](https://docs.typesafe.ai/patterns/fan-out).
5. Callers persist the answer, prompt/schema version, reported model, evidence IDs, batch or single-decision usage and evaluation metadata. Cache by source-content hash, offer version and decision schema version.
6. Route weak or conflicting evidence to skip/hold or a neutral template. Do not create a per-message customer approval bottleneck.
7. Run the drafted claims through a separate evidence check. Verify deterministic facts such as exact numbers, names and dates in code as well.

## Evaluation and exceptions

Measure precision and recall against labelled French examples. Test recruiters, ESNs, irrelevant job ads, stale funding news, multilingual profiles and missing fields. Use a held-out set after tuning thresholds.

Confidence for Choice/Score is not automatically the probability that our business decision is correct. Noul values are a distinct primitive and should not be treated as calibrated confidence. Calibrate routing against observed errors. [Confidence documentation](https://docs.typesafe.ai/confidence).

If TypeSafe is unavailable, defer new qualification and drafting. Continue receiving replies and stopping campaigns in ordinary code. A replacement model is possible behind the adapter, but only after evaluating its outputs and revising the budget.

## Cost controls

The model budgets about $0.33/customer/month for qualification plus draft checks at the defined workload, including extra usage. This small estimate follows the published early-access unit rate; it is not the cost of running the whole bot. [Published pricing and early-access announcement](https://typesafe.ai/blog/introducing-system-one-models-and-jev).

Track cumulative input across every request. Avoid repeatedly attaching a full profile or conversation when a small evidence record suffices. Keep first-reply stopping, quota enforcement, account ownership and send authorization outside this service.

## Required SDK integration

Use the official `@typesafe-ai/sdk` package behind the shared connector adapter. Bun installs it; Node runs it inside Temporal Activities. Pin the evaluated release and inspect its timeout/retry behaviour. Follow the [SDK policy](../sdk-policy.md) for narrow typed fallbacks when a documented endpoint is absent. [Official SDK source](https://docs.typesafe.ai/sdk/javascript).
