# familienportal.de content

Content crawled from [familienportal.de](https://familienportal.de) and converted to Markdown. It serves as the data basis for the prototype.

**Crawled on:** 2026-10-20T14:23:23.307Z

The content is a snapshot and is not updated automatically. The Content may be outdated!

## How it was created

1. The page list was taken from the sitemaps linked in [robots.txt](https://familienportal.de/robots.txt), limited to the sections `familienleistungen`, `lebenslagen` and `rechner-antraege`.
2. The raw HTML of each page was downloaded.
3. The HTML was converted to Markdown offline with [cheerio](https://cheerio.js.org) and [turndown](https://github.com/mixmark-io/turndown).

During the conversion:

- Only the main content is kept. Navigation, breadcrumb, sidebar (local advice search, feedback form), contact tab and images are removed.
- Accordion questions become `##` headings with the answer below. This is how the `faq.md` pages are structured.
- The portal's tables have no header row, so the first row of each table becomes the Markdown header row.
- Links are made absolute and point to the original pages. Broken links on the portal (e.g. `href="http://"`) keep only their text.

## Structure

`markdown/` mirrors the URL paths below `https://familienportal.de/familienportal/`:

- `familienleistungen/`: Family benefits (Kindergeld, Elterngeld, Elternzeit, …)
- `lebenslagen/`: Life situations (Schwangerschaft & Geburt, Trennung, Adoption, …)
- `rechner-antraege/`: Calculators and application forms

A page with subpages exists both as a file and as a directory, e.g. `familienleistungen/elternzeit.md` and `familienleistungen/elternzeit/`.

Links to single FAQ questions (e.g. `…/kindergeld/faq/was-ist-kindergeld--124914`) have no file of their own. The answer is a section in the corresponding `faq.md`.

## Format

Each file starts with YAML frontmatter:

```yaml
---
title: "Kindergeld"
url: "https://familienportal.de/familienportal/familienleistungen/kindergeld"
description: "Das Kindergeld ist eine staatliche Familienleistung in Deutschland. …"
breadcrumb: ["Familienportal des Bundes", "Familienleistungen", "Kindergeld"]
---
```

| Field         | Description                                |
| :------------ | :----------------------------------------- |
| `title`       | First `<h1>` heading of the page           |
| `url`         | Source URL of the page                     |
| `description` | Meta description of the page               |
| `breadcrumb`  | Breadcrumb navigation path on the original |

## Rights

The content is taken from familienportal.de and is **not** covered by this repository's [MIT license](../../LICENSE.md).
