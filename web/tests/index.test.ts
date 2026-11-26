import { experimental_AstroContainer as AstroContainer } from "astro/container";
import { describe, expect, it } from "vitest";

import IndexPage from "../src/pages/index.astro";

describe("index page", () => {
  it("renders the Familienservice heading as an x-large KERN heading", async () => {
    const container = await AstroContainer.create();
    const html = await container.renderToString(IndexPage);

    expect(html).toContain('<h1 class="kern-heading-x-large">Familienservice</h1>');
  });

  it("renders the layout with the KERN header bar", async () => {
    const container = await AstroContainer.create();
    const html = await container.renderToString(IndexPage);

    expect(html).toContain('<html lang="de">');
    expect(html).toContain('<div class="kern-kopfzeile">');
    expect(html).toContain("Offizielle Website – Bundesrepublik Deutschland");
  });
});
