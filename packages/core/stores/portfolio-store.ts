import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { PortfolioHolding, PortfolioSummary, RebalanceSignal } from "@investscope/data/schemas";
import { apiClient } from "../api/client";

interface PortfolioState {
  summary: PortfolioSummary | null;
  rebalanceSignals: RebalanceSignal[];
  loading: Record<string, boolean>;
  error: Record<string, string | null>;

  fetchSummary: () => Promise<void>;
  fetchRebalanceSignals: () => Promise<void>;
  addHolding: (holding: Omit<PortfolioHolding, "id" | "marketValue" | "profitLoss" | "profitLossPct" | "weight">) => Promise<void>;
  removeHolding: (id: string) => Promise<void>;
}

export const usePortfolioStore = create<PortfolioState>((set, get) => ({
  summary: null,
  rebalanceSignals: [],
  loading: {},
  error: {},

  fetchSummary: async () => {
    const key = "summary";
    set((s) => ({ loading: { ...s.loading, [key]: true }, error: { ...s.error, [key]: null } }));
    try {
      const data = await apiClient.get<PortfolioSummary>("/api/portfolio/summary");
      set((s) => ({
        summary: data,
        loading: { ...s.loading, [key]: false },
      }));
    } catch (err) {
      set((s) => ({
        loading: { ...s.loading, [key]: false },
        error: { ...s.error, [key]: err instanceof Error ? err.message : "获取组合失败" },
      }));
    }
  },

  fetchRebalanceSignals: async () => {
    const key = "rebalance";
    set((s) => ({ loading: { ...s.loading, [key]: true }, error: { ...s.error, [key]: null } }));
    try {
      const data = await apiClient.get<RebalanceSignal[]>("/api/portfolio/rebalance-signals");
      set((s) => ({
        rebalanceSignals: data,
        loading: { ...s.loading, [key]: false },
      }));
    } catch (err) {
      set((s) => ({
        loading: { ...s.loading, [key]: false },
        error: { ...s.error, [key]: err instanceof Error ? err.message : "获取信号失败" },
      }));
    }
  },

  addHolding: async (holding) => {
    await apiClient.post("/api/portfolio/holdings", holding);
    await get().fetchSummary();
  },

  removeHolding: async (id: string) => {
    await apiClient.delete(`/api/portfolio/holdings/${id}`);
    await get().fetchSummary();
  },
}));
