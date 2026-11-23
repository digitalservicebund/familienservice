import type { Core } from "@strapi/strapi";

/**
 * app.keys is set in src/index.ts (register) with getSecret("APP_KEYS"), because `strapi build`
 * loads this file without secrets.
 */
const config = ({ env }: Core.Config.Shared.ConfigParams): Omit<Core.Config.Server, "app"> => ({
  host: env("HOST", "0.0.0.0"),
  port: env.int("PORT", 1337),
  webhooks: {
    populateRelations: env.bool("WEBHOOKS_POPULATE_RELATIONS", false),
  },
});

export default config;
