# Familienservice CMS (Strapi spike)

[very early stage]

A [Strapi 5](https://docs.strapi.io) instance to evaluate Strapi as the CMS for the Familienservice. Editors maintain content here; the Astro frontend in `../web` fetches the published
content at build time via the REST API.

## Getting started

Prerequisites (in addition to the ones in the root README):

- [Docker](https://docs.docker.com/get-docker/) for the local PostgreSQL

All commands run from the repository root:

```sh
pnpm install

# Once: create your local cms/.env from the example (cms/.env is not committed; -n keeps an existing one)
cp -n cms/.env.example cms/.env
# Fill the .env file with local development secrets only
# —> generate values with: `openssl rand -hex 32` (for example)


pnpm start:cms:db   # start PostgreSQL (docker compose)
pnpm start:cms      # start Strapi at http://localhost:1337/admin (via op run)
```

On the first start, Strapi asks you to create the first admin user. After that, create and **publish** a Familienleistung and build the frontend against Strapi:

```sh
STRAPI_URL=http://localhost:1337 pnpm build:web   # or the dev server: pnpm start:web
```

`pnpm stop:cms:db` stops the database. The data stays in a Docker volume.

To start everything at once, use `pnpm start`. It starts the database, then runs Strapi (`start:cms`) and the frontend dev server (`start:web`) in parallel. The frontend waits until Strapi answers and starts with `STRAPI_URL` set. The frontend loads the content once on start, so restart it to see content you changed in Strapi.

## How this setup works

### Created with the official init script

```sh
npx create-strapi@5.62.0 cms --typescript --dbclient postgres --no-example \
  --no-git-init --no-install --skip-cloud --use-pnpm --no-run
```

Changes compared to the generated project:

- Package name `@familienservice/cms`; part of the root pnpm workspace. The generated `pnpm-workspace.yaml` was removed, its `allowBuilds` moved to the root one.
- Removed `@strapi/plugin-cloud` and the `deploy` script (we do not use Strapi Cloud). Telemetry is disabled in `package.json` (`strapi.telemetryDisabled`).
- Secrets via 1Password (see below), PostgreSQL via `docker-compose.yaml`.
- Formatted with oxfmt like the rest of the repository.

### Folder structure

| Path                   | Purpose                                                                                                |
| :--------------------- | :----------------------------------------------------------------------------------------------------- |
| `config/`              | Server, admin, database, API, middleware and plugin configuration. Values come from env vars.          |
| `src/api/<type>/`      | One folder per content type: `content-types/…/schema.json` (the model), routes, controllers, services. |
| `src/middlewares/`     | Custom middlewares, referenced as `global::<file name>`.                                               |
| `src/index.ts`         | Lifecycle hooks: `register` (before init) and `bootstrap` (before start).                              |
| `src/admin/`           | Admin panel customization. The `*.example.*` files show the options (e.g. German admin UI).            |
| `database/migrations/` | Optional custom DB migrations. Strapi creates and alters tables from the schemas itself.               |
| `public/uploads/`      | Uploaded media (local provider). Not committed.                                                        |
| `types/generated/`     | TypeScript types Strapi generates from the schemas on `develop`. Not committed.                        |

### Configuration and secrets: `.env.example`, `.env` and 1Password

- `cms/.env.example` is committed and lists all variables with example values.
- `cms/.env` is your local copy (`cp -n cms/.env.example cms/.env`) and ignored by Git. Adjust it locally as needed.
- `pnpm start:cms` runs `strapi develop`. Strapi also reads `.env` on its own, but values already present in the environment win.
- `pnpm start:cms:db` starts Docker Compose directly. Docker Compose reads the `DATABASE_*` variables from `cms/.env` automatically.

### Database: PostgreSQL via Docker Compose

`docker-compose.yaml` runs PostgreSQL 17, reachable only on `127.0.0.1:5432`, with the data in the volume `familienservice-cms_postgres-data`. Database name, user, password and port come from the `DATABASE_*` variables in `cms/.env`.

PostgreSQL applies the password only when the volume is initialized. If you change it, reset the database (this **deletes all local CMS data**):

```sh
docker compose -f cms/docker-compose.yaml down -v
```

### Content types are code

The model lives in `src/api/*/content-types/*/schema.json` and is versioned with Git. The Content-Type Builder in the admin panel works only in development mode (`strapi develop`) and writes these same files. Commit them afterwards. In production mode (`strapi start`) the model cannot be changed. Strapi updates the database tables from the schemas on start.

Current model (deliberately minimal): **Familienleistung** with `titel`, `slug` (generated from `titel`), `beschreibung` and `inhalt` (Markdown). Draft & Publish is enabled.

### Permissions: public read access, published content only

- `bootstrap` in `src/index.ts` grants the **Public** role `find` and `findOne` for Familienleistungen on every start (only if missing). The permissions are code instead of clicks in the admin panel, and the frontend needs no token.
- Strapi would also answer `?status=draft` for anonymous requests and return unpublished drafts. `src/middlewares/public-published-only.ts` pins anonymous requests to published content. Requests with an API token keep `status`, e.g. for a future preview.

New content types need both: an entry in `PUBLIC_ACTIONS` in `src/index.ts` and the middleware on their `find`/`findOne` routes.

### Connection to the frontend

`web/src/content.config.ts` defines the collection `familienleistungen` with the loader from `web/src/lib/strapi-loader.ts`. It runs at build time (and when the dev server starts), reads all published documents page by page and renders `inhalt` as Markdown. Without `STRAPI_URL`, or if Strapi is not reachable, it logs a warning and the collection stays empty, so CI and the Docker build work without a CMS.

Because the frontend is static, Strapi does not have to be publicly reachable. The flip side: **publishing in Strapi only reaches the website after a new build.** Later, a Strapi webhook could trigger that build.

## Updating Strapi

Follow the official Strapi docs: [Upgrades](https://docs.strapi.io/cms/upgrades) and the [upgrade tool](https://docs.strapi.io/cms/upgrade-tool). Specific to this project:

- All `@strapi/*` packages must always have the same version. Dependabot groups them into one pull request for minor and patch updates and leaves out major updates.
- The upgrade tool is wrapped in package scripts: `strapi:upgrade` for minor and patch updates, `strapi:upgrade:major` for major updates, each with a `:dry` variant:

  ```sh
  pnpm --filter @familienservice/cms strapi:upgrade:dry   # preview the latest minor/patch update
  pnpm --filter @familienservice/cms strapi:upgrade       # apply it
  ```
