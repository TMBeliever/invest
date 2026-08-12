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
