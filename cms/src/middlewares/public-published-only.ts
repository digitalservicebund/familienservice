import type { Core } from "@strapi/strapi";

/**
 * Anonymous requests may only read published content.
 *
 * The public role can call `find`/`findOne` (see src/index.ts), but Strapi would also
 * answer `?status=draft` for anonymous requests and return unpublished drafts. This
 * middleware pins such requests to `status=published`. Requests authenticated with an
 * API token or a logged-in user keep their `status`, e.g. for a later preview.
 *
 * Attach it to read routes via `middlewares: ["global::public-published-only"]`.
 */
const publicPublishedOnly: Core.MiddlewareFactory = () => async (ctx, next) => {
  const isAnonymous = !ctx.state.auth?.credentials;

  if (isAnonymous && "status" in ctx.query) {
    ctx.query = { ...ctx.query, status: "published" };
  }

  await next();
};

export default publicPublishedOnly;
