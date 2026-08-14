import { create } from "zustand";
import { persist } from "zustand/middleware";

interface ConfigState {
  theme: "light" | "dark" | "system";
  apiBaseUrl: string;
  setTheme: (theme: "light" | "dark" | "system") => void;
  setApiBaseUrl: (url: string) => void;
}

export const useConfigStore = create<ConfigState>()(
  persist(
    (set) => ({
      theme: "dark",
      apiBaseUrl: process.env.NEXT_PUBLIC_API_URL || "",
      setTheme: (theme) => set({ theme }),
      setApiBaseUrl: (url) => set({ apiBaseUrl: url }),
    }),
    { name: "investscope-config" }
  )
);
