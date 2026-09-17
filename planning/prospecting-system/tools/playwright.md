# Playwright — end-to-end tests of our application

**Status: recommended test tool.** It verifies the customer product. Production LinkedIn actions use Unipile, so Playwright is not a replacement browser connector. [Official installation and testing guide](https://playwright.dev/docs/intro).

## Product journeys to cover

1. Sign up, complete the freelancer offer, configure targets, and see a connected account.
2. Exercise the Hosted Auth handoff with a mocked provider response in ordinary CI, including failure and expiry.
3. Activate a campaign, observe its status, pause it and verify queued work cannot continue.
4. Inject an authenticated synthetic incoming-event fixture and verify the UI shows human ownership and no future send.
5. Show reconnect-required status and recover without losing campaign history.
6. Test pipeline/history views on desktop and mobile, including empty, loading and provider-outage states.
7. Verify one tenant cannot open another tenant's prospect, export or account settings by changing a URL.

## Implementation

Use independent browser contexts and test tenants. Seed deterministic data and intercept external providers for normal CI. Keep a small separate smoke test for an explicitly enrolled real integration when needed; never use a developer's personal browsing profile as a CI fixture.

Prefer user-visible roles and labels for selectors. Save failure traces/screenshots with restricted access and short retention. Mask private messages, credentials and authentication URLs.

A mocked hosted-auth flow tests our product's behaviour, not Unipile's real login reliability. The integration spike and controlled pilot supply that separate evidence.

## Cost

No Playwright licence subscription is required. Browsers run in CI or development and consume those compute minutes. This architecture budgets no continuously running test browser per customer and requires no customer extension.
