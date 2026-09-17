# Biome — required formatter and linter

Install `@biomejs/biome` at the version supported by the pinned Ultracite release. Ultracite defines the policy; Biome performs the checks. This is one toolchain, not two parallel formatting passes. [Biome installation](https://biomejs.dev/guides/getting-started/).

Use the root `biome.jsonc` described in [Ultracite](ultracite.md), with explicit scope for source files and generated-output exclusions. Share editor settings so save-time formatting matches CI. Avoid blanket suppression of a rule across the whole monorepository to accommodate one generated file.

CI runs the non-mutating check and strict TypeScript compilation. Existing next-forge ESLint/Prettier/Oxlint scripts, if present in the chosen scaffold revision, must be reconciled with this requested Biome configuration. Do not claim formatting catches authorization bugs or proves a Temporal workflow deterministic.

Upgrade Biome and Ultracite together through a reviewed dependency update; inspect formatting and rule changes before merging. [Biome CI guidance](https://biomejs.dev/recipes/continuous-integration/).

There is no cloud service bill. Validate checks across application, API, worker and shared TypeScript packages, and measure CI time within the existing allowance.
