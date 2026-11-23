# Familienservice Prototype(s)

[very early stage]

A prototype of the Familienservice platform and further microfrontends that together provide information about family benefits and direct users to the relevant external application channels.

## Project structure

This repository is a [pnpm workspace](https://pnpm.io/workspaces).

- `web/`: The main application, an [Astro](https://astro.build) app. It is built as a static site and is currently what the Docker image serves (via nginx).

- `scripts/import.ts`: Import pipeline for the BAFzA data export (proof of concept). Cleans the export and converts it into a structured format; writing to the database will follow. See [`resources/dump/README.md`](resources/dump/README.md). In GitHub Actions it runs via `.github/workflows/import.yml`.

Going forward, we plan to add further microfrontends as separate packages. Each of them can then either be embedded into the web app as an [island](https://docs.astro.build/en/concepts/islands/) or run standalone. _This will follow in a separate PR._

## Getting started

### Prerequisites

- [Node.js](https://nodejs.org/en/download) 26 (version in `.nvmrc`, e.g. via [nvm](https://github.com/nvm-sh/nvm))
- [pnpm](https://pnpm.io/installation) 12
- [lefthook](https://lefthook.dev/install/) for the pre-commit hooks (lint + format)
- [Docker](https://docs.docker.com/get-docker/), only for building the production image

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

| Command                           | Action                                               |
| :-------------------------------- | :--------------------------------------------------- |
| `pnpm start`                      | Starts the web dev server at `localhost:4321`        |
| `pnpm build`                      | Builds the web app to `./web/dist/`                  |
| `pnpm build:image`                | Builds the Docker image                              |
| `pnpm start:image`                | Runs the Docker image at `localhost:3000`            |
| `pnpm test` / `pnpm test:watch`   | Runs the tests once / in watch mode with Vitest      |
| `pnpm test:coverage`              | Runs the tests and writes coverage to `./coverage/`  |
| `pnpm lint` / `pnpm lint:fix`     | Lints the code with oxlint                           |
| `pnpm format` / `pnpm format:fix` | Checks / fixes formatting with oxfmt                 |
| `pnpm typecheck`                  | Type-checks the web app and `scripts/`               |
| `pnpm import:local --input <file>` | Runs the BAFzA import locally (output in `resources/dump/out/`) |
