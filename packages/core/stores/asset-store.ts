import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { AssetSummary, AssetPayload } from "@investscope/data/schemas";
import { apiClient } from "../api/client";

interface AssetState {
  summary: AssetSummary | null;
  loading: Record<string, boolean>;
  error: Record<string, string | null>;

  fetchSummary: (retryCount?: number) => Promise<void>;
  addAsset: (payload: AssetPayload) => Promise<void>;
  updateAsset: (id: number, payload: AssetPayload) => Promise<void>;
  deleteAsset: (id: number) => Promise<void>;
}

export const useAssetStore = create<AssetState>()(
  persist(
    (set, get) => ({
      summary: null,
      loading: {},
      error: {},

      fetchSummary: async (retryCount = 0) => {
        const key = "summary";
        if (get().loading[key]) return;

        set((s) => ({ loading: { ...s.loading, [key]: true }, error: { ...s.error, [key]: null } }));
        try {
          const data = await apiClient.get<AssetSummary>("/api/assets/summary");
          set((s) => ({
            summary: data,
            loading: { ...s.loading, [key]: false },
            error: { ...s.error, [key]: null },
          }));
        } catch (err) {
          // 首次启动或部署时若遇网络抖动/冷启动延迟，自动在 600ms 后重试（最多重试 2 次）
          if (retryCount < 2) {
            set((s) => ({ loading: { ...s.loading, [key]: false } }));
            await new Promise((resolve) => setTimeout(resolve, 600 * (retryCount + 1)));
            return get().fetchSummary(retryCount + 1);
          }

          set((s) => ({
            loading: { ...s.loading, [key]: false },
            error: { ...s.error, [key]: err instanceof Error ? err.message : "获取资产列表失败" },
          }));
        }
      },

      addAsset: async (payload) => {
        await apiClient.post("/api/assets", payload);
        await get().fetchSummary();
      },

      updateAsset: async (id, payload) => {
        await apiClient.put(`/api/assets/${id}`, payload);
        await get().fetchSummary();
      },

      deleteAsset: async (id) => {
        await apiClient.delete(`/api/assets/${id}`);
        await get().fetchSummary();
      },
    }),
    {
      name: "investscope-assets-cache",
      partialize: (state) => ({ summary: state.summary }),
    }
  )
);
