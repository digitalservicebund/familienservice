# Production image of the web app: the static Astro build, served by nginx. Build it from the
# repository root, because the pnpm lockfile and workspace live there: `pnpm build:web:image`
# (docker build -f web/Dockerfile .).

FROM node:26-alpine AS build

WORKDIR /app

# NOTE: keep the pnpm version here in sync with the "packageManager" field in package.json
RUN npm install -g --ignore-scripts pnpm@12.11.2

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY web/package.json ./web/
RUN pnpm install --frozen-lockfile --ignore-scripts

COPY web ./web
RUN pnpm --filter @familienservice/web build

FROM nginx/nginx-unprivileged:1.31.9-alpine

COPY web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/web/dist /usr/share/nginx/html

# The base image already runs as the unprivileged nginx user (UID 101). Setting it
# explicitly makes this visible to scanners like Sonar
USER 101

EXPOSE 3000
