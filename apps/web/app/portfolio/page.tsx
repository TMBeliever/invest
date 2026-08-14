"use client";

import { useEffect, useState } from "react";
import { usePortfolioStore } from "@investscope/core";
import { SegmentedTabs } from "@investscope/ui";
import {
  Briefcase,
  PieChart,
  Plus,
  RefreshCw,
  ShieldCheck,
  Zap,
  Coins,
  Scale,
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const holdings = summary?.holdings ?? [];
  const totalAssets = summary?.totalAssets ?? 0;
  const totalProfitLoss = summary?.totalProfitLoss ?? 0;
  const totalProfitLossPct = summary?.totalProfitLossPct ?? 0;
  const annualizedReturn = summary?.annualizedReturn ?? 0;
  const alloc = summary?.allocation ?? { core: 0, satellite: 0, reserve: 0 };

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
          <p className="text-sm text-default-400 mt-1">SQLite 本地持久化持仓 · 实时行情与纪律性再平衡</p>
        </div>
        <div className="flex items-center gap-3">
          {loading["summary"] && <RefreshCw className="w-4 h-4 animate-spin text-default-400" />}
          <a
            href="/assets"
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-white text-sm font-medium hover:bg-primary/90 transition-colors shadow-lg shadow-primary/25"
          >
            <Plus className="w-4 h-4" />
            管理与添加资产
          </a>
        </div>
      </div>

      {/* 组合总览卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="glass-panel p-5 animate-fade-in">
          <span className="text-xs text-default-400">总资产规模</span>
          <div className="text-2xl font-bold mt-1 font-mono">¥{totalAssets.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
          <span className="text-xs text-default-400 mt-2 block">包含核心仓/卫星仓/流动储备</span>
        </div>
        <div className="glass-panel p-5 animate-fade-in">
          <span className="text-xs text-default-400">组合累计浮盈</span>
          <div className={`text-2xl font-bold mt-1 font-mono ${totalProfitLoss >= 0 ? "text-rise" : "text-fall"}`}>
            {totalProfitLoss >= 0 ? "+" : ""}¥{totalProfitLoss.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <span className={`text-xs mt-2 block ${totalProfitLoss >= 0 ? "text-rise" : "text-fall"}`}>
            累计收益率 {totalProfitLossPct >= 0 ? "+" : ""}{totalProfitLossPct}%
          </span>
        </div>
        <div className="glass-panel p-5 animate-fade-in">
          <span className="text-xs text-default-400">策略年化收益率 (预估)</span>
          <div className="text-2xl font-bold mt-1 text-primary font-mono">{annualizedReturn}%</div>
          <span className="text-xs text-default-400 mt-2 block">基于当前持仓成本与分红</span>
        </div>
        <div className="glass-panel p-5 animate-fade-in">
          <span className="text-xs text-default-400">资产项总数</span>
          <div className="text-2xl font-bold mt-1 font-mono">{holdings.length}</div>
          <span className="text-xs text-default-400 mt-2 block">当前纳管持仓标的数</span>
        </div>
      </div>

      {/* 再平衡信号 */}
      <div className="mb-6">
        <h2 className="text-base font-semibold mb-3 flex items-center gap-2">
          <Scale className="w-5 h-5 text-amber-500" />
          纪律性再平衡信号
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {rebalanceSignals.length === 0 ? (
            <div className="col-span-3 glass-panel p-4 text-center text-xs text-default-400">
              当前持仓与预设核心 60% / 卫星 30% / 储备 10% 目标保持均衡，无触发调仓阈值。
            </div>
          ) : (
            rebalanceSignals.map((s, idx) => (
              <div key={idx} className="glass-panel p-4 border-l-4 border-amber-500">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold">{s.category}</span>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full ${s.type === "WARNING" ? "bg-red-500/15 text-red-400" : "bg-amber-500/15 text-amber-400"}`}>
                    {s.type}
                  </span>
                </div>
                <p className="text-xs text-default-300 mb-2">{s.message}</p>
                <div className="flex items-center justify-between text-[11px] text-default-400 font-mono">
                  <span>当前: {s.currentWeight}%</span>
                  <span>目标: {s.targetWeight}%</span>
                  <span>偏离: {s.deviation > 0 ? `+${s.deviation}` : s.deviation}%</span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* 仓位分布与目标对比 */}
      <div className="glass-panel p-6 mb-6 animate-fade-in">
        <h2 className="text-base font-semibold mb-4">核心-卫星分层监控</h2>
        <div className="space-y-4">
          <div>
            <div className="flex justify-between text-xs mb-1">
              <span className="font-medium">🏛️ 核心底仓 (红利+纯债)</span>
              <span className="font-mono">{alloc.core}% / 目标 60%</span>
            </div>
            <div className="h-3 bg-default-100 rounded-full overflow-hidden">
              <div className="h-full bg-blue-500 rounded-full transition-all duration-500" style={{ width: `${Math.min(alloc.core, 100)}%` }} />
            </div>
          </div>
          <div>
            <div className="flex justify-between text-xs mb-1">
              <span className="font-medium">🚀 卫星配置 (指数增强/行业)</span>
              <span className="font-mono">{alloc.satellite}% / 目标 30%</span>
            </div>
            <div className="h-3 bg-default-100 rounded-full overflow-hidden">
              <div className="h-full bg-violet-500 rounded-full transition-all duration-500" style={{ width: `${Math.min(alloc.satellite, 100)}%` }} />
            </div>
          </div>
          <div>
            <div className="flex justify-between text-xs mb-1">
              <span className="font-medium">🛡️ 战术储备金 (现金/货币)</span>
              <span className="font-mono">{alloc.reserve}% / 目标 10%</span>
            </div>
            <div className="h-3 bg-default-100 rounded-full overflow-hidden">
              <div className="h-full bg-emerald-500 rounded-full transition-all duration-500" style={{ width: `${Math.min(alloc.reserve, 100)}%` }} />
            </div>
          </div>
        </div>
      </div>

      {/* 持仓列表 */}
      <div className="glass-panel overflow-hidden animate-fade-in">
        <div className="p-5 border-b border-divider flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h2 className="text-base font-semibold">持仓明细 (数据库持久化)</h2>
            <SegmentedTabs
              items={[
                { key: "ALL", label: "全部" },
                { key: "CORE", label: "核心仓" },
                { key: "SATELLITE", label: "卫星仓" },
                { key: "RESERVE", label: "储备金" },
              ]}
              value={filterCategory}
              onChange={(val) => setFilterCategory(val as any)}
              size="sm"
            />
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
              {filteredHoldings.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-10 text-center text-xs text-default-400">
                    暂未录入该分类持仓，请点击右上角「管理与添加资产」录入
                  </td>
                </tr>
              ) : (
                filteredHoldings.map((h) => {
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
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
