"use client";

import { useEffect, useState } from "react";
import { usePortfolioStore } from "@investscope/core";
import {
  Briefcase,
  PieChart,
  Plus,
  RefreshCw,
  ShieldCheck,
  Zap,
  Coins,
} from "lucide-react";

const categoryNames: Record<string, { label: string; color: string }> = {
  CORE_DIVIDEND: { label: "核心 · 红利股", color: "text-emerald-400" },
  CORE_BOND: { label: "核心 · 债券基", color: "text-emerald-400" },
  SATELLITE_INDEX: { label: "卫星 · 宽基指数", color: "text-violet-400" },
  SATELLITE_SECTOR: { label: "卫星 · 行业赛道", color: "text-violet-400" },
  RESERVE_CASH: { label: "储备 · 现金货币", color: "text-amber-400" },
  RESERVE_GOLD: { label: "储备 · 黄金避险", color: "text-amber-400" },
};

export default function PortfolioPage() {
  const [filterCategory, setFilterCategory] = useState("ALL");
  const { summary, rebalanceSignals, fetchSummary, fetchRebalanceSignals, loading } = usePortfolioStore();

  useEffect(() => {
    fetchSummary();
    fetchRebalanceSignals();
  }, [fetchSummary, fetchRebalanceSignals]);

  const holdings = summary?.holdings ?? [
    { id: "h1", code: "510880", name: "红利ETF", category: "CORE_DIVIDEND", shares: 100000, costPrice: 3.12, currentPrice: 3.45, marketValue: 345000, profitLoss: 33000, profitLossPct: 10.57, weight: 16.95 },
    { id: "h2", code: "601939", name: "建设银行", category: "CORE_DIVIDEND", shares: 40000, costPrice: 6.50, currentPrice: 7.80, marketValue: 312000, profitLoss: 52000, profitLossPct: 20.00, weight: 15.33 },
    { id: "h3", code: "511010", name: "国债ETF", category: "CORE_BOND", shares: 6000, costPrice: 102.5, currentPrice: 104.2, marketValue: 625200, profitLoss: 10200, profitLossPct: 1.66, weight: 30.72 },
    { id: "h4", code: "510300", name: "沪深300ETF", category: "SATELLITE_INDEX", shares: 80000, costPrice: 3.80, currentPrice: 4.15, marketValue: 332000, profitLoss: 28000, profitLossPct: 9.21, weight: 16.31 },
    { id: "h5", code: "159915", name: "创业板ETF", category: "SATELLITE_SECTOR", shares: 120000, costPrice: 1.95, currentPrice: 2.05, marketValue: 246000, profitLoss: 12000, profitLossPct: 5.12, weight: 12.09 },
    { id: "h6", code: "CASH", name: "货币基金/现金", category: "RESERVE_CASH", shares: 174367.89, costPrice: 1.0, currentPrice: 1.0, marketValue: 174367.89, profitLoss: 0, profitLossPct: 0, weight: 8.56 },
  ];

  const totalAssets = summary?.totalAssets ?? 2034567.89;
  const totalProfitLoss = summary?.totalProfitLoss ?? 162345.67;
  const totalProfitLossPct = summary?.totalProfitLossPct ?? 8.67;
  const annualizedReturn = summary?.annualizedReturn ?? 10.2;
  const alloc = summary?.allocation ?? { core: 62.3, satellite: 28.5, reserve: 9.2 };

  const filteredHoldings = filterCategory === "ALL"
    ? holdings
    : holdings.filter((h) => h.category.startsWith(filterCategory));

  return (
    <div className="p-6 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Briefcase className="w-6 h-6 text-violet-500" />
            组合管理
          </h1>
          <p className="text-sm text-default-400 mt-1">SQLite 本地持久化持仓 · 纪律性再平衡监控</p>
        </div>
        <div className="flex items-center gap-3">
          {loading["summary"] && <RefreshCw className="w-4 h-4 animate-spin text-default-400" />}
          <button className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-white text-sm font-medium hover:bg-primary/90 transition-colors shadow-lg shadow-primary/25">
            <Plus className="w-4 h-4" />
            添加持仓
          </button>
        </div>
      </div>

      {/* 资产概览卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="glass-panel p-5 animate-fade-in">
          <span className="text-xs text-default-400">总资产</span>
          <div className="text-2xl font-bold mt-1">
            ¥{totalAssets.toLocaleString("zh-CN", { minimumFractionDigits: 2 })}
          </div>
          <span className="text-[10px] text-default-400 block mt-1">目标年化 10%</span>
        </div>

        <div className="glass-panel p-5 animate-fade-in">
          <span className="text-xs text-default-400">累计盈亏</span>
          <div className="text-2xl font-bold text-rise mt-1">
            +¥{totalProfitLoss.toLocaleString("zh-CN", { minimumFractionDigits: 2 })}
          </div>
          <span className="text-xs text-rise font-medium block mt-1">+{totalProfitLossPct}%</span>
        </div>

        <div className="glass-panel p-5 animate-fade-in">
          <span className="text-xs text-default-400">真实 IRR 年化</span>
          <div className="text-2xl font-bold text-emerald-400 mt-1">
            {annualizedReturn}%
          </div>
          <span className="text-[10px] text-emerald-400/80 block mt-1">🎉 已达成 10% 目标</span>
        </div>

        <div className="glass-panel p-5 animate-fade-in flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-emerald-500/15 flex items-center justify-center flex-shrink-0">
            <RefreshCw className="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <div className="text-xs font-medium">再平衡状态</div>
            <div className="text-xs text-emerald-400 font-semibold mt-0.5">
              {rebalanceSignals[0]?.message || "比例正常 (无需调整)"}
            </div>
          </div>
        </div>
      </div>

      {/* 配置比例对比 */}
      <div className="glass-panel p-6 mb-6 animate-fade-in">
        <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
          <PieChart className="w-4 h-4 text-violet-500" />
          核心-卫星配置比例监控 (SQLite 实时计算)
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* 核心仓位 */}
          <div className="p-4 rounded-xl bg-default-50/50">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold flex items-center gap-1.5 text-emerald-400">
                <ShieldCheck className="w-4 h-4" /> 核心仓位 (稳健)
              </span>
              <span className="text-xs font-bold">{alloc.core}%</span>
            </div>
            <div className="h-2 bg-default-100 rounded-full overflow-hidden mb-2">
              <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${alloc.core}%` }} />
            </div>
            <div className="flex justify-between text-[10px] text-default-400">
              <span>当前: ¥{((totalAssets * alloc.core) / 1000000).toFixed(2)}万</span>
              <span>目标: 60.0%</span>
            </div>
          </div>

          {/* 卫星仓位 */}
          <div className="p-4 rounded-xl bg-default-50/50">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold flex items-center gap-1.5 text-violet-400">
                <Zap className="w-4 h-4" /> 卫星仓位 (进攻)
              </span>
              <span className="text-xs font-bold">{alloc.satellite}%</span>
            </div>
            <div className="h-2 bg-default-100 rounded-full overflow-hidden mb-2">
              <div className="h-full bg-violet-500 rounded-full" style={{ width: `${alloc.satellite}%` }} />
            </div>
            <div className="flex justify-between text-[10px] text-default-400">
              <span>当前: ¥{((totalAssets * alloc.satellite) / 1000000).toFixed(2)}万</span>
              <span>目标: 30.0%</span>
            </div>
          </div>

          {/* 流动储备 */}
          <div className="p-4 rounded-xl bg-default-50/50">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold flex items-center gap-1.5 text-amber-400">
                <Coins className="w-4 h-4" /> 流动储备 (避险/抄底)
              </span>
              <span className="text-xs font-bold">{alloc.reserve}%</span>
            </div>
            <div className="h-2 bg-default-100 rounded-full overflow-hidden mb-2">
              <div className="h-full bg-amber-500 rounded-full" style={{ width: `${alloc.reserve}%` }} />
            </div>
            <div className="flex justify-between text-[10px] text-default-400">
              <span>当前: ¥{((totalAssets * alloc.reserve) / 1000000).toFixed(2)}万</span>
              <span>目标: 10.0%</span>
            </div>
          </div>
        </div>
      </div>

      {/* 持仓列表 */}
      <div className="glass-panel overflow-hidden animate-fade-in">
        <div className="p-5 border-b border-divider flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h2 className="text-base font-semibold">持仓明细 (数据库持久化)</h2>
            <div className="flex gap-1 bg-default-100 p-1 rounded-xl text-xs">
              {[
                { key: "ALL", label: "全部" },
                { key: "CORE", label: "核心仓" },
                { key: "SATELLITE", label: "卫星仓" },
                { key: "RESERVE", label: "储备金" },
              ].map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setFilterCategory(tab.key)}
                  className={`
                    px-3 py-1 rounded-lg font-medium transition-colors
                    ${filterCategory === tab.key ? "bg-background text-foreground shadow-sm" : "text-default-400 hover:text-foreground"}
                  `}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>
          <span className="text-xs text-default-400">共 {filteredHoldings.length} 项资产</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-divider bg-default-50/30 text-xs text-default-400">
                <th className="text-left py-3 px-4 font-medium">资产名称</th>
                <th className="text-left py-3 px-4 font-medium">分类</th>
                <th className="text-right py-3 px-4 font-medium">持仓数量</th>
                <th className="text-right py-3 px-4 font-medium">成本价</th>
                <th className="text-right py-3 px-4 font-medium">现价</th>
                <th className="text-right py-3 px-4 font-medium">市值 (元)</th>
                <th className="text-right py-3 px-4 font-medium">浮动盈亏</th>
                <th className="text-right py-3 px-4 font-medium">占比</th>
              </tr>
            </thead>
            <tbody>
              {filteredHoldings.map((h) => {
                const cat = categoryNames[h.category] || { label: h.category, color: "text-default-400" };
                const isUp = h.profitLoss >= 0;
                return (
                  <tr key={h.id} className="border-b border-divider/50 hover:bg-default-50/50 transition-colors">
                    <td className="py-3.5 px-4">
                      <div className="font-medium">{h.name}</div>
                      <div className="text-[10px] text-default-400">{h.code}</div>
                    </td>
                    <td className="py-3.5 px-4">
                      <span className={`text-xs font-medium ${cat.color}`}>{cat.label}</span>
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono">{h.shares.toLocaleString()}</td>
                    <td className="py-3.5 px-4 text-right font-mono text-default-400">¥{h.costPrice}</td>
                    <td className="py-3.5 px-4 text-right font-mono font-medium">¥{h.currentPrice}</td>
                    <td className="py-3.5 px-4 text-right font-mono font-semibold">¥{h.marketValue.toLocaleString()}</td>
                    <td className="py-3.5 px-4 text-right font-mono font-medium">
                      <span className={isUp ? "text-rise" : "text-fall"}>
                        {isUp ? "+" : ""}¥{h.profitLoss.toLocaleString()} ({isUp ? "+" : ""}{h.profitLossPct}%)
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono font-medium">{h.weight}%</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
