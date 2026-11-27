/**
 * leistungsdetail router
 *
 * Leistungsdetails are a pure data source (written only by the import route), so the
 * generic REST API is read-only. Writing happens exclusively via POST /leistungsdetails/import.
 */

import { factories } from "@strapi/strapi";

export default factories.createCoreRouter("api::leistungsdetail.leistungsdetail", {
  only: ["find", "findOne"],
});
