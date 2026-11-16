import type { Loader } from "astro/loaders";

/** Strapi's default `rest.maxLimit`, the largest page size the API accepts. */
const PAGE_SIZE = 100;

type StrapiDocument = Record<string, unknown>;

interface StrapiListResponse {
  data: StrapiDocument[];
  meta: { pagination: { page: number; pageCount: number } };
}

interface StrapiLoaderOptions {
  /** Base URL of the Strapi server, e.g. `http://localhost:1337`. Without it the collection stays empty. */
  url: string | undefined;
  /** Plural API ID of the Strapi collection type, e.g. `familienleistungen`. */
  pluralApiId: string;
  /** Attribute used as the entry ID, e.g. for URLs. */
  idField?: string;
  /** Attribute with Markdown that is rendered to HTML (available via `render()`). */
  markdownField?: string;
}

function describeError(error: unknown): string {
  if (!(error instanceof Error)) return String(error);
  // fetch() reports network problems as "fetch failed" and puts the reason into `cause`
  return error.cause instanceof Error ? `${error.message} (${error.cause.message})` : error.message;
}

/** Loads all published documents of a collection type via the Strapi REST API, page by page. */
async function fetchAllDocuments(baseUrl: string, pluralApiId: string): Promise<StrapiDocument[]> {
  const documents: StrapiDocument[] = [];
  let page = 1;
  let pageCount = 1;

  do {
    const url = new URL(`/api/${pluralApiId}`, baseUrl);
    url.searchParams.set("pagination[page]", String(page));
    url.searchParams.set("pagination[pageSize]", String(PAGE_SIZE));

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`${response.status} ${response.statusText} for ${url}`);
    }

    const body = (await response.json()) as StrapiListResponse;
    documents.push(...body.data);
    pageCount = body.meta.pagination.pageCount;
    page += 1;
  } while (page <= pageCount);

  return documents;
}

/**
 * Astro content loader for a Strapi collection type.
 *
 * Runs at build time (and on start of the dev server). If Strapi is not configured
 * or not reachable, it logs a warning and leaves the collection empty, so the site
 * still builds without a running CMS.
 */
export function strapiLoader({
  url,
  pluralApiId,
  idField = "slug",
  markdownField,
}: StrapiLoaderOptions): Loader {
  return {
    name: "strapi-loader",
    load: async ({ store, logger, parseData, generateDigest, renderMarkdown }) => {
      if (!url) {
        logger.warn(`STRAPI_URL is not set, the collection "${pluralApiId}" stays empty.`);
        store.clear();
        return;
      }

      let documents: StrapiDocument[];
      try {
        documents = await fetchAllDocuments(url, pluralApiId);
      } catch (error) {
        logger.warn(
          `Could not load "${pluralApiId}" from ${url}, the collection stays empty: ${describeError(error)}`,
        );
        store.clear();
        return;
      }

      store.clear();
      for (const document of documents) {
        const id = String(document[idField]);
        const data = await parseData({ id, data: document });
        const markdown = markdownField ? document[markdownField] : undefined;

        store.set({
          id,
          data,
          digest: generateDigest(document),
          rendered: typeof markdown === "string" ? await renderMarkdown(markdown) : undefined,
        });
      }

      logger.info(`Loaded ${documents.length} entries of "${pluralApiId}" from ${url}.`);
    },
  };
}
