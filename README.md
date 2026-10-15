# Familienservice Prototype(s)

[very early stage]

A prototype of the Familienservice platform and further microfrontends that together provide information about family benefits and direct users to the relevant external application channels.

## Project structure

This repository is a [pnpm workspace](https://pnpm.io/workspaces).

- `familienservice/`: The main application, an [Astro](https://astro.build) app. It is built as a static site and is currently what the Docker image serves (via nginx).

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

| Command                           | Action                                                           |
| :-------------------------------- | :--------------------------------------------------------------- |
| `pnpm start`                      | Starts the familienservice dev server at `localhost:4321`        |
| `pnpm build`                      | Builds the familienservice app to `./familienservice/dist/`      |
| `pnpm build:image`                | Builds the Docker image                                          |
| `pnpm start:image`                | Runs the Docker image at `localhost:3000`                        |
| `pnpm lint` / `pnpm lint:fix`     | Lints the code with oxlint                                       |
| `pnpm format` / `pnpm format:fix` | Checks / fixes formatting with oxfmt                             |
| `pnpm typecheck`                  | Type-checks the familienservice app (`.ts` and `.js` files only) |
