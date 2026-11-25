/**
 * Custom route: bulk upsert of Leistungsdetails by bafzaId.
 * Auth is the Strapi default (API token required); a custom-type token needs the
 * permission `leistungsdetail.import`.
 */

export default {
  routes: [
    {
      method: "POST",
      path: "/leistungsdetails/import",
      handler: "leistungsdetail.import",
      config: {},
    },
  ],
};
