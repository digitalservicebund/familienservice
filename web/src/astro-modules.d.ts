// Without this, `tsc` (pnpm typecheck) can't resolve .astro imports in .ts files like tests.
declare module "*.astro" {
  import type { AstroComponentFactory } from "astro/runtime/server/index.js";

  const component: AstroComponentFactory;
  export default component;
}
