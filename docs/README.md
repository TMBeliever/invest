# InvestScope 项目文档中心

欢迎使用 **InvestScope** 投资决策平台的官方开发与架构文档。

InvestScope 是一个针对 **200万资产、A股为主、目标10%年化稳健增值** 的量化辅助平台。通过数据驱动的投资组合管理与红利胜率模型，帮助投资者降低错误决策频率，实现长期复利增长。

---

## 📚 文档目录

| 文档名称 | 内容概要 |
|:---|:---|
| 📐 [系统架构与设计 (architecture.md)](./architecture.md) | Monorepo 目录结构、包依赖规则、HeroUI v3 视图设计、Zustand 状态管理与 API 数据流 |
| 🌡️ [红利测温与资产配置模型 (dividend-model.md)](./dividend-model.md) | 7指标板块测温算法、6维度高胜率红利股评分模型、200万核心-卫星资产配置策略 |
| 🚩 [项目进度与路线图 (progress-and-roadmap.md)](./progress-and-roadmap.md) | 当前 P0 MVP 实现完成度、已完成功能列表、在线数据源对接与未来 P1-P3 迭代规划 |

---

## 🚀 快速启动指南

### 1. 前端服务 (Next.js 16 + HeroUI v3)
```bash
cd /Users/l/files/self/invest-scope
pnpm dev:web
# 浏览器访问: http://localhost:3001
```

### 2. 后端服务 (Python FastAPI + AKShare)
```bash
cd /Users/l/files/self/invest-scope/server
./venv/bin/python -m uvicorn app.main:app --reload --port 8000
# API Swagger 文档: http://localhost:8000/docs
```

### 3. 类型检查与构建
```bash
pnpm typecheck  # TypeScript 全局检查
pnpm build      # 生产环境构建
```
