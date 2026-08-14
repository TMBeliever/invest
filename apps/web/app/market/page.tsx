"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useMarketStore } from "@investscope/core";
import { SegmentedTabs } from "@investscope/ui";
import {
  BarChart3,
  Layers,
  RefreshCw,
  TrendingUp,
  Scale,
  DollarSign,
  Activity,
  Globe2,
  Building2,
  Sparkles,
  Sunrise,
  Sunset,
} from "lucide-react";
import { MarketReportsModal } from "./components/market-reports-modal";

export default function MarketPage() {
  const { overview, fetchOverview, loading, error } = useMarketStore();
  const [activeCategory, setActiveCategory] = useState<"ALL" | "A_SHARE" | "DIVIDEND" | "HK" | "US" | "KR_JP">("ALL");
  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [reportModalType, setReportModalType] = useState<"MORNING_RADAR" | "CLOSING_REVIEW">("MORNING_RADAR");

  useEffect(() => {
    fetchOverview();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const indices = overview?.indices || [];

  const filteredIndices = indices.filter((item: any) => {
    if (activeCategory === "A_SHARE") return ["000001", "399001", "399006", "000300", "000905", "588000"].includes(item.code);
    if (activeCategory === "DIVIDEND") return ["000922", "000300"].includes(item.code);
    if (activeCategory === "HK") return ["HSI", "HSCEI", "HSTECH", "r_HSI", "hkHSCEI", "hkHSTECH"].includes(item.code) || item.name.includes("恒生") || item.name.includes("国企");
    if (activeCategory === "US") return [".DJI", ".INX", ".IXIC", ".NDX"].includes(item.code) || ["道琼斯", "标普500", "纳斯达克", "纳指100"].includes(item.name);
    if (activeCategory === "KR_JP") return ["N225", "KOSPI"].includes(item.code) || ["日经225", "韩国KOSPI"].includes(item.name);
    return true;
  });

  const totalAmount = overview?.totalAmount ?? 0;
  const bondYield = overview?.bondYield10y ?? 0;
  const avgDy = overview?.avgDividendYield ?? 0;
  const riskRatio = overview?.riskPremiumRatio ?? 0;
  const leaders = overview?.sectorLeaders || [];

  return (
    <div className="p-6 max-w-[1400px] mx-auto animate-fade-in space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-primary" />
            市场总览
            <span className="text-xs font-normal px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              全景实时行情
            </span>
          </h1>
          <p className="text-xs text-default-400 mt-1">
            全球跨市场矩阵 (A股/港股/美股/韩日) · 两市成交额 · 股债性价比罗盘 · 重点板块风向
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          {/* 早盘前瞻按钮 */}
          <button
            type="button"
            onClick={() => {
              setReportModalType("MORNING_RADAR");
              setReportModalOpen(true);
            }}
            className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-amber-500/20 to-orange-500/20 hover:from-amber-500/30 hover:to-orange-500/30 border border-amber-500/30 text-amber-300 text-xs font-semibold transition-all flex items-center gap-1.5 shadow-sm hover:scale-105 cursor-pointer"
          >
            <Sunrise className="w-3.5 h-3.5 text-amber-400" />
            <span>🌅 今日早盘前瞻</span>
          </button>

          {/* 收盘复盘按钮 */}
          <button
            type="button"
            onClick={() => {
              setReportModalType("CLOSING_REVIEW");
              setReportModalOpen(true);
            }}
            className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-primary/20 to-blue-600/20 hover:from-primary/30 hover:to-blue-600/30 border border-primary/30 text-primary text-xs font-semibold transition-all flex items-center gap-1.5 shadow-sm hover:scale-105 cursor-pointer"
          >
            <Sunset className="w-3.5 h-3.5 text-primary" />
            <span>🌆 今日收盘复盘</span>
          </button>

          <span className="text-xs text-default-400 ml-1">
            更新: {overview?.updatedAt || "盘中/最新"}
          </span>
          <button
            onClick={() => fetchOverview()}
            disabled={loading["overview"]}
            className="px-3 py-1.5 rounded-xl bg-default-100/80 hover:bg-default-200 text-xs font-medium transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading["overview"] ? "animate-spin text-primary" : ""}`} />
            刷新
          </button>
        </div>
      </div>

      {/* 研报阅读器 Modal */}
      <MarketReportsModal
        isOpen={reportModalOpen}
        initialType={reportModalType}
        onClose={() => setReportModalOpen(false)}
      />

      {/* 核心指标与股债比价罗盘卡片 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* 卡片1: 两市成交额 */}
        <div className="glass-panel p-5 relative overflow-hidden group">
          <div className="flex items-center justify-between text-xs text-default-400 mb-2">
            <span className="flex items-center gap-1.5">
              <Activity className="w-4 h-4 text-emerald-400" /> 沪深两市成交额
            </span>
            <span className="text-[10px] text-emerald-400 font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10">
              高活跃度
            </span>
          </div>
          <div className="text-3xl font-bold tracking-tight mb-1">
            {totalAmount.toLocaleString("zh-CN", { minimumFractionDigits: 1 })}
            <span className="text-sm font-normal text-default-400 ml-1">亿元</span>
          </div>
          <p className="text-[11px] text-default-400">成交量显著放量，市场多头流动性充足</p>
        </div>

        {/* 卡片2: 股债风险溢价比 */}
        <div className="glass-panel p-5 relative overflow-hidden group">
          <div className="flex items-center justify-between text-xs text-default-400 mb-2">
            <span className="flex items-center gap-1.5">
              <Scale className="w-4 h-4 text-amber-400" /> 股债风险溢价比 (ERP)
            </span>
            <span className="text-[10px] text-amber-400 font-semibold px-2 py-0.5 rounded-full bg-amber-500/10">
              极高性价比
            </span>
          </div>
          <div className="text-3xl font-bold tracking-tight mb-1 text-amber-400">
            {riskRatio}
            <span className="text-sm font-normal text-default-400 ml-1">倍</span>
          </div>
          <p className="text-[11px] text-default-400">红利股息率 ({avgDy}%) 为国债的 {riskRatio} 倍</p>
        </div>

        {/* 卡片3: 10年国债收益率 */}
        <div className="glass-panel p-5 relative overflow-hidden group">
          <div className="flex items-center justify-between text-xs text-default-400 mb-2">
            <span className="flex items-center gap-1.5">
              <DollarSign className="w-4 h-4 text-blue-400" /> 10年期国债收益率
            </span>
            <span className="text-[10px] text-blue-400 font-semibold px-2 py-0.5 rounded-full bg-blue-500/10">
              历史低位
            </span>
          </div>
          <div className="text-3xl font-bold tracking-tight mb-1">
            {bondYield}
            <span className="text-sm font-normal text-default-400 ml-1">%</span>
          </div>
          <p className="text-[11px] text-default-400">基准无风险利率降至历史低谷区间</p>
        </div>

        {/* 卡片4: 红利组合平均股息 */}
        <div className="glass-panel p-5 relative overflow-hidden group">
          <div className="flex items-center justify-between text-xs text-default-400 mb-2">
            <span className="flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-violet-400" /> 红利成份股平均股息
            </span>
            <span className="text-[10px] text-violet-400 font-semibold px-2 py-0.5 rounded-full bg-violet-500/10">
              高现金流
            </span>
          </div>
          <div className="text-3xl font-bold tracking-tight mb-1 text-emerald-400">
            {avgDy}
            <span className="text-sm font-normal text-default-400 ml-1">%</span>
          </div>
          <p className="text-[11px] text-default-400">核心红利资产平均年化现金分红收益</p>
        </div>
      </div>

      {/* 核心市场指数网格 */}
      <div className="glass-panel p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-2">
            <Globe2 className="w-5 h-5 text-primary" />
            <h2 className="text-base font-semibold">全球跨市场指数矩阵</h2>
          </div>

          {/* 分类切换 Tab */}
          <SegmentedTabs
            items={[
              { key: "ALL", label: "全部指数" },
              { key: "A_SHARE", label: "A股主板" },
              { key: "DIVIDEND", label: "红利主题" },
              { key: "HK", label: "港股市场" },
              { key: "US", label: "美股三大股指" },
              { key: "KR_JP", label: "韩日市场" },
            ]}
            value={activeCategory}
            onChange={(val) => setActiveCategory(val as any)}
          />
        </div>

        {/* 指数网格列表 */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredIndices.map((item: any) => {
            const isUp = (item.changePct ?? 0) >= 0;
            return (
              <Link
                key={item.code}
                href={`/dividend/${item.code}`}
                className="p-4 rounded-xl bg-default-50/50 hover:bg-default-100/50 border border-divider/40 transition-all cursor-pointer block group hover:scale-[1.01]"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-semibold group-hover:text-primary transition-colors">{item.name}</span>
                  <span className="text-[10px] text-default-400 font-mono px-1.5 py-0.5 rounded bg-default-100">{item.code}</span>
                </div>

                <div className="text-2xl font-bold tracking-tight my-2">
                  {Number(item.price).toLocaleString("zh-CN", { minimumFractionDigits: item.price < 10 ? 3 : 2 })}
                </div>

                <div className="flex items-center justify-between text-xs pt-1 border-t border-divider/30">
                  <span className={`font-semibold ${isUp ? "text-rise" : "text-fall"}`}>
                    {isUp ? "+" : ""}{item.change} ({isUp ? "+" : ""}{item.changePct}%)
                  </span>
                  <span className="text-[10px] text-default-400">
                    成交额: {item.amount ? `${item.amount}亿` : "--"}
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      </div>

      {/* 核心板块龙头风向标 */}
      <div className="glass-panel p-6">
        <div className="flex items-center gap-2 mb-4">
          <Building2 className="w-5 h-5 text-emerald-400" />
          <h2 className="text-base font-semibold">核心红利与防御行业龙头风向</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {leaders.map((stock: any) => {
            const isUp = (stock.changePct ?? 0) >= 0;
            return (
              <a
                key={stock.code}
                href={`/dividend/${stock.code}`}
                className="p-4 rounded-xl bg-default-50/50 hover:bg-default-100/50 border border-divider/40 transition-all block group hover:scale-[1.01]"
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold group-hover:text-primary transition-colors">{stock.name}</span>
                    <span className="text-[10px] text-default-400">{stock.code}</span>
                  </div>
                  <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-default-100 text-default-400">
                    {stock.industry}
                  </span>
                </div>

                <div className="flex items-end justify-between my-2">
                  <span className="text-2xl font-bold tracking-tight">
                    ¥{Number(stock.price).toFixed(2)}
                  </span>
                  <span className={`text-sm font-semibold ${isUp ? "text-rise" : "text-fall"}`}>
                    {isUp ? "+" : ""}{stock.changePct}%
                  </span>
                </div>

                <div className="flex items-center justify-between text-[11px] pt-2 border-t border-divider/30 text-default-400">
                  <span>股息率: <strong className="text-emerald-400">{stock.dividendYield}%</strong></span>
                  <span>市盈率 PE: <strong className="text-foreground">{stock.pe}</strong></span>
                </div>
              </a>
            );
          })}
        </div>
      </div>
    </div>
  );
}
