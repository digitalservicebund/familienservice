import type { Core } from "@strapi/strapi";

import { getSecret } from "../src/utils/secretsAndEnvironmentVariables";

// The local Docker database (docker-compose.yaml) has no TLS and is only reachable from this machine.
const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);

/**
 * PostgreSQL. getSecret reads the DATABASE_* values from the files ${SECRETS_FILE_PATH}/DATABASE_*
 * in the cluster and from the env vars of the same name (cms/.env) locally. See cms/README.md.
 *
 * `connection` is a function so the secrets are read when Strapi connects at startup, not when
 * other commands such as `strapi build` load this config. Knex calls it once per process, so rotated
 * credentials need a restart. Strapi logs a warning that connection functions are experimental.
 */
const config = (): Core.Config.Database => ({
  connection: {
    client: "postgres",
    connection: () => {
      const host = getSecret("DATABASE_HOST");
      return {
        host,
        port: Number(getSecret("DATABASE_PORT")),
        database: getSecret("DATABASE_NAME"),
        user: getSecret("DATABASE_USERNAME"),
        password: getSecret("DATABASE_PASSWORD"),
        // TLS with certificate and hostname verification against Node's CA store (STACKIT Managed
        // PostgreSQL). Only a database on a loopback address is reached without TLS.
        ssl: LOOPBACK_HOSTS.has(host) ? false : { rejectUnauthorized: true },
        schema: "public",
      };
    },
  },
});

export default config;
