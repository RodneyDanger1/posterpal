# ─── build stage ──────────────────────────────────────────────────────────────
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
# node-server preset → self-contained .output/server/index.mjs
RUN npm run build:selfhost

# ─── run stage ───────────────────────────────────────────────────────────────
FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
ENV NITRO_PORT=8080
# Media bytes (post photos, videos, Imagine stills) live on this volume, not in
# Postgres. Compose mounts a named volume here; Docker creates it otherwise.
ENV POSTERPAL_MEDIA_DIR=/data/media
RUN mkdir -p /data/media
VOLUME ["/data"]

COPY --from=build /app/package.json ./
COPY --from=build /app/package-lock.json ./
# Production deps only — pg for migrations, tsx for the worker, pglite for the
# auth adapter fallback. The Nitro server itself is fully bundled in .output.
RUN npm ci --omit=dev

COPY --from=build /app/.output ./.output
COPY --from=build /app/src ./src
COPY --from=build /app/scripts ./scripts
COPY --from=build /app/migrations ./migrations
COPY --from=build /app/tsconfig.json ./

EXPOSE 8080

# Migrate on boot (idempotent), then serve. Set VITE_AUTH_ENABLED at BUILD time
# via build:selfhost, so this image always enforces the login wall.
CMD ["sh", "-c", "node scripts/migrate.mjs && node .output/server/index.mjs"]
