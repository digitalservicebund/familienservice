# Familienservice CMS (Strapi spike)

A [Strapi 5](https://docs.strapi.io) instance to evaluate Strapi as the CMS for the Familienservice.
Editors maintain content here; the Astro frontend in `../familienservice` fetches the published
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


pnpm cms:db     # start PostgreSQL (docker compose)
pnpm cms:dev    # start Strapi at http://localhost:1337/admin (via op run)
```

On the first start, Strapi asks you to create the first admin user. After that, create and
**publish** a Familienleistung and build the frontend against Strapi:

```sh
STRAPI_URL=http://localhost:1337 pnpm build   # or: STRAPI_URL=http://localhost:1337 pnpm web:dev
```

`pnpm cms:db:stop` stops the database. The data stays in a Docker volume.

To start everything at once, use `pnpm start`. It starts the database, then runs Strapi
(`start:cms`) and the frontend dev server (`start:web`) in parallel. The frontend waits until
Strapi answers and starts with `STRAPI_URL` set. Ctrl+C stops Strapi and the frontend; the
database keeps running. The frontend loads the content once on start, so restart it to see
content you changed in Strapi.

## How this setup works

### Created with the official init script

```sh
npx create-strapi@5.62.0 cms --typescript --dbclient postgres --no-example \
  --no-git-init --no-install --skip-cloud --use-pnpm --no-run
```

Changes compared to the generated project:

- Package name `@familienservice/cms`; part of the root pnpm workspace. The generated
  `pnpm-workspace.yaml` was removed, its `allowBuilds` moved to the root one.
- Removed `@strapi/plugin-cloud` and the `deploy` script (we do not use Strapi Cloud).
  Telemetry is disabled in `package.json` (`strapi.telemetryDisabled`).
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

- `cms/.env.example` is committed and lists all variables with example values. For the secrets,
  the example values are 1Password references (`op://<vault>/familienservice-cms-local/<FIELD>`);
  the non-secret settings (database host, port, name, user) are plain values.
- `cms/.env` is your local copy (`cp -n cms/.env.example cms/.env`) and ignored by Git. Adjust it
  locally as needed, e.g. the vault name or a port. When the example gains new variables, copy
  them over from `cms/.env.example`.
- `pnpm cms:dev` runs `op run --env-file=.env -- strapi develop`. `op` resolves the references
  and passes the real values as environment variables to Strapi. Strapi also reads `.env` on its
  own, but values already present in the environment win. If Strapi is started without
  `op run`, `src/index.ts` aborts with a hint instead of using the `op://…` strings as secrets.
- `pnpm cms:db` starts Docker Compose directly (without `op run`). Docker Compose reads the
  `DATABASE_*` variables from `cms/.env` itself and does not resolve `op://` references.

### Database: PostgreSQL via Docker Compose

`docker-compose.yaml` runs PostgreSQL 17, reachable only on `127.0.0.1:5432`, with the data in
the volume `familienservice-cms_postgres-data`. Database name, user, password and port come from
the `DATABASE_*` variables in `cms/.env`.

PostgreSQL applies the password only when the volume is initialized. If you change it, reset the
database (this **deletes all local CMS data**):

```sh
docker compose -f cms/docker-compose.yaml down -v
```

### Content types are code

The model lives in `src/api/*/content-types/*/schema.json` and is versioned with Git. The
Content-Type Builder in the admin panel works only in development mode (`strapi develop`) and
writes these same files; commit them afterwards. In production mode (`strapi start`) the model
cannot be changed. Strapi updates the database tables from the schemas on start.

Current model (deliberately minimal): **Familienleistung** with `titel`, `slug` (generated from
`titel`), `beschreibung` and `inhalt` (Markdown). Draft & Publish is enabled.

### Permissions: public read access, published content only

- `bootstrap` in `src/index.ts` grants the **Public** role `find` and `findOne` for
  Familienleistungen on every start (only if missing). The permissions are code instead of
  clicks in the admin panel, and the frontend needs no token.
- Strapi would also answer `?status=draft` for anonymous requests and return unpublished
  drafts. `src/middlewares/public-published-only.ts` pins anonymous requests to published
  content. Requests with an API token keep `status`, e.g. for a future preview.

New content types need both: an entry in `PUBLIC_ACTIONS` in `src/index.ts` and the middleware
on their `find`/`findOne` routes.

### Connection to the frontend

`familienservice/src/content.config.ts` defines the collection `familienleistungen` with the
loader from `familienservice/src/lib/strapi-loader.ts`. It runs at build time (and when the dev
server starts), reads all published documents page by page and renders `inhalt` as Markdown.
Without `STRAPI_URL`, or if Strapi is not reachable, it logs a warning and the collection stays
empty, so CI and the Docker build work without a CMS.

Because the frontend is static, Strapi does not have to be publicly reachable. The flip side:
**publishing in Strapi only reaches the website after a new build.** Later, a Strapi webhook
could trigger that build.

## Updating Strapi

Strapi is a dependency of this project, so updating it is a code change. All `@strapi/*`
packages must always have the same version. Dependabot groups them into one pull request for
minor and patch updates and leaves out major updates.

1. Read the [release notes](https://github.com/strapi/strapi/releases) (breaking changes,
   security fixes).
2. Commit or stash your changes first, so the tool's changes show up as a separate diff. The
   tool warns about uncommitted changes and asks whether to continue.
3. Run the upgrade tool. It updates all `@strapi/*` packages, runs `pnpm install` and applies
   codemods to the code:

   ```sh
   pnpm --filter @familienservice/cms strapi:upgrade:dry   # preview the latest minor/patch update
   pnpm --filter @familienservice/cms strapi:upgrade       # apply it
   ```

   For a new major version, use `strapi:upgrade:major:dry` / `strapi:upgrade:major` and follow the migration
   guide in the Strapi docs. Back up the database first: Strapi migrates the database
   automatically on start, and that cannot easily be undone.

4. Check the result with `pnpm start`: admin panel, content in the frontend, and the parts
   that depend on Strapi internals (`src/index.ts`, `src/middlewares/public-published-only.ts`).
   `http://localhost:1337/api/familienleistungen?status=draft` must only return published content.
5. Review the diff (codemods may change code) and commit.

## Not covered yet

- Importing the crawled familienportal.de content and modelling Lebenslagen and relations
- Blocks editor instead of Markdown; German admin UI (`src/admin/app.tsx` with `locales: ["de"]`)
- Deployment: hosted PostgreSQL, upload storage (the local `public/uploads` does not suit
  containers), email provider, webhook to rebuild the frontend
- Strapi itself reports peer dependency warnings (`codemirror`, `date-fns`) of its internal
  packages; they do not come from this project.
