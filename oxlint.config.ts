import { defineConfig } from "oxlint";
import antiSlop from "ultracite/oxlint/anti-slop";
import core from "ultracite/oxlint/core";
import next from "ultracite/oxlint/next";
import react from "ultracite/oxlint/react";

export default defineConfig({
  extends: [core, react, next, antiSlop],
  ignorePatterns: [
    ...core.ignorePatterns,
    ".task-*",
    "planning",
    "**/playwright-report",
    "**/test-results",
    "packages/design-system/components/ui",
    "packages/design-system/lib",
    "packages/design-system/hooks",
    "apps/docs/**/*.json",
  ],
  // Keep this provider migration focused: the scaffold already uses
  // declaration-style components and unsorted object/Tailwind patterns.
  // Correctness and anti-slop rules remain enabled.
  rules: {
    "func-style": "off",
    "react/function-component-definition": "off",
    "sort-keys": "off",
  },
  overrides: [
    {
      files: ["packages/observability/error.ts"],
      // This module is the deliberate boundary that normalizes unknown
      // thrown values before they are reported.
      rules: {
        "anti-slop/no-runtime-typeof": "off",
        "anti-slop/no-unknown-parameters": "off",
      },
    },
  ],
});
