import type { PageData } from "fumadocs-core/source";
import { llms, loader } from "fumadocs-core/source";
import { metaSchema, pageSchema } from "fumadocs-core/source/schema";
import { defineDocs } from "fumadocs-mdx/macro";
import type { DocData, DocMethods } from "fumadocs-mdx/runtime/types";

import { docsRoute } from "./shared";

export type RelanmoDocsPageData = PageData &
  DocData &
  DocMethods & {
    full?: boolean;
  };

const docs = defineDocs({
  dir: "content/docs",
  docs: {
    postprocess: {
      includeProcessedMarkdown: true,
    },
    schema: pageSchema,
  },
  meta: {
    schema: metaSchema,
  },
});

// See https://fumadocs.dev/docs/headless/source-api for more info
const docsSource = loader({
  baseUrl: docsRoute,
  plugins: [],
  source: docs.toFumadocsSource(),
});

export const source = docsSource;

export const docsLlms = llms(source, {
  renderPage: async (page) => `# ${page.data.title} (${page.url})

${await page.data.getText("processed")}`,
});
