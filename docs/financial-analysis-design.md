# 财报深度分析与业绩前瞻预估设计文档

本文档详细说明 InvestScope 系统在**财报深度分析**、**财务排雷雷达**、**杜邦分析拆解**以及**财报前瞻预估（Earnings Nowcasting）**方面的功能规划、算法设计、数据流架构与 UI 展示规范。

---

## 1. 设计背景与业务目标

### 1.1 当前痛点
- **伪高股息陷阱**：部分股票股息率高（如 8%~10%），但实际上是通过借债、变卖资产分红，或处于周期行业顶部，分红不可持续，买入后赚了股息赔了本金。
- **财务爆雷风险**：普通投资者看不懂动辄上百页的财报，容易踩中商誉减值、虚假利润（存贷双高/应收账款倒挂）等雷区。
- **财报披露滞后**：年报/半年报披露存在 1~3 个月的时间差，投资者无法在财报公布前评估业绩是超预期还是低于预期。

### 1.2 解决目标
1. **真假红利识别**：通过自由现金流与分红覆盖率，精准筛选出“真现金流分红”的优质公司。
2. **自动化排雷**：扫描四大财务异常指标，给股票输出“绿灯/黄灯/红灯”安全标签。
3. **商业模式剖析**：基于杜邦分析法自动拆解 ROE 驱动因素（产品壁垒型/高周转型/高杠杆型）。
4. **业绩前瞻预估**：在正式财报披露前 1~2 个月，通过业绩预告、机构一致预期与外推模型，预测业绩超预期/不及预期趋势。

---

## 2. 系统架构与数据流设计

```
┌────────────────────────────────────────────────────────────────────────┐
│                        apps/web  (Next.js)                             │
│      /dividend/[code] 个股详情页 (新增「分红覆盖/排雷雷达/杜邦/前瞻」Tab) │
└──────────────────────────────────┬─────────────────────────────────────┘
                                   │
┌──────────────────────────────────▼─────────────────────────────────────┐
│                       packages/core (Zustand)                          │
│ useStockDetailStore (扩展 fetchFinancialHealth, fetchEarningsPreview)  │
└──────────────────────────────────┬─────────────────────────────────────┘
                                   │
┌──────────────────────────────────▼─────────────────────────────────────┐
│                      packages/data (计算引擎)                          │
│  - calculateDividendSustainability() : 现金流分红覆盖率                │
│  - calculateFinancialHealthScore()   : 4大排雷算法                     │
│  - calculateDuPontBreakdown()         : 杜邦分析拆解                   │
│  - calculateRunRateForecast()         : 季度 Run-Rate 预估模型         │
└──────────────────────────────────┬─────────────────────────────────────┘
                                   │
┌──────────────────────────────────▼─────────────────────────────────────┐
│                     server/app (FastAPI + AKShare)                     │
│  - 数据库缓存: SQLite financial_cache 表 (按季度缓存财报三大表)          │
│  - API 路由: /api/stock/financial/health/{code}                       │
│              /api/stock/financial/dividend/{code}                     │
│              /api/stock/financial/dupont/{code}                       │
│              /api/stock/financial/preview/{code}                      │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 3. 核心计算算法与分析模型

所有算法均为纯 JS/TS 函数，部署在 `packages/data` 包中，确保前端与后端可复用。

### 3.1 现金流分红覆盖率与持续性算法

评价公司是否有真实现金流支撑分红，避免“吃老本分红”。

$$\text{自由现金流覆盖率} = \frac{\text{经营活动现金流净额} - \text{资本开支 (CapEx)}}{\text{现金分红总额}} \times 100\%$$

$$\text{股利支付率} = \frac{\text{现金分红总额}}{\text{归母净利润}} \times 100\%$$

```typescript
export interface DividendSustainabilityResult {
  coverageRatio: number;      // 自由现金流覆盖率 (%)
  payoutRatio: number;        // 股利支付率 (%)
  consecutiveYears: number;   // 连续分红年数
  status: "HEALTHY" | "WARNING" | "DANGEROUS";
  message: string;
}

export function calculateDividendSustainability(
  freeCashFlow: number,
  totalDividends: number,
  netProfit: number,
  consecutiveYears: number
): DividendSustainabilityResult {
  const coverageRatio = totalDividends > 0 ? (freeCashFlow / totalDividends) * 100 : 0;
  const payoutRatio = netProfit > 0 ? (totalDividends / netProfit) * 100 : 0;

  let status: "HEALTHY" | "WARNING" | "DANGEROUS" = "HEALTHY";
  let message = "分红由充足的自由现金流覆盖，安全度极高";

  if (payoutRatio > 100) {
    status = "DANGEROUS";
    message = "分红金额超过当期净利润（吃老本分红），不可持续";
  } else if (coverageRatio < 100) {
    status = "WARNING";
    message = "自由现金流不足以完全覆盖分红，可能依赖借债或处置资产分红";
  }

  return { coverageRatio, payoutRatio, consecutiveYears, status, message };
}
```

---

### 3.2 四大财务排雷算法 (Financial Health Scan)

针对 A 股最常见的 4 种爆雷类型建立检测机制：

| 排雷项 | 检测指标与逻辑 | 危险阈值 | 风险说明 |
|:---|:---|:---|:---|
| **1. 利润真实度** | $\frac{\text{经营现金流净额}}{\text{归母净利润}}$ | $< 0.8$ | 利润全堆在应收账款（欠条），未变成真现金 |
| **2. 存贷双高风险** | $\text{货币资金} \text{ 与 } \text{高额有息负债/高利息支出共存}$ | 现金与有息负债均 $> 30\%$ 且利息支出异常 | 疑似账面现金造假（如康美药业） |
| **3. 商誉爆发预警** | $\frac{\text{商誉}}{\text{净资产}}$ | $> 30\%$ | 随时可能发生大额商誉减值砸盘 |
| **4. 财务杠杆风险** | 资产负债率 | $> 75\%$ (非金融行业) | 负债过重，抗风险能力弱 |

---

### 3.3 杜邦分析拆解模型 (DuPont Analysis)

将 ROE 拆解为三大驱动力，判断公司的商业模式：

$$\text{ROE} = \text{销售净利率} \times \text{资产周转率} \times \text{权益乘数}$$

$$\text{ROE} = \left(\frac{\text{净利润}}{\text{营业收入}}\right) \times \left(\frac{\text{营业收入}}{\text{总资产}}\right) \times \left(\frac{\text{总资产}}{\text{净资产}}\right)$$

根据三项指标的比重，自动输出商业模式标签：
- **高净利率驱动（高毛利护城河）**：净利率 $> 20\%$，周转率中等（如贵州茅台、片仔癀）。
- **高周转率驱动（高效运营型）**：资产周转率 $> 1.2$ 次（如零售/物流/快消）。
- **高杠杆驱动（杠杆依赖型）**：权益乘数 $> 3.5$（需警惕高负债风险）。

---

### 3.4 财报前瞻与预估模型 (Earnings Nowcasting)

在正式财报发布前，通过 **3 种数据通道** 组合预估下一期业绩：

1. **通道一：官方业绩预告区间**
   - 提取 AKShare `stock_yjyg_em()`，直接获取官方发布的预盈/预亏上下限。
2. **通道二：券商卖方一致预期 (Consensus)**
   - 提取 AKShare `stock_em_analyst_predict`，计算所有分析师对该股票最新季度的预测中位数，并对比上月变动方向（上调/下调）。
3. **通道三：Run-Rate 季节性外推模型**
   - 若前 3 个季度财报已出，预测 Q4 全年：
     $$\text{预估全年净利润} = \frac{\text{前三季度实际净利润}}{1 - \text{过去5年Q4净利润平均占比}}$$

---

## 4. 前端 UI 与交互设计 (个股详情页扩展)

在 `/dividend/[code]` 页面中，在现有的 K 线/分时图下方新增 4 个诊断选项卡：

```
┌────────────────────────────────────────────────────────────────────────┐
│  [ 📈 行情与K线 ]  [ 💰 分红与现金流 ]  [ 🛡️ 财务排雷 ]  [ 🌳 杜邦分析 ]  [ 🔮 财报前瞻 ]  │
└────────────────────────────────────────────────────────────────────────┘
```

### 4.1 「💰 分红与现金流」 Tab 布局
- **顶部指标卡**：连续分红年数 | 自由现金流覆盖率 (%) | 3年平均股息率 (%)
- **ECharts 图表**：
  - 双 Y 轴图：柱状图表示每 10 股派现金额，折线图表示股利支付率。
- **健康度 Alert 提示框**：根据 `status` 输出绿/黄/红风险提示。

### 4.2 「🛡️ 财务排雷雷达」 Tab 布局
- **4 大排雷扫描网格 (Grid Cards)**：
  - 利润真实度 🟢 (经营现金流/净利润 = 1.15)
  - 存贷双高 🟢 (无存贷异常)
  - 商誉占比 🟡 (商誉/净资产 = 12%)
  - 负债安全 🟢 (资产负债率 = 42%)
- **核心财务趋势图**：近 5 年营收、净利润、经营现金流对比。

### 4.3 「🌳 杜邦分析」 Tab 布局
- **树状拆解卡片**：
  - 顶层：ROE (%)
  - 下层三分路：净利率 (%)、资产周转率 (次)、权益乘数 (倍)
- **商业模式诊断标签**：自动打上【高毛利护城河型】等标签。

### 4.4 「🔮 财报前瞻」 Tab 布局
- **下一期财报前瞻卡片**：
  - 披露倒计时（如：“距 2025 年报披露还有 18 天”）
  - 官方预告区间与机构一致预期对比条
  - 预估评级标签：**【超预期】** / **【符合预期】** / **【低于预期】**

---

## 5. 后端 API 设计与数据库缓存

### 5.1 数据库缓存表 (`server/app/data/storage.py`)

财报数据按季度更新，建立本地 SQLite 缓存，避免频繁调用在线 API 造成延迟。

```sql
CREATE TABLE IF NOT EXISTS financial_cache (
    code        TEXT NOT NULL,
    report_date TEXT NOT NULL,      -- e.g. "2024-12-31"
    data_type   TEXT NOT NULL,      -- "balance", "income", "cashflow", "indicator", "dividend"
    json_content TEXT NOT NULL,     -- 预加工后的 JSON 缓存
    updated_at  TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (code, report_date, data_type)
);
```

### 5.2 新增 API 路由 (`server/app/api/financial.py`)

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/stock/financial/dividend-coverage/{code}` | 获取分红历史与现金流覆盖率 |
| GET | `/api/stock/financial/health-scan/{code}` | 获取 4 大财务排雷扫描结果 |
| GET | `/api/stock/financial/dupont/{code}` | 获取近 5 年杜邦分析拆解数据 |
| GET | `/api/stock/financial/earnings-preview/{code}` | 获取下一期财报前瞻与预估数据 |

---

## 6. 实施路径规划

1. **阶段 1：分红覆盖率与现金流分析（包含后端缓存与前端 Tab 1）**
2. **阶段 2：财务排雷雷达与杜邦分析（包含 Tab 2 与 Tab 3）**
3. **阶段 3：财报前瞻预估（包含业绩预告/一致预期接口与 Tab 4）**
