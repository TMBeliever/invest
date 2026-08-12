import { create } from "zustand";
import type { IndexQuote, MarketSentiment } from "@investscope/data/schemas";
import { apiClient } from "../api/client";

interface MarketState {
  indices: IndexQuote[];
  sentiment: MarketSentiment | null;
  loading: Record<string, boolean>;
  error: Record<string, string | null>;
  lastFetched: Record<string, number>;

  fetchIndices: () => Promise<void>;
  fetchSentiment: () => Promise<void>;
}

const CACHE_MS = 5 * 60 * 1000; // 5 分钟缓存

function isCacheValid(lastFetched: Record<string, number>, key: string): boolean {
  return Date.now() - (lastFetched[key] || 0) < CACHE_MS;
}

export const useMarketStore = create<MarketState>((set, get) => ({
  indices: [],
  sentiment: null,
  loading: {},
  error: {},
  lastFetched: {},

  fetchIndices: async () => {
    const key = "indices";
    if (isCacheValid(get().lastFetched, key)) return;

    set((s) => ({ loading: { ...s.loading, [key]: true }, error: { ...s.error, [key]: null } }));
    try {
      const data = await apiClient.get<IndexQuote[]>("/api/market/indices");
      set((s) => ({
        indices: data,
        loading: { ...s.loading, [key]: false },
        lastFetched: { ...s.lastFetched, [key]: Date.now() },
      }));
    } catch (err) {
      set((s) => ({
        loading: { ...s.loading, [key]: false },
        error: { ...s.error, [key]: err instanceof Error ? err.message : "获取指数失败" },
      }));
    }
  },

  fetchSentiment: async () => {
    const key = "sentiment";
    if (isCacheValid(get().lastFetched, key)) return;

    set((s) => ({ loading: { ...s.loading, [key]: true }, error: { ...s.error, [key]: null } }));
    try {
      const data = await apiClient.get<MarketSentiment>("/api/market/sentiment");
      set((s) => ({
        sentiment: data,
        loading: { ...s.loading, [key]: false },
        lastFetched: { ...s.lastFetched, [key]: Date.now() },
      }));
    } catch (err) {
      set((s) => ({
        loading: { ...s.loading, [key]: false },
        error: { ...s.error, [key]: err instanceof Error ? err.message : "获取情绪失败" },
      }));
    }
  },
}));
