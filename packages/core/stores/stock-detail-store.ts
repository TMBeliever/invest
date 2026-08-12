import { create } from "zustand";
import type { KlinePoint, ValuationCorridorPoint, StockSearchResult, StockQuote, IntradayTick, IndexDetail } from "@investscope/data/schemas";
import { apiClient } from "../api/client";

export type KlinePeriod = "intraday" | "daily" | "weekly" | "monthly" | "quarterly" | "yearly";
export type AdjustMode = "qfq" | "hfq" | "none";

interface StockDetailState {
  quote: StockQuote | null;
  quoteFlash: "up" | "down" | null;
  indexDetail: IndexDetail | null;
  klines: KlinePoint[];
  corridors: ValuationCorridorPoint[];
  intradayTicks: IntradayTick[];
  intradayPrevClose: number | null;
  searchResults: StockSearchResult[];
  period: KlinePeriod;
  adjust: AdjustMode;
  autoRefresh: boolean;
  refreshInterval: number; // 毫秒 3000 | 5000 | 10000
  loading: Record<string, boolean>;
  error: Record<string, string | null>;

  fetchStockQuote: (code: string) => Promise<void>;
  fetchIndexDetail: (code: string) => Promise<void>;
  fetchStockKline: (code: string, period?: KlinePeriod, adjust?: AdjustMode) => Promise<void>;
  fetchStockIntraday: (code: string) => Promise<void>;
  setPeriod: (period: KlinePeriod) => void;
  setAdjust: (adjust: AdjustMode) => void;
  toggleAutoRefresh: () => void;
  setRefreshInterval: (ms: number) => void;
  searchStocks: (query: string) => Promise<void>;
  clearSearch: () => void;
}

export const useStockDetailStore = create<StockDetailState>((set, get) => ({
  quote: null,
  quoteFlash: null,
  indexDetail: null,
  klines: [],
  corridors: [],
  intradayTicks: [],
  intradayPrevClose: null,
  searchResults: [],
  period: "daily",
  adjust: "qfq",
  autoRefresh: true,
  refreshInterval: 5000,
  loading: {},
  error: {},

  fetchStockQuote: async (code: string) => {
    const key = `quote_${code}`;
    if (get().loading[key]) return;

    set((s) => ({
      loading: { ...s.loading, [key]: true },
      error: { ...s.error, [key]: null },
    }));

    try {
      const newQuote = await apiClient.get<StockQuote>(`/api/stock/quote/${code}`);
      const oldQuote = get().quote;
      let flash: "up" | "down" | null = null;
      if (oldQuote && oldQuote.code === newQuote.code) {
        if (newQuote.price > oldQuote.price) flash = "up";
        else if (newQuote.price < oldQuote.price) flash = "down";
      }

      set((s) => ({
        quote: newQuote,
        quoteFlash: flash,
        loading: { ...s.loading, [key]: false },
      }));

      if (flash) {
        setTimeout(() => {
          set({ quoteFlash: null });
        }, 1200);
      }
    } catch (err) {
      set((s) => ({
        loading: { ...s.loading, [key]: false },
        error: { ...s.error, [key]: err instanceof Error ? err.message : "获取实时行情失败" },
      }));
    }
  },

  fetchIndexDetail: async (code: string) => {
    const key = `index_detail_${code}`;
    if (get().loading[key]) return;

    set((s) => ({
      loading: { ...s.loading, [key]: true },
      error: { ...s.error, [key]: null },
    }));

    try {
      const data = await apiClient.get<IndexDetail>(`/api/stock/index/${code}`);
      set((s) => ({
        indexDetail: data,
        loading: { ...s.loading, [key]: false },
      }));
    } catch (err) {
      set((s) => ({
        loading: { ...s.loading, [key]: false },
        error: { ...s.error, [key]: err instanceof Error ? err.message : "获取指数详情失败" },
      }));
    }
  },

  fetchStockKline: async (code: string, p?: KlinePeriod, adj?: AdjustMode) => {
    const targetPeriod = p || get().period;
    const targetAdjust = adj || get().adjust;

    // 分时模式单独走 fetchStockIntraday
    if (targetPeriod === "intraday") {
      set({ period: "intraday" });
      await get().fetchStockIntraday(code);
      return;
    }

    const key = `kline_${code}_${targetPeriod}_${targetAdjust}`;
    if (get().loading[key]) return;

    set((s) => ({
      period: targetPeriod,
      adjust: targetAdjust,
      loading: { ...s.loading, [key]: true },
      error: { ...s.error, [key]: null },
    }));

    try {
      const data = await apiClient.get<{ code: string; klines: KlinePoint[]; corridors: ValuationCorridorPoint[] }>(
        `/api/stock/kline/${code}?period=${targetPeriod}&adjust=${targetAdjust}`
      );
      set((s) => ({
        klines: data.klines,
        corridors: data.corridors,
        loading: { ...s.loading, [key]: false },
      }));
    } catch (err) {
      set((s) => ({
        loading: { ...s.loading, [key]: false },
        error: { ...s.error, [key]: err instanceof Error ? err.message : "获取 K线数据失败" },
      }));
    }
  },

  fetchStockIntraday: async (code: string) => {
    const key = `intraday_${code}`;
    if (get().loading[key]) return;

    set((s) => ({
      loading: { ...s.loading, [key]: true },
      error: { ...s.error, [key]: null },
    }));
    try {
      const data = await apiClient.get<{ code: string; prevClose: number | null; ticks: IntradayTick[] }>(
        `/api/stock/intraday/${code}`
      );
      set((s) => ({
        intradayTicks: data.ticks,
        intradayPrevClose: data.prevClose,
        loading: { ...s.loading, [key]: false },
      }));
    } catch (err) {
      set((s) => ({
        loading: { ...s.loading, [key]: false },
        error: { ...s.error, [key]: err instanceof Error ? err.message : "获取分时数据失败" },
      }));
    }
  },

  setPeriod: (period: KlinePeriod) => set({ period }),
  setAdjust: (adjust: AdjustMode) => set({ adjust }),
  toggleAutoRefresh: () => set((s) => ({ autoRefresh: !s.autoRefresh })),
  setRefreshInterval: (ms: number) => set({ refreshInterval: ms }),

  searchStocks: async (query: string) => {
    if (!query.trim()) {
      set({ searchResults: [] });
      return;
    }
    const key = "search";
    set((s) => ({ loading: { ...s.loading, [key]: true } }));
    try {
      const results = await apiClient.get<StockSearchResult[]>(`/api/stock/search?query=${encodeURIComponent(query)}`);
      set((s) => ({
        searchResults: results,
        loading: { ...s.loading, [key]: false },
      }));
    } catch {
      set((s) => ({ loading: { ...s.loading, [key]: false } }));
    }
  },

  clearSearch: () => set({ searchResults: [] }),
}));

