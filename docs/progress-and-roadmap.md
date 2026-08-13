# InvestScope 项目进度与路线图

本文档记录 InvestScope 项目当前的开发进度、已完成的功能清单以及后续演进计划。

---

## 📅 当前开发进度概览

当前项目状态：**P0 MVP + P1 在线数据 + P1.5 实时看盘优化已 100% 完成**。

```
[████████████████████] 100% P0 MVP 骨架与前端界面 (Next.js 16 + HeroUI v3 + TailwindCSS v4)
[████████████████████] 100% 7指标红利测温与6维胜率打分算法
[████████████████████] 100% Python FastAPI 服务与数据模型
[████████████████████] 100% AKShare / Baostock 真实在线 API 数据采集与防封降级封装
[████████████████████] 100% 本地数据库存储 (SQLite 持久化与持仓增删改查)
[████████████████████] 100% 个股 360 度体检诊断报告页 (/dividend/[code])
[████████████████████] 100% 实时看盘优化 (WebSocket QuoteHub + 防闪烁渲染)
[░░░░░░░░░░░░░░░░░░░░]   0% P2 用户系统与个人化功能
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
  - `/dividend/[code]`：个股 360 度体检报告页
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
- [x] Zustand 全局 Store (`market-store`, `dividend-store`, `portfolio-store`, `config-store`, `ui-store`, `stock-detail-store`)
- [x] 自定义 `useFetch` / `useIntervalFetch` Hooks
- [x] `ApiClient` 网络请求封装（预留 JWT Bearer 鉴权）

### 5. 后端 API & 持久化 (`server/`)
- [x] Python FastAPI 服务入口与 CORS 中间件
- [x] SQLite 数据库管理 (`storage.py`)：持仓明细持久化存储与 CRUD API
- [x] AKShare 真实 API 客户端 (`akshare_client.py`)：实时行情、10年期国债收益率数据采集与降级防护
- [x] 4 大模块路由 API (`/api/market`, `/api/dividend`, `/api/portfolio`, `/api/stock`)

### 6. 实时看盘优化 (P1.5)
- [x] **WebSocket QuoteHub** (`server/app/services/quote_hub.py`)：后端行情订阅分发中心，聚合去重 + 批量拉取 + Diff 增量推送
- [x] **WebSocket 端点** (`/ws/quotes`)：subscribe / unsubscribe 协议
- [x] **前端 `useQuoteWs` Hook**：共享 WS 连接，支持单股/多股/自选列表批量订阅，断线 3s 自动重连
- [x] **ECharts 防闪烁**：K线图/分时图使用 `React.memo` + `useMemo` + `notMerge=false` + `lazyUpdate=true`
- [x] **Store 静默刷新**：`fetchStockQuote` / `fetchStockIntraday` 仅首次加载触发 loading，后续更新不扰动全局状态

---

## 🔮 未来演进路线图

### P2 阶段：用户系统与个人化功能

> 详细设计见 [user-system-design.md](./user-system-design.md)

#### 阶段 2.1：认证基础
- [ ] 后端 `users` 表 + 注册/登录 API + JWT 鉴权中间件
- [ ] 前端 `auth-store` (zustand + persist) + 登录/注册页
- [ ] Sidebar 用户头像/昵称/退出
- [ ] 现有 holdings 数据迁移（关联默认用户）

#### 阶段 2.2：自选股
- [ ] 后端 `watchlist` 表 + CRUD API
- [ ] 前端 `watchlist-store` + 自选股列表页
- [ ] 自选股实时行情（复用 QuoteHub WebSocket）
- [ ] 个股详情页增加「加入自选」按钮

#### 阶段 2.3：多组合管理
- [ ] 后端 `portfolios` + `portfolio_holdings` 表
- [ ] 前端组合创建/切换/删除 UI
- [ ] 现有 `/portfolio` 页面适配多组合

#### 阶段 2.4：财报深度分析与业绩前瞻预估

> 详细设计见 [financial-analysis-design.md](./financial-analysis-design.md)

- [ ] **分红覆盖率与持续性**：自由现金流分红覆盖率计算 + 历年分红与支付率 ECharts 组合图
- [ ] **财务排雷雷达**：4 大爆雷风险点扫描 (利润真实度、存贷双高、商誉占比、高负债)
- [ ] **杜邦分析拆解**：ROE 驱动力树状图 + 商业模式标签 (高毛利/高周转/高杠杆)
- [ ] **财报前瞻与预估 (Nowcasting)**：业绩预告、机构一致预期提取 + 披露倒计时与超预期预警


### P3 阶段：高级策略与多端扩展
- [ ] **策略回测引擎**：红利轮动、股债动态平衡策略历史回测
- [ ] **再平衡提醒**：偏离度超阈值时推送通知
- [ ] **Electron 桌面端** (`apps/desktop`)
- [ ] **Expo 移动端** (`apps/mobile`)

