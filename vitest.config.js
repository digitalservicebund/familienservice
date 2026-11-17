import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    projects: ["web"],
    coverage: {
      provider: "v8",
      include: ["web/src/**"],
      exclude: ["**/*.d.ts"],
      // lcov is read by SonarCloud (coverage/lcov.info), text is printed to the console
      reporter: ["text", "lcov"],
    },
  },
});
