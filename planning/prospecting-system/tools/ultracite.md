# Ultracite — required lint and format policy

Ultracite supplies the shared configuration and CLI; Biome is the required engine. Current Ultracite supports multiple providers, so select Biome explicitly rather than accepting a changing default. [Provider choices](https://www.ultracite.ai/docs).

## Configuration

Initialize with `bunx ultracite init --linter biome`, review changes, then pin compatible `ultracite` and `@biomejs/biome` versions in the root development dependencies and lockfile. Keep one root `biome.jsonc`. The documented preset names are:

```json
{
  "extends": [
    "ultracite/biome/core",
    "ultracite/biome/react",
    "ultracite/biome/next"
  ]
}
```

Apply framework rules to the relevant workspace files where necessary. Exclude generated build artifacts, not handwritten domain logic. Review any narrow rule override with its reason. [Biome presets](https://www.ultracite.ai/docs/provider/biome).

Set root scripts `lint` to `ultracite check` and `format` to `ultracite fix`; execute them through `bun run`. CI checks without changing files. Developers may apply fixes locally and review the diff. Avoid unattended unsafe fixes in the release pipeline. Use `ultracite doctor` to detect incompatible tooling versions. [CLI usage](https://www.ultracite.ai/docs/usage).

Keep strict TypeScript compilation as a separate check. Optional Biome project-analysis presets do not replace `tsc --noEmit`, concurrency tests or workflow replay tests.

## Cost and acceptance

No hosted Ultracite subscription is required. A deliberately misformatted source file should fail CI; running the formatter should produce a reviewable repair. Verify editor and CI configuration agree and no competing formatting command rewrites the same files differently.
