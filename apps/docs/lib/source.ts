import type { LoaderOutput, Meta, Page, PageData } from "fumadocs-core/source";
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

type RelanmoDocsLoader = LoaderOutput<{
  i18n: undefined;
  meta: Meta;
  page: Page<undefined, RelanmoDocsPageData>;
}>;

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
export const source = loader({
  baseUrl: docsRoute,
  plugins: [],
  source: docs.toFumadocsSource(),
}) as unknown as RelanmoDocsLoader;

export const docsLlms = llms(source, {
  renderPage: async (page) => `# ${page.data.title} (${page.url})

${await page.data.getText("processed")}`,
});
