# Ultracite — Oxlint and Oxfmt policy

Ultracite supplies the shared configuration and CLI. The current Relanmo
provider choice is Oxlint for linting and Oxfmt for formatting, with the
vendored anti-slop preset enabled. [Provider choices](https://www.ultracite.ai/docs).

## Configuration

The official non-interactive setup command is:

```sh
bunx ultracite init --quiet --linter oxlint --pm bun \
  --frameworks react next --js-plugins anti-slop
```

It creates root `oxlint.config.ts` and `oxfmt.config.ts` files. The configs
extend the documented presets:

```ts
import { defineConfig } from "oxlint";
import antiSlop from "ultracite/oxlint/anti-slop";
import core from "ultracite/oxlint/core";
import next from "ultracite/oxlint/next";
import react from "ultracite/oxlint/react";

export default defineConfig({
  extends: [core, react, next, antiSlop],
  ignorePatterns: core.ignorePatterns,
});
```

Install and pin `ultracite`, `oxlint` and `oxfmt` together in the root
development dependencies. The anti-slop upstream is deliberately not
published as a package; Ultracite vendors its self-contained plugin, so no
standalone `anti-slop` dependency is added. Exclude generated build artifacts
and intentionally vendored scaffold components, not handwritten domain logic.
Review every narrow rule override with its reason. [Oxlint and Oxfmt presets](https://www.ultracite.ai/docs/provider/oxlint).

Set root scripts `lint` and `check` to `ultracite check`, and `format` and
`fix` to `ultracite fix`; execute them through `bun run`. CI checks without
changing files. Developers may apply fixes locally and review the diff. Use
`ultracite doctor` to detect incompatible tooling versions. [CLI usage](https://www.ultracite.ai/docs/usage).

Keep strict TypeScript compilation as a separate check. Oxc linting and
formatting do not replace `tsc --noEmit`, concurrency tests or workflow replay
tests.

## Cost and acceptance

No hosted Ultracite subscription is required. A deliberately misformatted
source file should fail CI; running the formatter should produce a reviewable
repair. Verify editor and CI configuration agree and no competing formatting
command rewrites the same files differently.
