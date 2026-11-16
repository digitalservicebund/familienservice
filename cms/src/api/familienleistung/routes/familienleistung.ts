import { factories } from "@strapi/strapi";

export default factories.createCoreRouter("api::familienleistung.familienleistung", {
  config: {
    find: { middlewares: ["global::public-published-only"] },
    findOne: { middlewares: ["global::public-published-only"] },
  },
});
