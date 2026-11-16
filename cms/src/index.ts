import type { Core } from "@strapi/strapi";

/**
 * Content API actions that anyone may call without a token. The Astro frontend
 * reads published content through them at build time.
 */
const PUBLIC_ACTIONS = [
  "api::familienleistung.familienleistung.find",
  "api::familienleistung.familienleistung.findOne",
];

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
        'Start Strapi via "pnpm cms:dev" (runs "op run --env-file=.env").',
    );
  }
}

/**
 * Grants the public role the actions above. Runs on every start and only adds
 * what is missing, so the permissions live in code instead of admin clicks.
 */
async function grantPublicPermissions(strapi: Core.Strapi) {
  const publicRole = await strapi.db
    .query("plugin::users-permissions.role")
    .findOne({ where: { type: "public" } });

  if (!publicRole) {
    strapi.log.warn("Public role not found, skipping public permissions.");
    return;
  }

  for (const action of PUBLIC_ACTIONS) {
    const existing = await strapi.db
      .query("plugin::users-permissions.permission")
      .findOne({ where: { action, role: publicRole.id } });

    if (!existing) {
      await strapi.db
        .query("plugin::users-permissions.permission")
        .create({ data: { action, role: publicRole.id } });
      strapi.log.info(`Granted public permission: ${action}`);
    }
  }
}

export default {
  /**
   * Runs before the application is initialized.
   */
  register() {
    assertSecretsResolved();
  },

  /**
   * Runs before the application is started.
   */
  async bootstrap({ strapi }: { strapi: Core.Strapi }) {
    await grantPublicPermissions(strapi);
  },
};
