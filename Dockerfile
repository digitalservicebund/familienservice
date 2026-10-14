FROM node:26-alpine

ENV NODE_ENV=production
WORKDIR /app

COPY package.json pnpm-lock.yaml ./
# NOTE: keep the pnpm version here in sync with the "packageManager" field in package.json
RUN npm install -g pnpm@12.11.2 && pnpm install --frozen-lockfile --prod

COPY src ./src

USER node
EXPOSE 3000
CMD ["node", "src/server.ts"]
