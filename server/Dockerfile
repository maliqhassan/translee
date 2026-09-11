# Transee translation backend.
#
# Two stages so the runtime image carries no TypeScript, no dev dependencies
# and no source: only the compiled output and the language table it reads at
# boot. The image holds no credential — the provider key is supplied by the
# hosting platform as an environment variable at run time, never baked in.

FROM node:22-alpine AS build
WORKDIR /app

# Dependencies first, so a source-only change does not reinstall them.
COPY server/package.json server/package-lock.json ./
RUN npm ci

COPY server/tsconfig.json ./
COPY server/src ./src
# The language table is generated into the repo root and read at boot.
COPY shared ../shared

RUN npm run build


FROM node:22-alpine AS runtime
WORKDIR /app

ENV NODE_ENV=production

COPY server/package.json server/package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=build /app/dist ./dist
COPY shared ../shared

# Drops root; the process only ever needs to read its own files and listen.
USER node

# Matches the server's default. The platform usually overrides it with $PORT.
EXPOSE 8787

# No health check baked in: platforms provide their own, and GET /health is
# already there for them to call. It answers without touching the provider.
CMD ["node", "dist/index.js"]
