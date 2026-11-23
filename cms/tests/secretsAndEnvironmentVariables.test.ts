import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { getSecret } from "../src/utils/secretsAndEnvironmentVariables";

let baseDir: string;

beforeEach(() => {
  baseDir = mkdtempSync(path.join(tmpdir(), "mounted-files-"));
  writeFileSync(path.join(baseDir, "DATABASE_PASSWORD"), "from-file\n");
  vi.stubEnv("SECRETS_FILE_PATH", baseDir);
  vi.stubEnv("DATABASE_PASSWORD", "from-env");
});

afterEach(() => {
  vi.unstubAllEnvs();
  rmSync(baseDir, { recursive: true, force: true });
});

describe("getSecret in the Kubernetes cluster", () => {
  beforeEach(() => {
    vi.stubEnv("KUBERNETES_SERVICE_HOST", "10.0.0.1");
  });

  it("reads the file, not the env var, and removes the trailing line break", () => {
    expect(getSecret("DATABASE_PASSWORD")).toBe("from-file");
  });

  it("fails if SECRETS_FILE_PATH is not set", () => {
    vi.stubEnv("SECRETS_FILE_PATH", undefined);

    expect(() => getSecret("DATABASE_PASSWORD")).toThrow("SECRETS_FILE_PATH is not set");
  });

  it("fails with the file path if the file is missing", () => {
    expect(() => getSecret("DATABASE_HOST")).toThrow(path.join(baseDir, "DATABASE_HOST"));
  });

  it("fails if the file is empty", () => {
    writeFileSync(path.join(baseDir, "DATABASE_PASSWORD"), "\n");

    expect(() => getSecret("DATABASE_PASSWORD")).toThrow("is empty");
  });
});

describe("getSecret locally", () => {
  beforeEach(() => {
    vi.stubEnv("KUBERNETES_SERVICE_HOST", undefined);
  });

  it("reads the env var, not the file", () => {
    expect(getSecret("DATABASE_PASSWORD")).toBe("from-env");
  });

  it("fails with the env var name if it is not set", () => {
    vi.stubEnv("DATABASE_PASSWORD", undefined);

    expect(() => getSecret("DATABASE_PASSWORD")).toThrow("DATABASE_PASSWORD is not set");
  });

  it("fails if the env var is empty", () => {
    vi.stubEnv("DATABASE_PASSWORD", " ");

    expect(() => getSecret("DATABASE_PASSWORD")).toThrow("DATABASE_PASSWORD is not set");
  });
});
