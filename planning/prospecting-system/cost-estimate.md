# Hosting and operating cost estimate

**Specification revised 17 September 2026 · tariff inputs checked 16 September 2026 · EUR · VAT excluded · developer labour €0.**

Updated for Neon, Better Auth, Drizzle, next-forge, required Stripe, Ultracite/Biome, Bun, Fumadocs and Wrangler. Static docs and the selected next-forge addons add no fixed service fee; a small style-analysis allowance is included in AI usage. My recommendation is to allocate **about €500/month for a ten-customer pilot**, including a separate staging environment. For the stated workload, plan approximately **€1,700/month at 100 connected customers**, **€6,900 at 500**, and **€13,600 at 1,000**. These budgets include a 20% reserve and upward rounding. Payment processing is shown separately below.

The initial cash budget for building and running a two-month, ten-customer pilot is approximately **€1,000–€1,300**, assuming free developers. Most of this is subscriptions and usage during the pilot, not a one-time software licence.

## What these numbers mean

- One customer has one connected LinkedIn identity. Dedicated additional test identities must be added to the connector account count; staging normally uses fixtures. All counted customers use the workload below; unconnected sign-ups do not incur the same connector or AI cost.
- USD services are converted at an editable **budgeting assumption of $1 = €1**. This is not a live exchange rate. Unipile uses its EUR tariff directly.
- Vendor unit prices are sourced; workload, replica counts, capacity, monitoring allowance and contingency are engineering estimates. None has been benchmarked on the proposed application.
- The model includes production, a small permanent staging environment, database backups, notification email, monitoring, and an allowance for bandwidth, storage and CI overages.
- No promotional credits, annual discounts, prompt caching discounts or free trials reduce the baseline. This is useful after introductory offers expire.
- “24/7” assumes paid services that remain available and durable scheduling. This budget does not purchase an end-to-end uptime guarantee or a staffed support team.

## Monthly breakdown

The cents make the arithmetic auditable; they do not imply that future invoices will match to the cent.

| Monthly item | 10 customers | 50 | 100 | 500 | 1,000 |
| --- | ---: | ---: | ---: | ---: | ---: |
| Unipile | €49.00 | €250.00 | €400.00 | €2,000.00 | €4,000.00 |
| Render: app, API, workers, staging, workspace | €139.00 | €139.00 | €214.00 | €334.00 | €624.00 |
| Neon: compute, database storage and restore history | €25.93 | €27.88 | €51.32 | €111.26 | €217.89 |
| R2 private storage allowance | €5.00 | €5.00 | €5.00 | €10.00 | €20.00 |
| TypeSafe AI | €3.33 | €16.63 | €33.26 | €166.32 | €332.64 |
| Claude Sonnet 5 | €43.34 | €216.72 | €433.44 | €2,167.20 | €4,334.40 |
| Temporal, including support and history | €14.79 | €73.97 | €147.94 | €739.71 | €1,479.42 |
| Resend | €20.00 | €20.00 | €20.00 | €20.00 | €20.00 |
| Sentry allowance | €30.00 | €30.00 | €30.00 | €60.00 | €100.00 |
| Bandwidth and CI allowance | €10.00 | €15.00 | €25.00 | €75.00 | €150.00 |
| Domain/DNS allowance | €2.00 | €2.00 | €2.00 | €2.00 | €2.00 |
| **Estimated recurring total** | €342.39 | €796.20 | €1,361.97 | €5,685.49 | €11,280.35 |
| **Total with 20% reserve** | €410.87 | €955.44 | €1,634.36 | €6,822.59 | €13,536.42 |
| **Recommended rounded monthly budget** | €500 | €1,000 | €1,700 | €6,900 | €13,600 |
| Budget/customer, before upward rounding | €41.09 | €19.11 | €16.34 | €13.65 | €13.54 |

At 100 customers, the application hosting line is **€214/month**. The full system is more expensive because it also pays for LinkedIn connections, generated text, workflows, database recovery and operational services. Customer laptops and customer Claude subscriptions contribute **€0** to this architecture.

## Verified rates used

| Service | Published rate used | Evidence |
| --- | --- | --- |
| Unipile | €49 total up to 10 accounts; €5/account for 11–50; €4/account for 51–1,000 | [Current pricing table](https://www.unipile.com/pricing-api/) |
| TypeSafe Jev | $0.042 per million input tokens; output tokens free | [Launch pricing](https://typesafe.ai/blog/introducing-system-one-models-and-jev) |
| Claude Sonnet 5 | $2/million input tokens; $10/million output tokens | [Claude API pricing](https://platform.claude.com/docs/en/about-claude/pricing) |
| Claude Haiku 4.5, optional replacement | $1/million input; $5/million output | [Claude API pricing](https://platform.claude.com/docs/en/about-claude/pricing) |
| Temporal Cloud Developer | $50/million actions; active history $0.042/GB-hour; retained history $0.00105/GB-hour; 10% support charge; no base fee | [Temporal pricing details](https://docs.temporal.io/cloud/pricing) |
| Render | Pro workspace $25/month; services at $7 for 512 MB, $25 for 2 GB/1 CPU, $85 for 4 GB/2 CPU | [Compute pricing](https://render.com/pricing), [workspace plans](https://render.com/docs/new-workspace-plans) |
| Neon Launch | $0.106/CU-hour; database $0.35/GB-month; restore history $0.20/GB-month; no fixed monthly minimum | [Official pricing](https://neon.com/pricing.md) |
| R2 | Standard $0.015/GB-month, Class A $4.50/million, Class B $0.36/million; model uses a $5–$20 allowance | [R2 pricing](https://developers.cloudflare.com/r2/pricing/) |
| Resend | Pro $20/month for 50,000 transactional emails | [Resend pricing](https://resend.com/pricing) |
| Sentry | Team displayed from $26/month; model budgets $30 initially, then more for usage | [Sentry pricing](https://sentry.io/pricing/) |
| GitHub Actions | Free plan includes 2,000 minutes/month; standard Linux 2-core overage $0.006/minute | [Actions billing](https://docs.github.com/en/billing/concepts/product-billing/github-actions) |

**Unipile pricing discrepancy:** its current table lists €4/account at 51–200, but a nearby 60-account example still uses €4.50. This model uses the explicit tier table. Confirm the actual tariff at checkout or in a written quote. At 100 accounts, €4.50 instead of €4 would add €50/month before reserve. Billing follows the peak simultaneously linked account count, so disconnecting an account is not necessarily the same as removing it from billing. [Unipile pricing FAQ](https://www.unipile.com/pricing-api/).

TypeSafe's figure is published early-access pricing, not a negotiated production contract. Confirm access and commercial terms. The Sentry amounts are budget allowances; confirm billing cadence and event quotas before committing. No paid AI debugging add-on is included.

## AI workload and calculation

These are **cost modelling quantities**, not promised lead volumes or permitted LinkedIn quotas. Drafts include variants and unsent revisions; 400 generated drafts does not mean 400 messages are sent.

| Per connected customer per month | Base assumption |
| --- | ---: |
| Candidate profiles processed | 1,000 |
| TypeSafe billed input across all qualification/selection calls per candidate | 6,000 tokens |
| Generated message drafts | 400 |
| Claude input per draft | 3,000 tokens |
| Claude output per draft | 300 tokens |
| TypeSafe validation input per draft | 1,500 tokens |
| Style analysis calls | 1 |
| Claude tokens per style analysis | 4,000 input + 400 output |
| Additional AI allowance for retries and revisions | 20% |

```text
TypeSafe = ((1,000 × 6,000) + (400 × 1,500)) / 1,000,000
           × $0.042 × 1.20
         = $0.33264 per customer/month

Drafting = 400 × ((3,000 × $2) + (300 × $10)) / 1,000,000 × 1.20
         = $4.32 per customer/month

Style    = ((4,000 × $2) + (400 × $10)) / 1,000,000 × 1.20
         = $0.0144 per customer/month

Claude total = $4.3344 per customer/month
Total AI     = $4.66704 per customer/month
```

Style analysis is a planning average of one call per customer/month, including an initial or refreshed suggestion. Previews count within the 400-draft assumption, and full private profiles/examples are not repeated unnecessarily in each draft. Use actual billed tokens across all calls. Sending the same context multiple times, or adding another model pass, can increase billed input. A single 6,000-token document is not automatically a 6,000-token total workflow. The model includes no paid web-search calls, external enrichment database, or image/voice processing.

### Sensitivity to writing choices

The following are monthly totals **before the 20% reserve**, with other services unchanged. “3× AI” means more context and repeated generations, not three times the total application throughput.

| Scenario | 100 customers | 500 | 1,000 |
| --- | ---: | ---: | ---: |
| Base: Sonnet 5 | €1,362 | €5,685 | €11,280 |
| Haiku 4.5 for drafting/style analysis, if evaluation quality passes | €1,145 | €4,602 | €9,113 |
| Three times the base AI token spend | €2,295 | €10,353 | €20,614 |

I would start with Sonnet and measure French message quality before trading it for a cheaper writer. TypeSafe is already a small part of the bill. Cache reusable facts and generate a follow-up only when its step is approaching, so a prospect's earlier reply prevents unnecessary drafting.

## Workflow cost assumptions

Budget **20,000 Temporal billable actions per customer/month**, plus average open history of 0.01 GB and retained history of 0.05 GB. Using 730 hours/month:

```text
Actions:          20,000 / 1,000,000 × $50 = $1.00
Active history:   0.01 × 730 × $0.042    = $0.30660
Retained history: 0.05 × 730 × $0.00105  = $0.038325
With 10% support: ($1 + $0.30660 + $0.038325) × 1.10
                = $1.4794175 per customer/month
```

This is an implementation assumption, not a correspondence of one prospect to one billable action. Measure actual activities, signals, timers and retries. Batched discovery, IDs instead of full profile payloads, and bounded workflow histories are part of the design. Continuous high-frequency polling would change this estimate substantially. Extra Temporal capacity modes, fairness charges, premium support and multi-region HA are not enabled in this model.

## Hosting and database sizing

| Customers | Production app | Production API | Production workers | Neon average production CU | Production database GB | Restore history GB |
| --- | --- | --- | --- | ---: | ---: | ---: |
| 10 | 1 × $25 | 1 × $25 | 1 × $25 | 0.25 | 5 | 1 |
| 50 | 1 × $25 | 1 × $25 | 1 × $25 | 0.25 | 10 | 2 |
| 100 | 2 × $25 | 2 × $25 | 2 × $25 | 0.50 | 20 | 5 |
| 500 | 2 × $25 | 2 × $25 | 2 × $85 | 1.00 | 75 | 15 |
| 1,000 | 2 × $85 | 2 × $25 | 4 × $85 | 2.00 | 150 | 30 |

Every row includes Render's $25 workspace, a $7 staging app, $7 staging API and $25 staging worker. Marketing and Fumadocs documentation are static exports, with no paid dynamic servers in the baseline. Docs use a static search index and browser search, not an unbudgeted search API. These extra API services explain the hosting increase relative to the earlier two-process proposal; next-forge itself has no hosting fee.

Neon production uses 730 active hours/month. Staging is modelled at 0.25 CU for 160 active hours/month, with 1 GB of database storage and 0.2 GB of restore history. Staging schedules and database polling must stop outside test sessions for this assumption to hold. Production is deliberately not priced on speculative scale-to-zero savings.

For example, the ten-customer Neon estimate is:

```text
Compute: (0.25 × 730 + 0.25 × 160) × $0.106 = $23.585
Database storage: (5 + 1) GB × $0.35          = $2.10
Restore history:  (1 + 0.2) GB × $0.20        = $0.24
Total                                        = $25.925/month
```

Restore history means average billed retained history, not simply database size multiplied by seven days. Configure seven-day production history from the pilot. Scheduled Neon snapshots and extra paid branches are not assumed; encrypted logical exports are covered by the R2 allowance. [Neon pricing and billing units](https://neon.com/pricing.md), [restore window](https://neon.com/docs/postgres/backup-restore/history-window).

These are unbenchmarked starting envelopes. Scale from measured memory, CPU, query latency and queue age. Each extra average production CU running all month adds $77.38 on Launch. A staging database kept active all month instead of 160 hours adds about $15.11 at 0.25 CU. Choosing Scale for its additional service/network features changes the CU-hour rate to $0.222; at the same assumed workload that adds about €25.81/month at 10 customers, €46.98 at 100, and €174 at 1,000 before reserve. Storage and optional service charges still need review.

Better Auth runs on our app instances and Neon database. It has no separate managed-auth fee in this plan. Drizzle, next-forge, Turborepo, Bun, Ultracite, Biome, Fumadocs, Wrangler, Next Safe Action and nuqs add no runtime subscription. Their build/bandwidth impact must still fit the usage allowance. The required Stripe fees remain revenue-dependent and are shown separately below.

PITR is a recovery facility, not a live standby or end-to-end availability guarantee. Before automatic sending resumes after a restore, reconcile provider history and the send ledger.

## Launch cash with developers free

| Two-month pilot item | Planning amount |
| --- | ---: |
| Two months of ten-customer stack, excluding monthly domain allowance | €680.78 |
| Domain/DNS annual allowance paid up front | €24 |
| Extra one-time AI evaluations and integration experiments | €100–€300 |
| Subtotal | €804.78–€1,004.78 |
| With 20% reserve | €965.74–€1,205.74 |
| **Practical cash allocation** | **€1,000–€1,300** |

This assumes two months, not a promised development duration. Add roughly another pilot month of operating costs for each extra month. API credit purchases are prepayments for usage; do not count them a second time as setup fees.

A lean internal prototype can omit permanent staging, use free monitoring/email within their limits and reduce workspace features. The shared-customer estimate above intentionally keeps staging and operational allowances. Free developer labour does not remove subscription or usage costs during the build.

## Required Stripe payment fees, separate from infrastructure

If the company has a French Stripe account and a customer pays with a standard EEA card, the published Payments rate is 1.5% + €0.25. Stripe Billing pay-as-you-go adds 0.7% of the relevant Billing volume. Thus a simplified subscription estimate is **2.2% of the amount charged + €0.25 per monthly payment**. Other cards, payment methods, taxes, currency conversion, disputes and add-ons differ. [Stripe France Payments](https://stripe.com/fr/pricing), [Stripe Billing](https://stripe.com/fr/billing/pricing).

For **€99 actually charged** per customer, that example is about **€2.43/customer/month**: approximately €243 for 100 customers, €1,214 for 500, or €2,428 for 1,000. If €99 is your VAT-exclusive price, use the higher amount actually collected when estimating payment fees. This is an illustration, not a recommended selling price.

Stripe is required in the revised stack. Reuse existing Stripe records if available. The example fee is included in the editable calculator; it stays outside the infrastructure total because the actual product price and payment mix are not specified.

| At €99 actually collected monthly per customer | 10 customers | 50 | 100 | 500 | 1,000 |
| --- | ---: | ---: | ---: | ---: | ---: |
| Stripe example fees | €24.28 | €121.40 | €242.80 | €1,214.00 | €2,428.00 |
| Infrastructure base plus example Stripe fees, before reserve | €366.67 | €917.60 | €1,604.77 | €6,899.49 | €13,708.35 |

Add actual payment fees to the recommended rounded infrastructure budget when planning cash. Do not count the same fee again if an existing contract already includes it.

## Additional costs that can change the bill

| Choice or requirement | Treatment |
| --- | --- |
| LinkedIn Premium / Sales Navigator / Recruiter | Customer-provided where needed; not bundled in Unipile and not paid by this baseline |
| More than one connected identity per customer | Recalculate connector cost using total linked accounts |
| Customer/operator support | People still handle replies and incidents; labour remains €0 by your assumption |
| More notification emails | Base assumes 40/customer/month; 1,000 customers remains below Resend's 50,000 allowance before other mail. Additional 1,000-email buckets on the quoted Pro tier cost $0.90 |
| Files, bandwidth and CI | R2 has a separate €5/5/5/10/20 allowance; bandwidth/CI allowances are €10/15/25/75/150. Replace with measured invoices. Database storage and history are already calculated under Neon |
| Higher CI usage | At the quoted Linux rate, 5,000 minutes beyond quota add $30, plus any storage charges |
| Strict availability / regional failover | Requires a separate HA design and provider quote; not hidden inside the base estimate |
| TypeSafe unavailable or unsuitable | Pause qualification or use an evaluated fallback model. Recalculate fallback tokens; it is not assumed to cost the same |
| Web research, company enrichment or funding news | No external search/enrichment vendor purchased in this plan. Add measured per-query/source costs if that scope is activated |
| Other platforms, cold email, profile audits and content publishing | Additional product modules; no development labour charge assumed, but extra accounts, tokens, providers and usage need separate budgets |
| Domains and developer tools | Domain figure is an allowance, not a registrar quote. Existing developer tooling is assumed covered; optional paid GitHub/Docker Desktop/AI coding seats are excluded |
| Taxes, marketing, accounting, legal, insurance and refunds | Outside technical operating cost |

## Controlling the spend

Record provider usage by tenant and campaign, then reconcile it to vendor invoices. Set spend alerts, per-customer token budgets, bounded retries and a maximum number of active campaigns. After seven days of real pilot usage, replace the draft-count, token, Temporal-history and network assumptions in [cost-model.json](cost-model.json). [cost-results.json](cost-results.json) contains the corresponding calculated scenario totals for this version.

Pausing outbound activity on a budget limit must not disable incoming-message ingestion or the reply-stop mechanism. Those are the reliability controls that keep paused customers from receiving stale follow-ups later.
