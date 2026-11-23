import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import config from "../config/database";

// Strapi passes the connection function to Knex, which calls it when it opens the first connection.
function resolveConnection() {
  const connection = config().connection.connection as () => Record<string, unknown>;
  return connection();
}

function stubDatabaseEnv(host: string) {
  vi.stubEnv("DATABASE_HOST", host);
  vi.stubEnv("DATABASE_PORT", "5432");
  vi.stubEnv("DATABASE_NAME", "cms");
  vi.stubEnv("DATABASE_USERNAME", "web");
  vi.stubEnv("DATABASE_PASSWORD", "p4ssw0rd");
}

beforeEach(() => {
  // Outside Kubernetes, getSecret reads env vars (see src/utils/secretsAndEnvironmentVariables.ts).
  vi.stubEnv("KUBERNETES_SERVICE_HOST", undefined);
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("database config", () => {
  it("does not read the secrets when the config is loaded (e.g. by `strapi build`)", () => {
    vi.stubEnv("DATABASE_HOST", undefined);

    expect(() => config()).not.toThrow();
  });

  it("builds the connection with verified TLS", () => {
    stubDatabaseEnv("db.example.org");

    expect(resolveConnection()).toEqual({
      host: "db.example.org",
      port: 5432,
      database: "cms",
      user: "web",
      password: "p4ssw0rd",
      ssl: { rejectUnauthorized: true },
      schema: "public",
    });
  });

  it.each(["localhost", "127.0.0.1", "::1"])("connects to %s without TLS", (host) => {
    stubDatabaseEnv(host);

    expect(resolveConnection().ssl).toBe(false);
  });
});
