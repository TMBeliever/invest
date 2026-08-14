import { create } from "zustand";
import type { DividendTemperature, DividendStock } from "@investscope/data/schemas";
import { apiClient } from "../api/client";

export interface DividendCalendarData {
  summary: {
    totalAnnualCashflow: number;
    monthlyAverageCashflow: number;
    dailyAverageCashflow: number;
    monthlyLivingExpenseTarget: number;
    financialFreedomCoveragePct: number;
    totalEventsCount: number;
    activeEquityCount?: number;
    activeAssetsCount?: number;
  };
  monthlySeries: Array<{
    month: string;
    stockDividends: number;
    depositInterest: number;
    totalCashflow: number;
    events: any[];
  }>;
  timelineEvents: Array<{
    id: string;
    month: string;
    date: string;
    assetType: string;
    symbol: string | null;
    name: string;
    amount: number;
    dividendYield?: number;
    shares?: number;
    dpsPer10?: number;
    description: string;
    status: string;
    statusLabel?: string;
  }>;
  topSources: Array<{
    name: string;
    annualAmount: number;
    ratio: number;
  }>;
  generatedAt: string;
}

export type DividendStrategy = "composite" | "high_yield" | "break_net" | "high_roe" | "low_pe";

interface DividendState {
  temperature: DividendTemperature | null;
  topStocks: DividendStock[];
  stockReport: DividendStock | null;
  calendarData: DividendCalendarData | null;
  strategy: DividendStrategy;
  loading: Record<string, boolean>;
  error: Record<string, string | null>;
  lastFetched: Record<string, number>;

  fetchTemperature: () => Promise<void>;
  fetchTopStocks: (strategy?: DividendStrategy, forceRefresh?: boolean) => Promise<void>;
  fetchDividendCalendar: (monthlyExpense?: number, forceRefresh?: boolean) => Promise<void>;
  setStrategy: (strategy: DividendStrategy) => void;
  fetchStockReport: (code: string) => Promise<void>;
  clearStockReport: () => void;
}

const CACHE_MS = 10 * 60 * 1000; // 10 分钟缓存

export const useDividendStore = create<DividendState>((set, get) => ({
  temperature: null,
  topStocks: [],
  stockReport: null,
  calendarData: null,
  strategy: "composite",
  loading: {},
  error: {},
  lastFetched: {},

  fetchTemperature: async () => {
    const key = "temperature";
    const now = Date.now();
    if (get().loading[key] || now - (get().lastFetched[key] || 0) < CACHE_MS) return;

    set((s) => ({ loading: { ...s.loading, [key]: true }, error: { ...s.error, [key]: null } }));
    try {
      const data = await apiClient.get<DividendTemperature>("/api/dividend/temperature");
      set((s) => ({
        temperature: data,
        loading: { ...s.loading, [key]: false },
        lastFetched: { ...s.lastFetched, [key]: now },
      }));
    } catch (err) {
      set((s) => ({
        loading: { ...s.loading, [key]: false },
        error: { ...s.error, [key]: err instanceof Error ? err.message : "获取温度失败" },
      }));
    }
  },

  fetchTopStocks: async (targetStrategy?: DividendStrategy, forceRefresh?: boolean) => {
    const st = targetStrategy || get().strategy;
    const key = `topStocks_${st}`;
    const now = Date.now();
    if (get().loading[key] || (!forceRefresh && now - (get().lastFetched[key] || 0) < CACHE_MS && get().strategy === st && get().topStocks.length > 0)) {
      return;
    }

    set((s) => ({
      strategy: st,
      loading: { ...s.loading, [key]: true, topStocks: true },
      error: { ...s.error, [key]: null },
    }));

    try {
      const data = await apiClient.get<DividendStock[]>(`/api/dividend/top-stocks?strategy=${st}`);
      set((s) => ({
        topStocks: data,
        loading: { ...s.loading, [key]: false, topStocks: false },
        lastFetched: { ...s.lastFetched, [key]: now },
      }));
    } catch (err) {
      set((s) => ({
        loading: { ...s.loading, [key]: false, topStocks: false },
        error: { ...s.error, [key]: err instanceof Error ? err.message : "获取排行失败" },
      }));
    }
  },

  fetchDividendCalendar: async (monthlyExpense?: number, forceRefresh?: boolean) => {
    const key = "dividendCalendar";
    const now = Date.now();
    if (get().loading[key] || (!forceRefresh && now - (get().lastFetched[key] || 0) < CACHE_MS && get().calendarData)) {
      return;
    }

    set((s) => ({ loading: { ...s.loading, [key]: true }, error: { ...s.error, [key]: null } }));
    try {
      const expense = monthlyExpense ?? 8000;
      const data = await apiClient.get<DividendCalendarData>(`/api/dividend/calendar?monthly_expense=${expense}`);
      set((s) => ({
        calendarData: data,
        loading: { ...s.loading, [key]: false },
        lastFetched: { ...s.lastFetched, [key]: now },
      }));
    } catch (err) {
      set((s) => ({
        loading: { ...s.loading, [key]: false },
        error: { ...s.error, [key]: err instanceof Error ? err.message : "获取分红现金流日历失败" },
      }));
    }
  },

  setStrategy: (strategy: DividendStrategy) => {
    get().fetchTopStocks(strategy, true);
  },

  fetchStockReport: async (code: string) => {
    const key = `report_${code}`;
    if (get().loading[key]) return;

    set((s) => ({ loading: { ...s.loading, [key]: true }, error: { ...s.error, [key]: null } }));
    try {
      const data = await apiClient.get<DividendStock>(`/api/dividend/stock/${code}`);
      set((s) => ({
        stockReport: data,
        loading: { ...s.loading, [key]: false },
      }));
    } catch (err) {
      set((s) => ({
        loading: { ...s.loading, [key]: false },
        error: { ...s.error, [key]: err instanceof Error ? err.message : "获取报告失败" },
      }));
    }
  },

  clearStockReport: () => set({ stockReport: null }),
}));
