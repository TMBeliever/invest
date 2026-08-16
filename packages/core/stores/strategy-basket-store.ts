import { create } from "zustand";
import { apiClient } from "../api/client";

export type BasketStrategyKey =
  | "BALANCED_QUALITY"
  | "DEEP_VALUE_SAFETY"
  | "HIGH_ROE_GROWTH"
  | "SOVEREIGN_SUPPORT";

export type BasketWeightMethod = "EQUAL" | "DIVIDEND" | "SCORE";

export interface StockScoreBreakdown {
  quality: number;
  dividend: number;
  safety: number;
}

export interface StrategyBasketStock {
  code: string;
  name: string;
  price: number;
  changePct: number;
  pe: number;
  pb: number;
  dividendYield: number;
  roe: number;
  payoutYears: number;
  industry: string;
  nationalTeamRatio: number;
  nationalTeamLabel?: string;
  score: number;
  scoreBreakdown?: StockScoreBreakdown;
  reasons: string[];
  potentialRisks?: string[];
  weightPct: number;
}

export interface StrategyBasketMetrics {
  weightedDividendYield: number;
  weightedRoe: number;
  weightedPe: number;
  weightedPb: number;
}

export interface TrapAuditItem {
  code: string;
  name: string;
  industry: string;
  price: number;
  surfaceDividendYield: number;
  trapDimension: string;
  trapLabel: string;
  deadlyReason: string;
  financialEvidence: string;
}

export interface AntiTrapAuditData {
  totalAuditedCount: number;
  totalExcludedCount: number;
  passedCandidatesCount: number;
  dimensionCounts: Record<string, number>;
  trapsList: TrapAuditItem[];
}

export interface EtfBenchmarkInfo {
  name: string;
  dividendYield: number;
  roe: number;
  pe: number;
  pb: number;
  annualManagementFeePct: number;
  constituentsCount: number;
}

export interface EtfComparisonData {
  yieldAdvantagePct: number;
  roeAdvantagePct: number;
  annualFeeSavedPct: number;
  savedFeePer100kAnnual: number;
  savedFeePer1mAnnual: number;
  summaryVerdict: string;
}

export interface StrategyBasketData {
  strategy: BasketStrategyKey;
  strategyMeta: {
    name: string;
    desc: string;
  };
  count: number;
  weightMethod: BasketWeightMethod;
  metrics: StrategyBasketMetrics;
  industryDistribution: Record<string, number>;
  stocks: StrategyBasketStock[];
  antiTrapAudit: AntiTrapAuditData;
  etfComparison: EtfComparisonData;
  etfBenchmark: EtfBenchmarkInfo;
  generatedAt: string;
}

interface StrategyBasketState {
  count: number;
  strategy: BasketStrategyKey;
  weightMethod: BasketWeightMethod;
  basketData: StrategyBasketData | null;
  loading: boolean;
  applying: boolean;
  error: string | null;

  setCount: (count: number) => void;
  setStrategy: (strategy: BasketStrategyKey) => void;
  setWeightMethod: (method: BasketWeightMethod) => void;
  generateBasket: () => Promise<void>;
  applyToAssets: (totalAmount?: number) => Promise<{ success: boolean; message: string }>;
}

export const useStrategyBasketStore = create<StrategyBasketState>((set, get) => ({
  count: 10,
  strategy: "BALANCED_QUALITY",
  weightMethod: "EQUAL",
  basketData: null,
  loading: false,
  applying: false,
  error: null,

  setCount: (count) => {
    set({ count: Math.max(3, Math.min(20, count)) });
    get().generateBasket();
  },

  setStrategy: (strategy) => {
    set({ strategy });
    get().generateBasket();
  },

  setWeightMethod: (weightMethod) => {
    set({ weightMethod });
    get().generateBasket();
  },

  generateBasket: async () => {
    const { count, strategy, weightMethod } = get();
    set({ loading: true, error: null });
    try {
      const query = new URLSearchParams({
        count: String(count),
        strategy,
        weight_method: weightMethod,
      }).toString();
      const res = await apiClient.get<StrategyBasketData>(`/api/strategy-baskets/generate?${query}`);
      set({ basketData: res, loading: false });
    } catch (e: any) {
      set({ error: e.message || "生成智选组合失败", loading: false });
    }
  },

  applyToAssets: async (totalAmount = 100000) => {
    const { basketData } = get();
    if (!basketData || basketData.stocks.length === 0) {
      return { success: false, message: "请先生成有效组合" };
    }

    set({ applying: true });
    try {
      const res = await apiClient.post<{ message: string; importedCount: number }>("/api/strategy-baskets/apply-to-assets", {
        stocks: basketData.stocks,
        totalInvestmentAmount: totalAmount,
      });
      set({ applying: false });
      return { success: true, message: res.message || "成功导入至资产账本！" };
    } catch (e: any) {
      set({ applying: false });
      return { success: false, message: e.message || "导入失败" };
    }
  },
}));
