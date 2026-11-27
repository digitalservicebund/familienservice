/**
 * leistungsdetail controller
 */

import { factories } from "@strapi/strapi";

import type { ImportService } from "../services/leistungsdetail";

export default factories.createCoreController(
  "api::leistungsdetail.leistungsdetail",
  ({ strapi }) => ({
    async import(ctx) {
      const service = strapi.service("api::leistungsdetail.leistungsdetail") as ImportService;
      const result = await service.importAll(ctx.request.body);
      ctx.status = result.ok ? 200 : 422;
      ctx.body = result;
    },
  }),
);
