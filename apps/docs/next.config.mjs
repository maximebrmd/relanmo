import { createMDX } from "fumadocs-mdx/next";

const withMDX = createMDX();

/** @type {import('next').NextConfig} */
const config = {
  output: "export",
  reactStrictMode: true,
  transpilePackages: ["@relanmo/design-system"],
};

// Fumadocs 15 emits Turbopack query rules that Next 16.1 does not understand.
// The documented webpack path keeps this pinned next-forge baseline compatible.
const fumadocsConfig = withMDX(config);
const { turbopack: _turbopack, ...webpackConfig } = fumadocsConfig;

export default webpackConfig;
