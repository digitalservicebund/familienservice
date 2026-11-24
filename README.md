# Familienservice Prototype(s)

[very early stage]

A prototype of the Familienservice platform and further microfrontends that together provide information about family benefits and direct users to the relevant external application channels.

## Project structure

This repository is a [pnpm workspace](https://pnpm.io/workspaces).

- `web/`: The main application, an [Astro](https://astro.build) app. It is built as a static site and served via nginx from the Docker image `familienservice-web`, which the pipeline deploys to staging.
- `cms/`: A [Strapi](https://strapi.io) CMS (spike) with a PostgreSQL. It has no content types yet and is not yet connected to the web app. The pipeline deploys its Docker image `familienservice-cms` to staging together with the web app.
- `resources/familienportal/`: Content crawled from [familienportal.de](https://familienportal.de) as Markdown, used as the data basis for the prototype. See its [README](resources/familienportal/README.md) for details.

Going forward, we plan to add further microfrontends as separate packages. Each of them can then either be embedded into the web app as an [island](https://docs.astro.build/en/concepts/islands/) or run standalone. _This will follow in a separate PR._

## Getting started

### Prerequisites

- [Node.js](https://nodejs.org/en/download) 26 (version in `.nvmrc`, e.g. via [nvm](https://github.com/nvm-sh/nvm))
- [pnpm](https://pnpm.io/installation) 12
- [lefthook](https://lefthook.dev/install/) for the pre-commit hooks (lint + format)
- [Docker](https://docs.docker.com/get-docker/) for the local CMS database and for building the production images

### Setup

```sh
git clone https://github.com/digitalservicebund/familienservice.git
cd familienservice
nvm install       # Node version from .nvmrc
pnpm install
lefthook install
pnpm start        # http://localhost:4321
```

Run `pnpm test`, `pnpm lint`, `pnpm format` and `pnpm typecheck` to check your changes.

## Usage

All commands are run from the repository root:

| Command                                  | Action                                                                                       |
| :--------------------------------------- | :------------------------------------------------------------------------------------------- |
| `pnpm start`                             | Starts the CMS database, the CMS and the web dev server (see [cms/README.md](cms/README.md)) |
| `pnpm start:web`                         | Starts the web dev server at `localhost:4321`                                                |
| `pnpm start:cms`                         | Starts the Strapi CMS at `localhost:1337/admin` (via `op run`)                               |
| `pnpm start:cms:db` / `pnpm stop:cms:db` | Starts / stops the CMS database (PostgreSQL via Docker Compose)                              |
| `pnpm build`                             | Builds the web app and the CMS                                                               |
| `pnpm build:web`                         | Builds the web app to `./web/dist/`                                                          |
| `pnpm build:cms`                         | Builds the CMS to `./cms/dist/`                                                              |
| `pnpm build:web:image`                   | Builds the Docker image of the web app                                                       |
| `pnpm start:web:image`                   | Runs the Docker image of the web app at `localhost:3000`                                     |
| `pnpm build:cms:image`                   | Builds the Docker image of the CMS (see [cms/README.md](cms/README.md))                      |
| `pnpm test` / `pnpm test:watch`          | Runs the tests once / in watch mode with Vitest                                              |
| `pnpm test:coverage`                     | Runs the tests and writes coverage to `./coverage/`                                          |
| `pnpm lint` / `pnpm lint:fix`            | Lints the code with oxlint                                                                   |
| `pnpm format` / `pnpm format:fix`        | Checks / fixes formatting with oxfmt                                                         |
| `pnpm typecheck`                         | Type-checks the web app (`.ts` and `.js` files only) and the CMS                             |
