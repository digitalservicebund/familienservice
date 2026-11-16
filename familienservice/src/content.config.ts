import { defineCollection } from "astro:content";
import { z } from "astro/zod";
import { strapiLoader } from "./lib/strapi-loader";

/**
 * Familienleistungen from the Strapi CMS (cms/). Set STRAPI_URL to load them,
 * e.g. `STRAPI_URL=http://localhost:1337 pnpm build`.
 */
const familienleistungen = defineCollection({
  loader: strapiLoader({
    url: process.env.STRAPI_URL,
    pluralApiId: "familienleistungen",
    markdownField: "inhalt",
  }),
  schema: z.object({
    documentId: z.string(),
    titel: z.string(),
    slug: z.string(),
    beschreibung: z.string().nullable(),
    inhalt: z.string().nullable(),
    updatedAt: z.coerce.date(),
  }),
});

export const collections = { familienleistungen };
