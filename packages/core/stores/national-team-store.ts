import { create } from "zustand";
import { persist } from "zustand/middleware";
import { apiClient } from "../api/client";

export interface EtfRadarItem {
  code: string;
  name: string;
  category: string;
  role: string;
  currentPrice: number;
  changePct: number;
  turnoverYi: number;
  benchmarkDailyVol: number;
  volumeMultiplier: number;
  estimatedInflowYi: number;
  signalLevel: "EMERGENCY_DEFENSE" | "ACTIVE_INFLOW" | "NORMAL_SUPPORT" | "CALM";
  signalText: string;
  signalColor: "red" | "amber" | "emerald" | "gray";
}

export interface FactionItem {
  id: string;
  name: string;
  orgTitle: string;
  totalEstScaleYi: number;
  style: string;
  coreSectors: string[];
}

export interface InstitutionHoldingItem {
  name: string;
  factionId: string;
  ratio: number;
  sharesYi: number;
  marketCapYi: number;
}

export interface CoreHoldingItem {
  code: string;
  name: string;
  factionIds: string[];
  factions: string[];
  institutions?: InstitutionHoldingItem[];
  industry: string;
  holdingMarketCap: number;
  freeFloatRatio: number;
  changeStatus: string;
  currentPrice: number;
  changePct: number;
  dividendYield: number;
  pe: number;
  pb?: number;
  roe: number;
  isHighDividend: boolean;
  followReason: string;
  supportPrice: number;
}

export interface MoneyFlowRecord {
  date: string;
  closePrice: number;
  changePct: number;
  turnoverPct?: number;
  mainNetInflowYi: number;
  mainRatioPct: number;
  totalNetInflowYi: number;
  institutionBreakdown?: Array<{
    name: string;
    factionId: string;
    inflowYi: number;
    ratio: number;
  }>;
}

export interface IntradayOrderMetrics {
  price: number;
  turnoverYi: number;
  buyAmountYi: number;
  sellAmountYi: number;
  netActiveYi: number;
  volumeRatio: number;
  buyRatio: number;
}

export interface StockMoneyFlowData {
  symbol: string;
  name?: string;
  fullCode: string;
  livePrice?: number;
  holderSummary?: InstitutionHoldingItem[];
  intradayMetrics?: IntradayOrderMetrics;
  last5DaysMainInflowYi: number;
  last10DaysMainInflowYi: number;
  history: MoneyFlowRecord[];
}

export interface NationalTeamOverview {
  radar: {
    summary: {
      stanceLevel: string;
      stanceLabel: string;
      stanceDesc: string;
      stanceColor: string;
      totalRadarTurnoverYi: number;
      totalEstimatedDefenseInflowYi: number;
      monitoredEtfCount: number;
      timestamp: string;
    };
    etfRadarList: EtfRadarItem[];
  };
  holdings: {
    factions: FactionItem[];
    coreHoldings: CoreHoldingItem[];
  };
  followStrategy: {
    title: string;
    description: string;
    winRateMetrics: {
      oneYearWinRate: number;
      threeYearWinRate: number;
      averageAnnualReturn: string;
      maxHistoricalDrawdown: string;
    };
    candidates: CoreHoldingItem[];
  };
}

interface NationalTeamState {
  overview: NationalTeamOverview | null;
  loading: boolean;
  error: string | null;
  lastFetched: number;
  selectedMoneyFlow: StockMoneyFlowData | null;
  loadingMoneyFlow: boolean;

  fetchOverview: (forceRefresh?: boolean) => Promise<void>;
  fetchStockMoneyFlow: (symbol: string) => Promise<StockMoneyFlowData | null>;
  clearSelectedMoneyFlow: () => void;
}

export const useNationalTeamStore = create<NationalTeamState>()(
  persist(
    (set, get) => ({
      overview: null,
      loading: false,
      error: null,
      lastFetched: 0,
      selectedMoneyFlow: null,
      loadingMoneyFlow: false,

      fetchOverview: async (forceRefresh = false) => {
        const now = Date.now();
        if (!forceRefresh && get().overview && now - get().lastFetched < 30000) {
          return;
        }

        set({ loading: true, error: null });
        try {
          const data = await apiClient.get<NationalTeamOverview>("/api/national-team/overview");
          set({
            overview: data,
            loading: false,
            error: null,
            lastFetched: Date.now(),
          });
        } catch (err) {
          set({
            loading: false,
            error: err instanceof Error ? err.message : "获取国家队操盘数据失败",
          });
        }
      },

      fetchStockMoneyFlow: async (symbol: string) => {
        set({ loadingMoneyFlow: true });
        try {
          const data = await apiClient.get<StockMoneyFlowData>(`/api/national-team/money-flow/${symbol}`);
          set({ selectedMoneyFlow: data, loadingMoneyFlow: false });
          return data;
        } catch (err) {
          set({ loadingMoneyFlow: false });
          return null;
        }
      },

      clearSelectedMoneyFlow: () => set({ selectedMoneyFlow: null }),
    }),
    {
      name: "investscope-national-team-cache",
      partialize: (state) => ({ overview: state.overview }),
    }
  )
);
