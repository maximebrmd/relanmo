# Biome — superseded provider note

The original planning pack selected Biome, but the explicit P002 provider
revision switches the active Ultracite toolchain to Oxlint and Oxfmt with the
vendored anti-slop preset. Do not add a root `biome.jsonc` or install Biome for
the current repository. The active setup is documented in
[ultracite.md](ultracite.md) and the root `oxlint.config.ts` and
`oxfmt.config.ts` files.

The original Biome decision remains in the task-card history so the planning
pack's initial record is preserved. Current checks still run non-mutating lint
and strict TypeScript compilation separately; neither claims authorization
correctness or Temporal workflow determinism.
