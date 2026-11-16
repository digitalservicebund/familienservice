# Familienservice Prototype(s)

[very early stage]

A prototype of the Familienservice platform and further microfrontends that together provide information about family benefits and direct users to the relevant external application channels.

## Project structure

This repository is a [pnpm workspace](https://pnpm.io/workspaces).

- `familienservice/`: The main application, an [Astro](https://astro.build) app. It is built as a static site and is currently what the Docker image serves (via nginx).
- `cms/`: A [Strapi](https://strapi.io) CMS (spike) with a local PostgreSQL. The familienservice app fetches its published content at build time when `STRAPI_URL` is set. See [cms/README.md](cms/README.md).

Going forward, we plan to add further microfrontends as separate packages. Each of them can then either be embedded into the familienservice app as an [island](https://docs.astro.build/en/concepts/islands/) or run standalone. _This will follow in a separate PR._

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

| Command                            | Action                                                                                                          |
| :--------------------------------- | :-------------------------------------------------------------------------------------------------------------- |
| `pnpm start`                       | Starts everything: the CMS database, Strapi and then the familienservice dev server with content from Strapi    |
| `pnpm web:dev`                     | Starts only the familienservice dev server at `localhost:4321` (without CMS content unless `STRAPI_URL` is set) |
| `pnpm build`                       | Builds the familienservice app to `./familienservice/dist/`                                                     |
| `pnpm build:image`                 | Builds the Docker image                                                                                         |
| `pnpm start:image`                 | Runs the Docker image at `localhost:3000`                                                                       |
| `pnpm lint` / `pnpm lint:fix`      | Lints the code with oxlint                                                                                      |
| `pnpm format` / `pnpm format:fix`  | Checks / fixes formatting with oxfmt                                                                            |
| `pnpm typecheck`                   | Type-checks the familienservice app (`.ts` and `.js` files only) and the CMS (with its own TypeScript 5)        |
| `pnpm cms:db` / `pnpm cms:db:stop` | Starts / stops the CMS database (PostgreSQL via Docker Compose)                                                 |
| `pnpm cms:dev`                     | Starts the Strapi CMS at `localhost:1337/admin`                                                                 |

`pnpm start` and the `cms:*` commands additionally need Docker and the [1Password CLI](https://developer.1password.com/docs/cli/get-started/). Details: [cms/README.md](cms/README.md).
