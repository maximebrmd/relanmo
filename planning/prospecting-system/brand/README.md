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

A compact conversation-shaped **R** suggests both an opening exchange and forward movement. Forest ink provides a calm professional base; one coral accent adds energy. Ivory keeps the product warm and readable. The brand should feel helpful and capable, with room for the freelancer's own voice.

The logo is supplied as high-resolution PNG artwork. These files are raster masters, not editable vector paths. Preserve proportions, padding and original colors. A future SVG master should be explicitly redrawn and reviewed; embedding a PNG in an SVG wrapper does not create a vector logo.

See [the visual identity preview](preview.html) and [machine-readable tokens](tokens.json). The [asset inventory](assets.json) records actual dimensions and file hashes after generation.

## Assets

- [Primary logo](relanmo-logo.png) — horizontal wordmark on ivory, 1536 × 1024 px.
- [App icon](relanmo-app-icon.png) — standalone symbol on forest; actual dimensions are in the asset inventory.

## Palette

| Token | Value | Role |
| --- | --- | --- |
| Forest | `#143E35` | Wordmark, primary text, main buttons |
| Ivory | `#F7F5EF` | Warm background and light brand surfaces |
| Coral | `#EE7358` | Logo accent, selected highlights and decorative emphasis |
| Moss | `#62766D` | Secondary text on approved light backgrounds |
| Mist | `#E6EDE7` | Subtle panels and dividers |
| White | `#FFFFFF` | Forms and content surfaces |

Treat these hex values as UI design tokens. Generated raster artwork can include antialiasing and slight color variation. Coral is an accent, not the default small text color. Verify contrast for actual component foreground/background combinations, especially disabled and error states. Use readable text/icon labels as well as color for automation state.

## Typography and application use

Use the existing next-forge **Geist Sans** setup for interface text and **Geist Mono** for identifiers where needed. The generated wordmark is artwork; do not assume its custom lettering is an installed font. This branding introduces no font or package dependency.

Prefer clear French verbs and useful status text. Examples: “Activer la campagne”, “Mettre en pause”, “Réponse reçue — à vous de jouer”, “Reconnecter LinkedIn”. Explain what happened and the next available action. Avoid loud sales language, gamified spam counters and technical vendor names in routine customer flows.

Use the full horizontal logo in marketing and onboarding. Use the standalone mark in the app navigation, avatar and icon contexts. Keep at least a quarter of the symbol's height clear around it. At very small sizes, inspect the standalone symbol directly; do not shrink the complete wordmark into a favicon. Do not stretch, rotate, add a shadow or redraw the mark independently in each app.

## Implementation handoff

P001 preserves this directory during scaffolding. P007 exposes any shared asset entrypoints with the existing build tools. P047, P050–P063, P078–P080 use this guide for the product, Fumadocs and marketing site. Put production asset copies in the appropriate shared/public directories as part of those scoped tasks; these planning assets are the visual source of truth.

The product name and visuals do not alter tenant boundaries, prompt precedence, reply-stop behavior or any approved technology choice.

## Naming check — 17 September 2026

An initial web search for the exact name and software/prospecting combinations surfaced unrelated text/anagram matches rather than an obvious matching prospecting product. GitHub's repository-name search returned zero results before the new repository was created. This is a preliminary collision screen, not a trademark or domain-availability determination. No domain was purchased or trademark registered in this task.

Rejected directions included Missionaut, already used by a [game](https://www.missionaut.com/), and Sillane, already used by a [French business platform](https://sillane.com/). Relanmo was selected for this project after that screen.
