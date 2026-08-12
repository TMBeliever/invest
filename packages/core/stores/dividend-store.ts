import { create } from "zustand";
import type { DividendTemperature, DividendStock } from "@investscope/data/schemas";
import { apiClient } from "../api/client";

interface DividendState {
  temperature: DividendTemperature | null;
  topStocks: DividendStock[];
  stockReport: DividendStock | null;
  loading: Record<string, boolean>;
  error: Record<string, string | null>;
  lastFetched: Record<string, number>;

  fetchTemperature: () => Promise<void>;
  fetchTopStocks: () => Promise<void>;
  fetchStockReport: (code: string) => Promise<void>;
  clearStockReport: () => void;
}

const CACHE_MS = 10 * 60 * 1000; // 10 分钟缓存

export const useDividendStore = create<DividendState>((set, get) => ({
  temperature: null,
  topStocks: [],
  stockReport: null,
  loading: {},
  error: {},
  lastFetched: {},

  fetchTemperature: async () => {
    const key = "temperature";
    const now = Date.now();
    if (now - (get().lastFetched[key] || 0) < CACHE_MS) return;

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

  fetchTopStocks: async () => {
    const key = "topStocks";
    const now = Date.now();
    if (now - (get().lastFetched[key] || 0) < CACHE_MS) return;

    set((s) => ({ loading: { ...s.loading, [key]: true }, error: { ...s.error, [key]: null } }));
    try {
      const data = await apiClient.get<DividendStock[]>("/api/dividend/top-stocks");
      set((s) => ({
        topStocks: data,
        loading: { ...s.loading, [key]: false },
        lastFetched: { ...s.lastFetched, [key]: now },
      }));
    } catch (err) {
      set((s) => ({
        loading: { ...s.loading, [key]: false },
        error: { ...s.error, [key]: err instanceof Error ? err.message : "获取排行失败" },
      }));
    }
  },

  fetchStockReport: async (code: string) => {
    const key = `report_${code}`;
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
