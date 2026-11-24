import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    projects: ["web", "cms"],
    coverage: {
      provider: "v8",
      include: ["web/src/**", "cms/src/**"],
      // cms/src/admin: admin panel examples from the Strapi generator, not part of the server code
      exclude: ["**/*.d.ts", "cms/src/admin/**"],
      // lcov is read by SonarCloud (coverage/lcov.info), text is printed to the console
      reporter: ["text", "lcov"],
    },
  },
});
