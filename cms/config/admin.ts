import type { Core } from "@strapi/strapi";

/**
 * The secrets (auth.secret, apiToken.salt, transfer.token.salt, secrets.encryptionKey) are set in
 * src/index.ts (register) with getSecret, because `strapi build` loads this file without secrets.
 */
const config = ({
  env,
}: Core.Config.Shared.ConfigParams): Omit<Core.Config.Admin, "auth" | "apiToken"> => ({
  flags: {
    nps: env.bool("FLAG_NPS", false),
    promoteEE: env.bool("FLAG_PROMOTE_EE", false),
    docLinks: env.bool("FLAG_DOC_LINKS", true),
  },
});

export default config;
