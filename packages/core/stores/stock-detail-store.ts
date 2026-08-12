import { create } from "zustand";
import type { KlinePoint, ValuationCorridorPoint, StockSearchResult } from "@investscope/data/schemas";
import { apiClient } from "../api/client";

export type KlinePeriod = "daily" | "weekly" | "monthly" | "quarterly" | "yearly";
export type AdjustMode = "qfq" | "hfq" | "none";

interface StockDetailState {
  klines: KlinePoint[];
  corridors: ValuationCorridorPoint[];
  searchResults: StockSearchResult[];
  period: KlinePeriod;
  adjust: AdjustMode;
  loading: Record<string, boolean>;
  error: Record<string, string | null>;

  fetchStockKline: (code: string, period?: KlinePeriod, adjust?: AdjustMode) => Promise<void>;
  setPeriod: (period: KlinePeriod) => void;
  setAdjust: (adjust: AdjustMode) => void;
  searchStocks: (query: string) => Promise<void>;
  clearSearch: () => void;
}

export const useStockDetailStore = create<StockDetailState>((set, get) => ({
  klines: [],
  corridors: [],
  searchResults: [],
  period: "daily",
  adjust: "qfq",
  loading: {},
  error: {},

  fetchStockKline: async (code: string, p?: KlinePeriod, adj?: AdjustMode) => {
    const targetPeriod = p || get().period;
    const targetAdjust = adj || get().adjust;
    const key = `kline_${code}_${targetPeriod}_${targetAdjust}`;
    
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

  setPeriod: (period: KlinePeriod) => set({ period }),
  setAdjust: (adjust: AdjustMode) => set({ adjust }),

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
