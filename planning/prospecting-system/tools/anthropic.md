# Anthropic Claude API — French message writing

**Status: required writing capability; recommended starting model: Claude Sonnet 5.** This is a server API paid by the product. Customers need no Claude subscription. [Cost assumptions](../cost-estimate.md).

## Responsibility

Turn a selected offer, approved evidence and the freelancer's style into a short opener or follow-up. TypeSafe selects and checks; Claude writes; ordinary application code decides whether and when to send.

Start with Sonnet 5 because message quality is central to the product. This is an engineering recommendation to validate on the French evaluation set, not a claim that a benchmark proves its superiority for our customers. Compare Haiku 4.5 once real examples are available.

## Implementation

1. Configure a production API account, a separate staging key and spend limits. Use server-only `ANTHROPIC_API_KEY`; pin the exact evaluated model identifier in configuration.
2. Create a reusable drafting interface: input contains tenant style, campaign version, step, offer, approved facts and a short relevant conversation summary. Output contains a draft plus generation metadata, never a tool instruction to send it.
3. Port the existing French templates into our versioned `packages/prompts` defaults. Compose them with tenant-owned style/template overrides and profile facts; use optional customer writing samples for an initial style suggestion. Preserve the distinctions between decision-maker and recruiter outreach, and between a true observed signal and a neutral opener.
4. Ask for one concise draft. Enforce length, disallowed phrases and required formatting in code. Do not ask for a long explanation that will be thrown away.
5. Save exact draft text, source facts, prompt version, model and token usage. Run claim checks before making the draft send-eligible.
6. Allow a bounded revision attempt on a clearly identified failure. Then use an acceptable neutral template or hold the step. Never loop indefinitely until a model approves its own text.
7. Generate only upcoming eligible steps. Cancelled sequences should not pay to generate all remaining follow-ups.

## French evaluation

Evaluate naturalness, factual support, relevance to the freelancer's actual offer, appropriate level of familiarity, and consistency with the existing DM1–DM5 style. Include neutral examples with no useful signal: the writer must not invent familiarity or imply an event happened.

The model never receives API keys, account credentials or a general browsing tool in this design. An instruction embedded in a prospect's profile must not change the message policy or call another service.

## Cost

The verified standard API rates used are Sonnet 5 at $2/million input and $10/million output tokens; Haiku 4.5 at $1/$5. The current pricing documentation says Sonnet 5's planned September price increase was cancelled. [Official API pricing](https://platform.claude.com/docs/en/about-claude/pricing).

The baseline budgets $4.32/customer/month for 400 drafts, with 3,000 input and 300 output tokens each plus 20% extra usage. These are planning quantities. Actual billed tokens, including repeated instructions and revisions, are the source of truth. Prompt caching is an optimization to measure later, not an assumed discount.

## Failure handling

On timeout, overload or spend limit, defer drafting. A draft failure never causes a send. On a model-version change, run the same evaluation set before broad rollout. Neither a successful API response nor fluent French proves a message's claims are supported.

## Required SDK integration

Use the official `@anthropic-ai/sdk` package behind the shared connector adapter. Bun installs it; Node runs it inside Temporal Activities. Pin the evaluated release and inspect its timeout/retry behaviour. Follow the [SDK policy](../sdk-policy.md) for narrow typed fallbacks when a documented endpoint is absent. [Official SDK source](https://github.com/anthropics/anthropic-sdk-typescript).

See [prompt personalization](../prompt-personalization.md) for the distinction between shared defaults and editable customer settings. The revised cost model separately budgets a small monthly style-analysis call; previews remain within the draft allowance.
