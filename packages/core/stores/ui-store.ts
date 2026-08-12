import { create } from "zustand";

interface UIState {
  sidebarCollapsed: boolean;
  activePage: string;
  searchQuery: string;

  toggleSidebar: () => void;
  setActivePage: (page: string) => void;
  setSearchQuery: (query: string) => void;
}

export const useUIStore = create<UIState>((set) => ({
  sidebarCollapsed: false,
  activePage: "dashboard",
  searchQuery: "",

  toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
  setActivePage: (page) => set({ activePage: page }),
  setSearchQuery: (query) => set({ searchQuery: query }),
}));
