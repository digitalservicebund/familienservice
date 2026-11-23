import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    projects: [
      "web",
      "cms",
      // scripts/ has no package of its own, so its project is defined inline.
      {
        test: {
          name: "scripts",
          include: ["scripts/tests/**/*.test.ts"],
          environment: "node",
        },
      },
    ],
    coverage: {
      provider: "v8",
      include: ["web/src/**", "cms/src/**", "scripts/*.ts"],
      // cms/src/admin: admin panel examples from the Strapi generator, not part of the server code
      exclude: ["**/*.d.ts", "cms/src/admin/**"],
      // lcov is read by SonarCloud (coverage/lcov.info), text is printed to the console
      reporter: ["text", "lcov"],
    },
  },
});
