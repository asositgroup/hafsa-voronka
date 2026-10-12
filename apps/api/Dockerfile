FROM node:24-alpine AS base
RUN corepack enable
WORKDIR /repo

FROM base AS build
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/api/package.json apps/api/
COPY packages/shared/package.json packages/shared/
RUN pnpm install --frozen-lockfile --filter @funnel/api...
COPY apps/api apps/api
COPY packages/shared packages/shared
RUN pnpm --filter @funnel/api build \
 && pnpm --filter @funnel/api deploy --prod --legacy /out

FROM node:24-alpine
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /out/node_modules node_modules
COPY --from=build /out/package.json package.json
COPY --from=build /repo/apps/api/dist dist
COPY --from=build /repo/apps/api/drizzle drizzle
USER node
EXPOSE 3001
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s CMD wget -qO- http://127.0.0.1:3001/health || exit 1
CMD ["node", "--enable-source-maps", "dist/index.js"]
