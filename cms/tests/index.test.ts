import type { Core } from "@strapi/strapi";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import app from "../src/index";

function registerWithFakeStrapi() {
  const strapi = { config: { set: vi.fn() }, server: { app: { keys: undefined } } };
  app.register({ strapi: strapi as unknown as Core.Strapi });
  return {
    config: Object.fromEntries(strapi.config.set.mock.calls),
    appKeys: strapi.server.app.keys,
  };
}

beforeEach(() => {
  // Outside Kubernetes, getSecret reads env vars (see src/utils/secretsAndEnvironmentVariables.ts).
  vi.stubEnv("KUBERNETES_SERVICE_HOST", undefined);
  vi.stubEnv("APP_KEYS", "key-a, key-b");
  vi.stubEnv("ADMIN_JWT_SECRET", "admin-jwt-secret");
  vi.stubEnv("API_TOKEN_SALT", "api-token-salt");
  vi.stubEnv("TRANSFER_TOKEN_SALT", "transfer-token-salt");
  vi.stubEnv("ENCRYPTION_KEY", "encryption-key");
  vi.stubEnv("JWT_SECRET", "jwt-secret");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("register", () => {
  it("sets Strapi's secrets in the config", () => {
    expect(registerWithFakeStrapi().config).toEqual({
      "server.app.keys": ["key-a", "key-b"],
      "admin.auth.secret": "admin-jwt-secret",
      "admin.apiToken.salt": "api-token-salt",
      "admin.transfer.token.salt": "transfer-token-salt",
      "admin.secrets.encryptionKey": "encryption-key",
      "plugin::users-permissions.jwtSecret": "jwt-secret",
    });
  });

  it("sets the app keys on the Koa app, which Strapi creates before register", () => {
    expect(registerWithFakeStrapi().appKeys).toEqual(["key-a", "key-b"]);
  });

  it("fails if a secret is missing", () => {
    vi.stubEnv("JWT_SECRET", undefined);

    expect(() => registerWithFakeStrapi()).toThrow("JWT_SECRET is not set");
  });

  it("fails if an env var still holds a 1Password reference", () => {
    vi.stubEnv("ADMIN_JWT_SECRET", "op://vault/item/field");

    expect(() => registerWithFakeStrapi()).toThrow(
      "Unresolved 1Password references in ADMIN_JWT_SECRET",
    );
  });
});
