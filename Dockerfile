# Multi-stage build for a self-hosted (VPS) deployment. Vercel deployments
# do not use this file — Vercel builds directly from the repo.
#
# Build:
#   docker build -t proxy-pull-planner .
# Run (real secrets injected at runtime, never baked into the image):
#   docker run -p 3000:3000 \
#     -e DATABASE_URL=... -e DIRECT_URL=... -e TELEGRAM_BOT_TOKEN=... \
#     -e NEXT_PUBLIC_APP_URL=... [-e CRON_SECRET=...] \
#     proxy-pull-planner
#
# Run `npx prisma migrate deploy` against the real DATABASE_URL/DIRECT_URL
# separately (e.g. as a one-off release step) before starting the
# container for the first time — this image does not run migrations itself.

FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:22-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# `next build` statically imports every route module to collect page data,
# which imports src/lib/db/prisma.ts — its module-level PrismaClient
# constructor throws if DATABASE_URL is unset. A syntactically valid
# placeholder is enough: no DB connection is actually opened at build time,
# and `prisma generate` itself needs no connection at all. Never put real
# credentials here — this stage's env is not carried into the final image.
ENV DATABASE_URL="postgresql://build:build@localhost:5432/build?schema=public"
ENV DIRECT_URL="postgresql://build:build@localhost:5432/build?schema=public"
ENV NODE_ENV=production
ENV BUILD_STANDALONE=true
RUN npx prisma generate
RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs

# Only the standalone server + traced deps + static assets — no .env, no
# full node_modules, no source. See next.config.ts for BUILD_STANDALONE.
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000
CMD ["node", "server.js"]
