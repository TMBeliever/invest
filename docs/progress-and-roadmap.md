# InvestScope 项目进度与路线图

本文档记录 InvestScope 项目当前的开发进度、已完成的功能清单以及后续演进计划。

---

## 📅 当前开发进度概览

当前项目状态：**P0 MVP 核心框架 + P1 在线 API 与数据库持久化已 100% 完成**，全链路本地验证通过。

```
[████████████████████] 100% P0 MVP 骨架与前端界面 (Next.js 16 + HeroUI v3 + TailwindCSS v4)
[████████████████████] 100% 7指标红利测温与6维胜率打分算法
[████████████████████] 100% Python FastAPI 服务与数据模型
[████████████████████] 100% AKShare / Baostock 真实在线 API 数据采集与防封降级封装
[████████████████████] 100% 本地数据库存储 (SQLite 持久化与持仓增删改查)
[████████████████████] 100% 个股 360 度体检诊断报告页 (/dividend/[code])
```

---

## ✅ 已完成功能清单

### 1. 架构与工程化
- [x] 基于 pnpm workspace + Turborepo 的 Monorepo 项目初始化
- [x] TypeScript 全局严格类型检查支持 (`pnpm typecheck` 0 error)
- [x] Turborepo 生产构建流水线支持 (`pnpm build` 100% pass)
- [x] 国内 npm 镜像支持 (`.npmrc`)

### 2. 前端界面 (`apps/web`)
- [x] Next.js 16 (App Router) 6 大核心页面开发：
  - `/`：主仪表盘
  - `/dividend`：红利测温
  - `/dividend/[code]`：🆕 个股 360 度体检报告页
  - `/portfolio`：组合管理
  - `/market`：市场总览
  - `/settings`：系统设置
- [x] HeroUI v3.2.4 + TailwindCSS v4 主题集成
- [x] 暗色玻璃拟态 (Glassmorphism) 视觉风格与响应式可收起侧边栏
- [x] 主题切换 (深色 / 浅色模式)

### 3. 数据与计算中间层 (`packages/data`)
- [x] Zod 数据 Schema 定义 (Stock/Index/Dividend/Portfolio/Sentiment)
- [x] `calculateTemperature()` 7 指标加权红利板块测温算法
- [x] `calculateDividendScore()` 6 维度高胜率红利股评分与买卖信号算法

### 4. 状态管理 (`packages/core`)
- [x] Zustand 全局 Store (`market-store`, `dividend-store`, `portfolio-store`, `config-store`, `ui-store`)
- [x] 自定义 `useFetch` / `useIntervalFetch` Hooks
- [x] `ApiClient` 网络请求封装

### 5. 后端 API & 持久化 (`server/`)
- [x] Python FastAPI 服务入口与 CORS 中间件
- [x] 🆕 **SQLite 数据库管理 (`storage.py`)**：持仓明细持久化存储与 CRUD API
- [x] 🆕 **AKShare 真实 API 客户端 (`akshare_client.py`)**：实时行情、10年期国债收益率数据采集与降级防护
- [x] 3 大模块路由 API (`/api/market`, `/api/dividend`, `/api/portfolio`)

---

## 🔮 未来演进路线图

### P2 阶段：高级策略回测与多端扩展 (预计 2 周)
- [ ] **策略回测引擎**：支持红利轮动、股债动态平衡策略的历史回测（输出夏普比率、最大回撤、年化收益）
- [ ] **微信 / 钉钉再平衡提醒**：偏离度超过 5% 时自动发送通知
- [ ] **Electron 桌面端 (`apps/desktop`)**：打包桌面客户端
- [ ] **Expo 移动端 (`apps/mobile`)**：开发 iOS / Android 移动端应用
