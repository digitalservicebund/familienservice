import type { Core } from "@strapi/strapi";

import { getSecret } from "./utils/secretsAndEnvironmentVariables";

/**
 * cms/.env (created from cms/.env.example) holds 1Password references (op://…) for the secrets. They are
 * only resolved when Strapi is started via `op run` (see the package scripts).
 * Without it, the reference strings themselves would be used as secrets.
 */
function assertSecretsResolved() {
  const unresolved = Object.entries(process.env)
    .filter(([, value]) => value?.startsWith("op://"))
    .map(([name]) => name);

  if (unresolved.length > 0) {
    throw new Error(
      `Unresolved 1Password references in ${unresolved.join(", ")}. ` +
        'Start Strapi via "pnpm start:cms" (runs "op run --env-file=.env").',
    );
  }
}

/**
 * Sets Strapi's own secrets with getSecret: in the cluster from the files ${SECRETS_FILE_PATH}/<name>,
 * locally from the env vars of the same name (cms/.env). See cms/README.md.
 *
 * They are set here and not in config/*.ts, because `strapi build` loads the config files and must run
 * without secrets (e.g. in CI). `register` runs only when Strapi starts, and Strapi checks the values
 * later, in `bootstrap`.
 */
function setStrapiSecrets(strapi: Core.Strapi) {
  // Comma-separated, like env.array() reads it
  const appKeys = getSecret("APP_KEYS")
    .split(",")
    .map((key) => key.trim())
    .filter(Boolean);

  strapi.config.set("server.app.keys", appKeys);
  // Strapi creates its Koa app before register, with the keys the config had then (none)
  strapi.server.app.keys = appKeys;
  strapi.config.set("admin.auth.secret", getSecret("ADMIN_JWT_SECRET"));
  strapi.config.set("admin.apiToken.salt", getSecret("API_TOKEN_SALT"));
  strapi.config.set("admin.transfer.token.salt", getSecret("TRANSFER_TOKEN_SALT"));
  strapi.config.set("admin.secrets.encryptionKey", getSecret("ENCRYPTION_KEY"));
  strapi.config.set("plugin::users-permissions.jwtSecret", getSecret("JWT_SECRET"));
}

export default {
  /**
   * Runs before the application is initialized.
   */
  register({ strapi }: { strapi: Core.Strapi }) {
    assertSecretsResolved();
    setStrapiSecrets(strapi);
  },

  /**
   * Runs before the application is started.
   */
  bootstrap() {},
};
