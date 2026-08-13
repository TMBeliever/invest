import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { User, AuthResponse } from "@investscope/data/schemas";
import { apiClient } from "../api/client";

interface AuthState {
  token: string | null;
  user: User | null;
  loading: boolean;
  error: string | null;

  register: (username: string, password: string, email?: string) => Promise<void>;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  fetchMe: () => Promise<void>;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      token: null,
      user: null,
      loading: false,
      error: null,

      register: async (username: string, password: string, email?: string) => {
        set({ loading: true, error: null });
        try {
          const data = await apiClient.post<AuthResponse>("/api/auth/register", {
            username,
            password,
            email,
          });
          apiClient.setToken(data.accessToken);
          set({ token: data.accessToken, user: data.user, loading: false });
        } catch (err) {
          set({ loading: false, error: err instanceof Error ? err.message : "注册失败" });
          throw err;
        }
      },

      login: async (username: string, password: string) => {
        set({ loading: true, error: null });
        try {
          const data = await apiClient.post<AuthResponse>("/api/auth/login", {
            username,
            password,
          });
          apiClient.setToken(data.accessToken);
          set({ token: data.accessToken, user: data.user, loading: false });
        } catch (err) {
          set({ loading: false, error: err instanceof Error ? err.message : "登录失败" });
          throw err;
        }
      },

      logout: () => {
        apiClient.setToken(null);
        set({ token: null, user: null, error: null });
      },

      fetchMe: async () => {
        const token = get().token;
        if (!token) return;
        apiClient.setToken(token);
        try {
          const user = await apiClient.get<User>("/api/auth/me");
          set({ user });
        } catch {
          // token 失效，清空登录态
          apiClient.setToken(null);
          set({ token: null, user: null });
        }
      },
    }),
    {
      name: "investscope-auth",
      partialize: (state) => ({ token: state.token, user: state.user }),
      onRehydrateStorage: () => (state) => {
        if (state?.token) {
          apiClient.setToken(state.token);
        }
      },
    }
  )
);
