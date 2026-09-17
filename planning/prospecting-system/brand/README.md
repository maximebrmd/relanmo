# Relanmo — brand guide

**Name:** Relanmo · **Technical slug:** `relanmo` · **Market:** French freelancers first.

**Tagline:** « La prospection avance. Vous aussi. »

Relanmo is a coined name inspired by *relance* and forward momentum. It is short enough for an app label, has no accent to lose in a URL, and leaves room to expand beyond a single prospecting channel. Pronounce it **re-lan-mo**. Write `Relanmo` in ordinary copy and `relanmo` in the supplied wordmark; do not add “AI” to the product name by default.

## Product promise

Relanmo helps independent professionals keep prospecting while they focus on their work. It finds relevant prospects and sends a bounded sequence in their preferred style. The freelancer takes over as soon as a prospect replies.

Suggested French description:

> Votre prospection continue pendant que vous travaillez. Relanmo identifie les bons profils, lance les échanges et vous passe la main dès la première réponse.

The product may process events continuously; its sending schedule follows configured business windows. Do not promise messages every hour, guaranteed contracts, limitless outreach, perfect imitation of a person's voice, or automated replies after handover.

## Visual direction

Revision 2 replaces the original colored identity. Use a simple geometric **R** with a compact bowl and a separated diagonal leg, paired with the lowercase `relanmo` wordmark. The logo uses black and white. Interface hierarchy comes from typography, spacing, neutral grays and restrained borders.

The user's references are [Fumadocs](https://fumadocs.dev/), [Better Auth](https://better-auth.com/), [Render](https://render.com/) and [Hyperline](https://www.hyperline.co/). They establish the desired simplicity; Relanmo keeps its own mark. The future product follows [Vercel's Geist design system](https://vercel.com/geist), while retaining the existing next-forge shared components.

These are PNG raster masters with opaque backgrounds. They are not transparent assets or editable vector paths. Preserve their proportions and use the matching light/dark version. Any future SVG master must be explicitly redrawn and visually reviewed; wrapping a PNG inside SVG does not make it a vector logo. Avoid using these generously padded wordmark canvases directly as favicons.

See [the visual identity preview](preview.html), [machine-readable tokens](tokens.json) and [asset inventory](assets.json) for actual dimensions and hashes.

## Assets

- [Primary logo](relanmo-logo.png) — black lockup on white, for light surfaces.
- [Dark logo](relanmo-logo-dark.png) — white lockup on black, for dark surfaces.
- [App icon](relanmo-app-icon.png) — standalone white R on black.

The colored logo is superseded. No gradients, colored accent dot, glow, shadow or decorative logo container are part of this identity.

## Palette and themes

| Role | Light | Dark |
| --- | --- | --- |
| Background | `#FFFFFF` | `#000000` |
| Secondary surface | `#FAFAFA` | `#111111` |
| Main text and icons | `#000000` | `#FFFFFF` |
| Secondary text | `#666666` | `#A1A1A1` |
| Border | `#EAEAEA` | `#333333` |
| Primary button | Black / white text | White / black text |

These are Relanmo's neutral defaults, not a verbatim export of Vercel's design tokens. [Geist's color documentation](https://vercel.com/geist/colors) separates backgrounds, borders, high-contrast surfaces and text roles. Map those roles through next-forge's existing semantic theme variables in `packages/design-system`; do not scatter hex values across feature components or install a second component library to imitate the look.

Keep the brand and navigation monochrome. Existing semantic states may use the shared design system's accessible treatments when needed; pair every status with clear text or an icon. Check both themes, focus indicators and contrast. Do not use decoration as the only indication that sending has stopped.

## Typography and application use

Use the existing next-forge **Geist Sans** setup for interface text and **Geist Mono** for identifiers where needed. Geist's own guidance emphasizes simplicity and clarity. [Geist font reference](https://vercel.com/font). The generated wordmark is artwork, not an exact font file or new dependency. The offline preview uses system font fallbacks; production uses the shared Geist setup.

Use restrained weights and tight headline tracking, readable body text, compact metadata and generous whitespace. Do not add another UI library or font package for branding. Use the existing theme provider, shared buttons and accessible primitives.

Prefer clear French verbs and useful status text. Examples: “Activer la campagne”, “Mettre en pause”, “Réponse reçue — à vous de jouer”, “Reconnecter LinkedIn”. Explain what happened and the next available action. Avoid loud sales language, gamified spam counters and technical vendor names in routine customer flows.

Use the horizontal logo in marketing and onboarding. Use the standalone mark in app navigation and icon contexts. Keep at least a quarter of the symbol's height clear around it. Inspect a production favicon at 16 and 32 pixels, especially the gap above the diagonal leg. Do not stretch, rotate, add a shadow or redraw the mark independently in each app.

## Implementation handoff

P001 preserves this directory during scaffolding. P007 exposes any shared asset entrypoints with the existing build tools. P001 retains the neutral shared theme from next-forge. P047 consumes the shared theme in the app shell; it does not gain ownership of global styles through this guide. P047, P050–P063, P078–P080 use this guide for the product, Fumadocs and marketing site. Put production asset copies in the appropriate shared/public directories as part of those scoped tasks; these planning assets are the visual source of truth.

The product name and visuals do not alter tenant boundaries, prompt precedence, reply-stop behavior or any approved technology choice.

## Naming check — 17 September 2026

An initial web search for the exact name and software/prospecting combinations surfaced unrelated text/anagram matches rather than an obvious matching prospecting product. GitHub's repository-name search returned zero results before the new repository was created. This is a preliminary collision screen, not a trademark or domain-availability determination. No domain was purchased or trademark registered in this task.

Rejected directions included Missionaut, already used by a [game](https://www.missionaut.com/), and Sillane, already used by a [French business platform](https://sillane.com/). Relanmo was selected for this project after that screen.
