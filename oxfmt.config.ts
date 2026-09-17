import { defineConfig } from "oxfmt";
import ultracite from "ultracite/oxfmt";

export default defineConfig({
  ...ultracite,
  ignorePatterns: [
    ...(ultracite.ignorePatterns ?? []),
    "AGENTS.md",
    "CLAUDE.md",
    ".task-*",
    "planning",
    "**/playwright-report",
    "**/test-results",
    "packages/design-system/components/ui",
    "packages/design-system/lib",
    "packages/design-system/hooks",
    "apps/docs/**/*.json",
  ],
});
