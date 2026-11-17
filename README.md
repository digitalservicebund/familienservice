# Familienservice Prototype(s)

[very early stage]

A prototype of the Familienservice platform and further microfrontends that together provide information about family benefits and direct users to the relevant external application channels.

## Project structure

This repository is a [pnpm workspace](https://pnpm.io/workspaces).

- `web/`: The main application, an [Astro](https://astro.build) app. It is built as a static site and is currently what the Docker image serves (via nginx).
- `cms/`: A [Strapi](https://strapi.io) CMS (spike) with a local PostgreSQL. The web app fetches its published content at build time when `STRAPI_URL` is set. See [cms/README.md](cms/README.md).

Going forward, we plan to add further microfrontends as separate packages. Each of them can then either be embedded into the web app as an [island](https://docs.astro.build/en/concepts/islands/) or run standalone. _This will follow in a separate PR._

## Getting started

### Prerequisites

- [Node.js](https://nodejs.org/en/download): Version 26 is required. We recommend installing it via [nvm](https://github.com/nvm-sh/nvm).
- [pnpm](https://pnpm.io/installation): Version 12.x is required. Installation instructions can be found in the pnpm docs.
- [lefthook](https://lefthook.dev/install/): Runs linting and formatting as Git pre-commit hooks. Run `lefthook install` once to activate them.

### Installation

Install the dependencies of all workspace packages from the repository root:

```sh
pnpm install
```

## Usage

All commands are run from the repository root:

| Command                                  | Action                                                                                       |
| :--------------------------------------- | :------------------------------------------------------------------------------------------- |
| `pnpm start`                             | Starts the CMS database, the CMS and the web dev server (see [cms/README.md](cms/README.md)) |
| `pnpm start:web`                         | Waits for the CMS, then starts the web dev server at `localhost:4321`                        |
| `pnpm start:cms`                         | Starts the Strapi CMS at `localhost:1337/admin` (via `op run`)                               |
| `pnpm start:cms:db` / `pnpm stop:cms:db` | Starts / stops the CMS database (PostgreSQL via Docker Compose)                              |
| `pnpm build`                             | Builds the web app and the CMS                                                               |
| `pnpm build:web`                         | Builds the web app to `./web/dist/`, with CMS content if `STRAPI_URL` is set                 |
| `pnpm build:cms`                         | Builds the CMS to `./cms/dist/`                                                              |
| `pnpm build:web:image`                   | Builds the Docker image of the web app                                                       |
| `pnpm start:web:image`                   | Runs the Docker image of the web app at `localhost:3000`                                     |
| `pnpm lint` / `pnpm lint:fix`            | Lints the code with oxlint                                                                   |
| `pnpm format` / `pnpm format:fix`        | Checks / fixes formatting with oxfmt                                                         |
| `pnpm typecheck`                         | Type-checks the web app (`.ts` and `.js` files only) and the CMS                             |
