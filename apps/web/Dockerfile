# ----- Stage 1: Base -----
FROM node:20-alpine AS base
RUN corepack enable pnpm

# ----- Stage 2: Dependencies & Builder -----
FROM base AS builder
WORKDIR /app

# 复制 Monorepo 项目结构与代码
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY apps/web ./apps/web
COPY packages ./packages

ENV NEXT_TELEMETRY_DISABLED 1
ENV INTERNAL_API_URL http://server:8000

# 安装全量依赖并编译 Next.js 独立产物
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @investscope/web build

# ----- Stage 3: Runner -----
FROM base AS runner
WORKDIR /app

ENV NODE_ENV production
ENV NEXT_TELEMETRY_DISABLED 1
ENV PORT 3000
ENV HOSTNAME "0.0.0.0"

# 从 Builder 阶段复制精简静态资源与 standalone 引擎
COPY --from=builder /app/apps/web/public ./apps/web/public
COPY --from=builder /app/apps/web/.next/standalone ./
COPY --from=builder /app/apps/web/.next/static ./apps/web/.next/static

EXPOSE 3000

CMD ["node", "apps/web/server.js"]
