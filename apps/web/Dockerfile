# ----- Stage 1: Base -----
FROM node:20-alpine AS base
RUN corepack enable pnpm

# ----- Stage 2: Dependencies -----
FROM base AS deps
WORKDIR /app

# 复制 Monorepo 项目结构与 pnpm 配置
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY apps/web/package.json ./apps/web/package.json
COPY packages/core/package.json ./packages/core/package.json
COPY packages/data/package.json ./packages/data/package.json
COPY packages/ui/package.json ./packages/ui/package.json

RUN pnpm install --frozen-lockfile

# ----- Stage 3: Builder -----
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

ENV NEXT_TELEMETRY_DISABLED 1

# 执行前端构建
RUN pnpm --filter @investscope/web build

# ----- Stage 4: Runner -----
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
