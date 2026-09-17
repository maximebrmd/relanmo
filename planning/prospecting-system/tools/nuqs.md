# nuqs — typed pipeline filters in URLs

**Selected next-forge addon.** Use `nuqs` for pipeline status, campaign filters, sort order and pagination in `apps/app`. This avoids repeated query-string parsing and preserves the customer's view through refresh, back/forward navigation and bookmarked URLs. [next-forge addon](https://www.next-forge.com/docs/addons/nuqs).

Configure the Next.js adapter for the pinned version. Define an allowlist of typed query parameters, explicit defaults, bounded page sizes and supported sort keys. Use those parsed values in server-side Drizzle queries after session and tenant checks.

Keep private draft text, authentication tokens and writing examples out of URLs. A query parameter can select a view; it cannot authorize another tenant's data or activate a campaign.

Use local React state for unsaved form text. Persist saved preferences in Neon and use Temporal for durable execution. URL state does not replace those distinct responsibilities, and an extra client state library is unnecessary for these filters.

Test malformed filters, refresh, pagination, browser history and cross-tenant links. Follow the [current nuqs documentation](https://nuqs.dev/docs) for exact adapter and parsing APIs. There is no hosted service fee; the code runs within the existing application budget.
