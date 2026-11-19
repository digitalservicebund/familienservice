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
  bootstrap() {},
};
