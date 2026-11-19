FROM node:26-alpine AS build

WORKDIR /app

# NOTE: keep the pnpm version here in sync with the "packageManager" field in package.json
RUN npm install -g pnpm@12.11.2

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY web/package.json ./web/
RUN pnpm install --frozen-lockfile

COPY web ./web
RUN pnpm --filter @familienservice/web build

FROM nginx/nginx-unprivileged:1.31.9-alpine

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/web/dist /usr/share/nginx/html

EXPOSE 3000
