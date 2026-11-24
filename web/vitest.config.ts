/// <reference types="vitest/config" />
import { fileURLToPath } from "node:url";

import { getViteConfig } from "astro/config";

// getViteConfig applies the Astro Vite plugins, so tests can import .astro components.
// `root` is set explicitly because Vitest runs from the repository root.
export default getViteConfig(
  {
    test: {
      include: ["tests/**/*.test.ts"],
    },
  },
  { root: fileURLToPath(new URL(".", import.meta.url)) },
);
