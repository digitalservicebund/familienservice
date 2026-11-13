FROM node:26-alpine AS build

WORKDIR /app

# NOTE: keep the pnpm version here in sync with the "packageManager" field in package.json
RUN npm install -g pnpm@12.11.2

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY familienservice/package.json ./familienservice/
RUN pnpm install --frozen-lockfile

COPY familienservice ./familienservice
RUN pnpm --filter @familienservice/web build

FROM nginxinc/nginx-unprivileged:stable-alpine

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/familienservice/dist /usr/share/nginx/html

EXPOSE 3000
