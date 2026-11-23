import { readFileSync } from "node:fs";
import path from "node:path";

/**
 * Returns the secret `name`, e.g. `getSecret("DATABASE_PASSWORD")`.
 * Where it comes from depends on where Strapi runs:
 *
 * - Deployed: from the file `${SECRETS_FILE_PATH}/<name>`, e.g. `/etc/secrets/DATABASE_PASSWORD`.
 * - Locally: from the env var `<name>`. It comes from cms/.env, where secrets are 1Password references (op://…).
 *
 * The value is trimmed (mounted files may end with a line break). Throws if it is missing or empty.
 */
export function getSecret(name: string): string {
  return runsInKubernetes() ? readSecretFile(name) : readEnvironmentVariable(name);
}

function runsInKubernetes(): boolean {
  return Boolean(process.env.KUBERNETES_SERVICE_HOST);
}

function readSecretFile(name: string): string {
  const basePath = process.env.SECRETS_FILE_PATH;

  if (!basePath) {
    throw new Error(
      "SECRETS_FILE_PATH is not set. In the cluster it must point to the mounted secret files (/etc/secrets). See cms/README.md.",
    );
  }

  const filePath = path.resolve(basePath, name);

  let value: string;
  try {
    value = readFileSync(filePath, "utf8").trim();
  } catch (error) {
    throw new Error(`Cannot read the secret ${name} from ${filePath}.`, { cause: error });
  }
  if (value === "") {
    throw new Error(`The secret file ${filePath} is empty.`);
  }
  return value;
}

function readEnvironmentVariable(name: string): string {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`${name} is not set. Locally, secrets come from cms/.env, see cms/README.md.`);
  }

  return value;
}
