import { z } from "zod";

// ============================================================
// 股票行情
// ============================================================

export const StockQuoteSchema = z.object({
  code: z.string(),
  name: z.string(),
  price: z.number(),
  change: z.number(),
  changePct: z.number(),
  volume: z.number(),
  amount: z.number(),
  open: z.number(),
  high: z.number(),
  low: z.number(),
  prevClose: z.number(),
  pe: z.number().nullable(),
  pb: z.number().nullable(),
  dividendYield: z.number().nullable(),
  totalMarketCap: z.number().nullable(),
  circulatingMarketCap: z.number().nullable().optional(),
  turnoverRate: z.number().nullable().optional(),
  amplitude: z.number().nullable().optional(),
  limitUp: z.number().nullable().optional(),
  limitDown: z.number().nullable().optional(),
  isTrading: z.boolean().optional(),
  timestamp: z.string(),
});
export type StockQuote = z.infer<typeof StockQuoteSchema>;

// ============================================================
// 日 K 线数据点
// ============================================================

export const KlinePointSchema = z.object({
  date: z.string(),
  open: z.number(),
  high: z.number(),
  low: z.number(),
  close: z.number(),
  volume: z.number(),
  amount: z.number().optional(),
  ma5: z.number().optional(),
  ma20: z.number().optional(),
  ma60: z.number().optional(),
});
export type KlinePoint = z.infer<typeof KlinePointSchema>;

// ============================================================
// 分时数据点
// ============================================================
export const IntradayTickSchema = z.object({
  time: z.string(),
  price: z.number(),
  changePct: z.number(),
  volume: z.number(),
  avgPrice: z.number(),
});
export type IntradayTick = z.infer<typeof IntradayTickSchema>;

// ============================================================
// 差异化估值通道数据点
// ============================================================

export const ValuationCorridorPointSchema = z.object({
  date: z.string(),
  price: z.number(),
  pe20: z.number(),  // 极低估 20% 分位价格线
  pe50: z.number(),  // 中性 50% 分位价格线
  pe80: z.number(),  // 偏高估 80% 分位价格线
});
export type ValuationCorridorPoint = z.infer<typeof ValuationCorridorPointSchema>;

// ============================================================
// 智能搜索匹配
// ============================================================

export const StockSearchResultSchema = z.object({
  code: z.string(),
  name: z.string(),
  pinyin: z.string(),
  industry: z.string(),
});
export type StockSearchResult = z.infer<typeof StockSearchResultSchema>;

// ============================================================
// 指数行情
// ============================================================

export const IndexQuoteSchema = z.object({
  code: z.string(),
  name: z.string(),
  price: z.number(),
  change: z.number(),
  changePct: z.number(),
  volume: z.number().optional(),
  amount: z.number().optional(),
  timestamp: z.string().optional(),
});
export type IndexQuote = z.infer<typeof IndexQuoteSchema>;

export const MarketOverviewSchema = z.object({
  indices: z.array(IndexQuoteSchema),
  totalAmount: z.number(),
  bondYield10y: z.number(),
  avgDividendYield: z.number(),
  riskPremiumRatio: z.number(),
  sectorLeaders: z.array(z.object({
    code: z.string(),
    name: z.string(),
    price: z.number(),
    changePct: z.number(),
    dividendYield: z.number().nullable(),
    pe: z.number().nullable(),
    industry: z.string(),
  })),
  updatedAt: z.string(),
});
export type MarketOverview = z.infer<typeof MarketOverviewSchema>;

export const IndexConstituentSchema = z.object({
  code: z.string(),
  name: z.string(),
  weight: z.string(),
  price: z.number(),
  changePct: z.number(),
  dividendYield: z.number().nullable().optional(),
  pe: z.number().nullable().optional(),
});
export type IndexConstituent = z.infer<typeof IndexConstituentSchema>;

export const IndexDetailSchema = z.object({
  code: z.string(),
  name: z.string(),
  price: z.number(),
  change: z.number(),
  changePct: z.number(),
  high: z.number(),
  low: z.number(),
  amount: z.number(),
  pe: z.number().nullable().optional(),
  dividendYield: z.number().nullable().optional(),
  bondYield10y: z.number().optional(),
  riskPremium: z.number().optional(),
  valuationPercentile: z.object({
    pePercentile: z.number(),
    pbPercentile: z.number(),
    dividendYieldPercentile: z.number(),
    zone: z.string(),
    label: z.string(),
  }).optional(),
  profile: z.object({
    publisher: z.string(),
    baseDate: z.string(),
    basePoint: z.number(),
    description: z.string(),
  }),
  constituents: z.array(IndexConstituentSchema),
  trackingEtfs: z.array(z.object({
    code: z.string(),
    name: z.string(),
    price: z.number(),
    changePct: z.number(),
    turnover: z.string(),
  })),
  updatedAt: z.string(),
});
export type IndexDetail = z.infer<typeof IndexDetailSchema>;

// ============================================================
// 红利股评分
// ============================================================

export const DividendDimensionsSchema = z.object({
  dividendStability: z.number().min(0).max(100),
  valuationSafety: z.number().min(0).max(100),
  fundamentalQuality: z.number().min(0).max(100),
  technicalTrend: z.number().min(0).max(100),
  historicalWinRate: z.number().min(0).max(100),
  institutionalRecognition: z.number().min(0).max(100),
});
export type DividendDimensions = z.infer<typeof DividendDimensionsSchema>;

export const WinRateItemSchema = z.object({
  winRate: z.number(),
  avgReturn: z.string(),
  maxDrawdown: z.string(),
});
export type WinRateItem = z.infer<typeof WinRateItemSchema>;

export const DividendStockSchema = z.object({
  code: z.string(),
  name: z.string(),
  overallScore: z.number().min(0).max(100),
  temperature: z.number().min(0).max(100),
  dividendYield: z.number().nullable(),
  dimensions: DividendDimensionsSchema,
  signal: z.enum(["STRONG_BUY", "BUY", "HOLD", "SELL", "STRONG_SELL"]),
  winRates: z.object({
    oneYear: z.union([z.number(), WinRateItemSchema]),
    twoYear: z.union([z.number(), WinRateItemSchema]),
    threeYear: z.union([z.number(), WinRateItemSchema]),
  }),
  pe: z.number().nullable(),
  pb: z.number().nullable(),
  roe: z.number().nullable(),
  consecutiveDividendYears: z.number().nullable().optional(),
  industry: z.string(),
  highlights: z.array(z.string()).optional(),
  risks: z.array(z.string()).optional(),
});
export type DividendStock = z.infer<typeof DividendStockSchema>;

// ============================================================
// 红利板块温度
// ============================================================

export const DividendTemperatureSchema = z.object({
  temperature: z.number().min(0).max(100),
  zone: z.enum(["FREEZING", "COOL", "NEUTRAL", "WARM", "HOT"]),
  indicators: z.object({
    pePercentile: z.number(),
    dividendYield: z.number(),
    yieldVsBondRatio: z.number(),
    excessReturn60d: z.number(),
    etfFlowScore: z.number(),
    breakNetRatio: z.number(),
    northboundChange: z.number(),
  }),
  suggestion: z.string(),
  updatedAt: z.string(),
});
export type DividendTemperature = z.infer<typeof DividendTemperatureSchema>;

// ============================================================
// 组合持仓
// ============================================================

export const PortfolioHoldingSchema = z.object({
  id: z.string(),
  code: z.string(),
  name: z.string(),
  category: z.enum(["CORE_DIVIDEND", "CORE_BOND", "SATELLITE_INDEX", "SATELLITE_SECTOR", "RESERVE_CASH", "RESERVE_GOLD"]),
  shares: z.number(),
  costPrice: z.number(),
  currentPrice: z.number(),
  marketValue: z.number(),
  profitLoss: z.number(),
  profitLossPct: z.number(),
  weight: z.number(),
});
export type PortfolioHolding = z.infer<typeof PortfolioHoldingSchema>;

export const PortfolioSummarySchema = z.object({
  totalAssets: z.number(),
  totalProfitLoss: z.number(),
  totalProfitLossPct: z.number(),
  annualizedReturn: z.number().nullable(),
  holdings: z.array(PortfolioHoldingSchema),
  allocation: z.object({
    core: z.number(),
    satellite: z.number(),
    reserve: z.number(),
  }),
  targetAllocation: z.object({
    core: z.number().default(0.6),
    satellite: z.number().default(0.3),
    reserve: z.number().default(0.1),
  }),
});
export type PortfolioSummary = z.infer<typeof PortfolioSummarySchema>;

// ============================================================
// 再平衡信号
// ============================================================

export const RebalanceSignalSchema = z.object({
  type: z.enum(["REBALANCE", "ADD", "REDUCE", "WARNING"]),
  category: z.string(),
  currentWeight: z.number(),
  targetWeight: z.number(),
  deviation: z.number(),
  message: z.string(),
  priority: z.enum(["HIGH", "MEDIUM", "LOW"]),
});
export type RebalanceSignal = z.infer<typeof RebalanceSignalSchema>;

// ============================================================
// 市场情绪
// ============================================================

export const MarketSentimentSchema = z.object({
  fearGreedIndex: z.number().min(0).max(100),
  label: z.enum(["EXTREME_FEAR", "FEAR", "NEUTRAL", "GREED", "EXTREME_GREED"]),
  bondYield10Y: z.number(),
  marginBalance: z.number().nullable(),
  northboundNetFlow: z.number().nullable(),
  updatedAt: z.string(),
});
export type MarketSentiment = z.infer<typeof MarketSentimentSchema>;

// ============================================================
// 财报深度分析与前瞻预测 Schema
// ============================================================

export const DividendCoverageSchema = z.object({
  freeCashFlow: z.number(),           // 自由现金流 (亿元)
  totalDividends: z.number(),         // 现金分红总额 (亿元)
  coverageRatio: z.number(),          // 现金流覆盖率 (%)
  payoutRatio: z.number(),            // 股利支付率 (%)
  consecutiveYears: z.number(),       // 连续分红年数
  status: z.enum(["HEALTHY", "WARNING", "DANGEROUS"]),
  message: z.string(),
  history: z.array(z.object({
    year: z.string(),
    dividendPerShare: z.number(),
    payoutRatio: z.number(),
  })),
  dailyYieldHistory: z.array(z.object({
    date: z.string(),
    dividendYield: z.number(),
    closePrice: z.number(),
  })).optional(),
});
export type DividendCoverage = z.infer<typeof DividendCoverageSchema>;

export const HealthScanItemSchema = z.object({
  key: z.string(),
  name: z.string(),
  status: z.enum(["PASS", "WARNING", "DANGER"]),
  valueStr: z.string(),
  detail: z.string(),
});
export type HealthScanItem = z.infer<typeof HealthScanItemSchema>;

export const FinancialHealthScanSchema = z.object({
  overallStatus: z.enum(["PASS", "WARNING", "DANGER"]),
  items: z.array(HealthScanItemSchema),
  trends: z.array(z.object({
    year: z.string(),
    revenue: z.number(),          // 营业收入 (亿元)
    netProfit: z.number(),        // 归母净利润 (亿元)
    operatingCashFlow: z.number(),// 经营现金流 (亿元)
  })),
});
export type FinancialHealthScan = z.infer<typeof FinancialHealthScanSchema>;

export const DuPontBreakdownSchema = z.object({
  roe: z.number(),
  netProfitMargin: z.number(),    // 销售净利率 (%)
  assetTurnover: z.number(),      // 资产周转率 (次)
  equityMultiplier: z.number(),   // 权益乘数 (倍)
  businessType: z.enum(["HIGH_MARGIN", "HIGH_TURNOVER", "HIGH_LEVERAGE", "BALANCED"]),
  businessTypeLabel: z.string(),
  description: z.string(),
  history: z.array(z.object({
    year: z.string(),
    roe: z.number(),
    netProfitMargin: z.number(),
    assetTurnover: z.number(),
    equityMultiplier: z.number(),
  })),
});
export type DuPontBreakdown = z.infer<typeof DuPontBreakdownSchema>;

export const EarningsPreviewSchema = z.object({
  nextReportName: z.string(),         // 业绩预告类型 e.g. "2024 年报"
  disclosureDate: z.string().nullable(), // 预计披露日期 e.g. "2025-04-18"
  daysToDisclosure: z.number().nullable(),
  officialNotice: z.object({
    hasNotice: z.boolean(),
    title: z.string().optional(),
    netProfitRange: z.string().optional(),
    changePctRange: z.string().optional(),
    type: z.string().optional(),       // e.g. "预盈" | "预增" | "略增"
  }).optional(),
  consensus: z.object({
    hasConsensus: z.boolean(),
    analystCount: z.number().optional(),
    predictedProfit: z.number().optional(), // 机构预测中位数 (亿元)
    direction: z.enum(["UP", "DOWN", "FLAT"]).optional(),
    changePct: z.number().optional(),
  }).optional(),
  runRateForecast: z.object({
    predictedProfit: z.number(),        // Run-Rate 预估全年利润 (亿元)
    yoyPct: z.number(),
  }).optional(),
  rating: z.enum(["BEAT", "IN_LINE", "MISS", "NEUTRAL"]),
  summary: z.string(),
});
export type EarningsPreview = z.infer<typeof EarningsPreviewSchema>;

export const FinancialAnalysisReportSchema = z.object({
  code: z.string(),
  name: z.string(),
  dividendCoverage: DividendCoverageSchema,
  healthScan: FinancialHealthScanSchema,
  dupont: DuPontBreakdownSchema,
  earningsPreview: EarningsPreviewSchema,
  updatedAt: z.string(),
});
export type FinancialAnalysisReport = z.infer<typeof FinancialAnalysisReportSchema>;


// ============================================================
// 用户
// ============================================================

export const UserSchema = z.object({
  id: z.string(),
  username: z.string(),
  email: z.string().nullable().optional(),
  nickname: z.string().nullable().optional(),
  avatarUrl: z.string().nullable().optional(),
  createdAt: z.string().optional(),
});
export type User = z.infer<typeof UserSchema>;

export const AuthResponseSchema = z.object({
  accessToken: z.string(),
  user: UserSchema,
});
export type AuthResponse = z.infer<typeof AuthResponseSchema>;

// ============================================================
// 多品类资产管理
// ============================================================

export const AssetCategorySchema = z.enum(["DEPOSIT", "STOCK", "FUND", "WEALTH", "OTHER"]);
export type AssetCategory = z.infer<typeof AssetCategorySchema>;

export const FundTypeSchema = z.enum(["EXCHANGE", "OTC"]);
export type FundType = z.infer<typeof FundTypeSchema>;

export const PayoutMethodSchema = z.enum(["MATURITY", "MONTHLY", "QUARTERLY", "ANNUAL"]);
export type PayoutMethod = z.infer<typeof PayoutMethodSchema>;

export const AssetItemSchema = z.object({
  id: z.number(),
  category: AssetCategorySchema,
  name: z.string(),
  code: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),

  // 通用市值/收益字段
  currentValue: z.number(),
  annualIncome: z.number(),

  // 存款/理财
  amount: z.number().nullable().optional(),
  annualRate: z.number().nullable().optional(),
  depositType: z.enum(["DEMAND", "FIXED"]).nullable().optional(),
  startDate: z.string().nullable().optional(),
  maturityDate: z.string().nullable().optional(),
  payoutMethod: PayoutMethodSchema.nullable().optional(),
  accruedInterest: z.number().nullable().optional(),
  daysHeld: z.number().nullable().optional(),

  // 股票/基金
  fundType: FundTypeSchema.nullable().optional(), // 仅 category=FUND 时有值：EXCHANGE 场内ETF / OTC 场外基金
  shares: z.number().nullable().optional(),
  costPrice: z.number().nullable().optional(),
  currentPrice: z.number().nullable().optional(),
  profit: z.number().nullable().optional(),
  profitPct: z.number().nullable().optional(),
  dividendYield: z.number().nullable().optional(),
  costDividendYield: z.number().nullable().optional(),
  dataStale: z.boolean().nullable().optional(),
  priceAsOf: z.enum(["REALTIME", "PREV_CLOSE_NAV"]).nullable().optional(), // 价格时效：秒级实时 / 场外基金T-1收盘净值
  navDate: z.string().nullable().optional(), // 场外基金净值披露日期
});
export type AssetItem = z.infer<typeof AssetItemSchema>;

export const AssetAllocationSchema = z.object({
  category: AssetCategorySchema,
  label: z.string(),
  value: z.number(),
  pct: z.number(),
});
export type AssetAllocation = z.infer<typeof AssetAllocationSchema>;

export const AssetSummarySchema = z.object({
  summary: z.object({
    totalValue: z.number(),
    totalProfit: z.number(),
    totalProfitPct: z.number(),
    estimatedAnnualIncome: z.number(),
    assetCount: z.number(),
  }),
  allocation: z.array(AssetAllocationSchema),
  assets: z.array(AssetItemSchema),
});
export type AssetSummary = z.infer<typeof AssetSummarySchema>;

export type AssetPayload = {
  category: AssetCategory;
  name: string;
  code?: string | null;
  amount?: number | null;
  shares?: number | null;
  costPrice?: number | null;
  annualRate?: number | null;
  depositType?: "DEMAND" | "FIXED" | null;
  startDate?: string | null;
  maturityDate?: string | null;
  payoutMethod?: PayoutMethod | null;
  fundType?: FundType | null;
  notes?: string | null;
};

// ─── AI 智能助手类型定义 ─────────────────────────────────────────

export const AIChatMessageSchema = z.object({
  id: z.string(),
  role: z.enum(["user", "assistant", "system"]),
  content: z.string(),
  timestamp: z.string().optional(),
});
export type AIChatMessage = z.infer<typeof AIChatMessageSchema>;

export const AIDiagnoseSchema = z.object({
  score: z.number(),
  scoreLabel: z.string(),
  yieldRate: z.number(),
  bondYield10y: z.number(),
  annualIncome: z.number(),
  topAssetName: z.string().nullable().optional(),
  topAssetPct: z.number().nullable().optional(),
  diagnosisText: z.array(z.string()),
  updatedAt: z.string(),
});
export type AIDiagnose = z.infer<typeof AIDiagnoseSchema>;
