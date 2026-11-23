# Production image of the Strapi CMS. Build it from the repository root, because the pnpm lockfile
# and workspace live there: `pnpm build:cms:image` (docker build -f cms/Dockerfile .).
# The container needs its secrets as files under SECRETS_FILE_PATH, see cms/README.md.

FROM node:26-alpine AS base

WORKDIR /app

# NOTE: keep the pnpm version here in sync with the "packageManager" field in package.json
RUN npm install -g pnpm@12.11.2

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY cms/package.json ./cms/

FROM base AS build

RUN pnpm install --frozen-lockfile --filter @familienservice/cms

COPY cms ./cms
# Compiles config/ and src/ to dist/ and builds the admin panel to dist/build/
RUN pnpm --filter @familienservice/cms build

FROM base AS production-dependencies

RUN pnpm install --frozen-lockfile --prod --filter @familienservice/cms

FROM node:26-alpine

ENV NODE_ENV=production

WORKDIR /app

# pnpm links cms/node_modules to the packages in node_modules/.pnpm, so both keep their place
COPY --from=production-dependencies /app/node_modules ./node_modules
COPY --from=production-dependencies /app/cms/node_modules ./cms/node_modules
# package.json and tsconfig.json tell Strapi that this is a TypeScript project built to dist/
COPY --from=build /app/cms/package.json /app/cms/tsconfig.json /app/cms/favicon.png ./cms/
COPY --from=build /app/cms/dist ./cms/dist
COPY --from=build /app/cms/public ./cms/public
# Strapi expects database/migrations on start (creating it fails, the folder belongs to root)
COPY --from=build /app/cms/database ./cms/database
# Strapi stores uploaded media here (local upload provider). Not persistent: lost with the container.
RUN chown node:node ./cms/public/uploads

WORKDIR /app/cms

USER node

EXPOSE 1337

CMD ["node", "node_modules/@strapi/strapi/bin/strapi.js", "start"]
