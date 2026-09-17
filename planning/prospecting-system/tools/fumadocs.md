# Fumadocs — required documentation application

Add `apps/docs` to the next-forge monorepository, replacing its default Mintlify implementation. This is explicitly requested and next-forge already documents the migration. [next-forge migration](https://www.next-forge.com/docs/migrations/documentation/fumadocs).

## Structure and scope

```text
apps/docs/
  app/                      Next.js layouts and documentation routes
  content/docs/             Product documentation in MDX
  components/               Documentation-specific components
  lib/source.ts             Fumadocs content loader
  next.config.mjs            MDX integration and static export
  package.json              Docs workspace commands and dependencies
```

Start with French product documentation: onboarding, connecting LinkedIn, offers/ICP, writing style, campaign activation, replies and handover, pause/reconnect, billing and troubleshooting. Link it from the customer app and marketing site through `NEXT_PUBLIC_DOCS_URL`. Use the existing local docs port, 3004, and a dedicated docs subdomain in deployment.

Keep operational secrets, customer records and internal incident procedures outside the public content directory. A static site's search index is public too. The local technical handbook is not automatically content for the public product documentation.

## Integration

Use `fumadocs-core`, `fumadocs-ui` and `fumadocs-mdx`, with required types such as `@types/mdx`, in the docs workspace. Reuse the monorepo's compatible Next.js, React, TypeScript and Tailwind versions. Current Fumadocs installation instructions target Next.js 16 and Tailwind 4; verify the selected releases before copying older next-forge examples. [Current Next.js setup](https://www.fumadocs.dev/docs/manual-installation/next).

1. Adapt `apps/docs` in place, retaining its workspace identity and Bun scripts. Use Fumadocs MDX as the content source. Remove obsolete Mintlify commands and configuration.
2. Integrate its MDX loader, layouts and documentation navigation. Reuse branding and design tokens without pulling authenticated app providers into the public docs bundle.
3. Configure `output: 'export'`, pre-render documentation routes, and use Fumadocs' static search-index/client configuration. Default server search cannot simply be left behind on a static host. [Static deployment](https://www.fumadocs.dev/docs/deploying/static).
4. Run docs through the shared type checks, build and applicable Ultracite/Oxlint/Oxfmt checks. Check MDX rendering and links during the docs build; source-code checks alone do not validate rendered content.
5. Deploy the exported `apps/docs/out` directory as a Render static site. Preview the built output and verify deep links, French search, navigation and mobile layout.

Use the pinned version's built-in local search. A separate hosted search provider or CMS is not needed for the initial documentation. New independent integrations follow the [dependency policy](../dependency-policy.md).

## Cost and acceptance

No Fumadocs SaaS subscription or permanent docs Node server is included. Static hosting, bandwidth and build usage remain subject to the existing allowances. A future private/dynamic documentation requirement would need a different hosting/security decision and revised cost.

The release must build docs from a frozen Bun installation, render every public MDX page and pass link/search checks. This guide specifies the future application; it does not claim a Fumadocs site has already been deployed.
