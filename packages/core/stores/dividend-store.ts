import { create } from "zustand";
import type { DividendTemperature, DividendStock } from "@investscope/data/schemas";
import { apiClient } from "../api/client";

export type DividendStrategy = "composite" | "high_yield" | "break_net" | "high_roe" | "low_pe";

interface DividendState {
  temperature: DividendTemperature | null;
  topStocks: DividendStock[];
  stockReport: DividendStock | null;
  strategy: DividendStrategy;
  loading: Record<string, boolean>;
  error: Record<string, string | null>;
  lastFetched: Record<string, number>;

  fetchTemperature: () => Promise<void>;
  fetchTopStocks: (strategy?: DividendStrategy, forceRefresh?: boolean) => Promise<void>;
  setStrategy: (strategy: DividendStrategy) => void;
  fetchStockReport: (code: string) => Promise<void>;
  clearStockReport: () => void;
}

const CACHE_MS = 10 * 60 * 1000; // 10 分钟缓存

export const useDividendStore = create<DividendState>((set, get) => ({
  temperature: null,
  topStocks: [],
  stockReport: null,
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
