"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useDividendStore } from "@investscope/core";
import {
  CalendarDays,
  Coins,
  TrendingUp,
  Landmark,
  Sparkles,
  RefreshCw,
  SlidersHorizontal,
  ChevronRight,
  ShieldCheck,
  Zap,
  ArrowUpRight,
  PieChart,
  DollarSign,
  Coffee,
  PiggyBank,
  CheckCircle2,
  Info,
} from "lucide-react";

export default function DividendCalendarPage() {
  const { calendarData, fetchDividendCalendar, loading, error } = useDividendStore();
  const [monthlyExpense, setMonthlyExpense] = useState(8000);
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<"ALL" | "STOCK" | "DEPOSIT">("ALL");

  useEffect(() => {
    fetchDividendCalendar(monthlyExpense);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [monthlyExpense]);

  const summary = calendarData?.summary || {
    totalAnnualCashflow: 0,
    monthlyAverageCashflow: 0,
    dailyAverageCashflow: 0,
    monthlyLivingExpenseTarget: 8000,
    financialFreedomCoveragePct: 0,
    totalEventsCount: 0,
    activeEquityCount: 0,
  };

  const monthlySeries = calendarData?.monthlySeries || [];
  const timelineEvents = calendarData?.timelineEvents || [];
  const topSources = calendarData?.topSources || [];

  // 过滤事件列表
  const filteredEvents = timelineEvents.filter((evt) => {
    if (selectedMonth && evt.month !== selectedMonth) return false;
    if (filterType === "STOCK" && evt.assetType !== "STOCK_DIVIDEND") return false;
    if (filterType === "DEPOSIT" && evt.assetType !== "DEPOSIT_INTEREST") return false;
    return true;
  });

  // 计算最高月度现金流，用于柱状图高度比例基准
  const maxMonthlyCashflow = Math.max(...monthlySeries.map((m) => m.totalCashflow), 500);

  return (
    <div className="p-6 max-w-[1400px] mx-auto space-y-6 animate-fade-in">
      {/* 顶部面包屑与标题 */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-1.5 text-xs text-default-400 mb-1">
            <Link href="/dividend" className="hover:text-primary transition-colors">
              红利专区
            </Link>
            <ChevronRight className="w-3 h-3" />
            <span className="text-foreground font-medium">💸 真实被动现金流日历</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2.5">
            <CalendarDays className="w-6 h-6 text-emerald-400" />
            未来 12 个月分红与利息现金流预测日历
          </h1>
          <p className="text-xs text-default-400 mt-1">
            穿透上市公司已披露分红实施公告与近 3 年同季派息周期，推演未来 12 个月月度真金白银落袋节奏。
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            onClick={() => fetchDividendCalendar(monthlyExpense, true)}
            disabled={loading["dividendCalendar"]}
            className="px-3 py-1.5 rounded-xl bg-default-100 hover:bg-default-200 text-xs text-default-600 transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading["dividendCalendar"] ? "animate-spin text-primary" : ""}`} />
            <span>刷新实盘预测</span>
          </button>
        </div>
      </div>

      {/* 严谨口径说明条 */}
      <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-start gap-3">
        <Info className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
        <div className="text-xs text-default-300 leading-relaxed">
          <b className="text-emerald-300">真·被动现金流统计准则：</b>
          本系统严格只统计直接转入证券账户可用余额的<b>「个股现金分红」</b>与银行卡的<b>「定存到期结息」</b>。默认已将净值增长型公募基金（如纯债基金、指数基金）剔除，确保测算出来的每一笔现金都是不减持本金的前提下真实落袋的资金。
        </div>
      </div>

      {/* 4 大核心指标卡 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* 卡片 1: 未来12个月总现金流 */}
        <div className="glass-panel p-5 relative overflow-hidden group">
          <div className="flex items-center justify-between text-xs text-default-400 mb-2">
            <span className="flex items-center gap-1.5">
              <Coins className="w-4 h-4 text-emerald-400" /> 年预计真实现金分红
            </span>
            <span className="text-[10px] text-emerald-400 font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10">
              真实分红
            </span>
          </div>
          <div className="text-3xl font-bold tracking-tight mb-1 text-emerald-400">
            ¥{summary.totalAnnualCashflow.toLocaleString("zh-CN", { minimumFractionDigits: 2 })}
          </div>
          <p className="text-[11px] text-default-400">
            涵盖持仓高股息标的，现金直接打入可用资金
          </p>
        </div>

        {/* 卡片 2: 月均被动收入 */}
        <div className="glass-panel p-5 relative overflow-hidden group">
          <div className="flex items-center justify-between text-xs text-default-400 mb-2">
            <span className="flex items-center gap-1.5">
              <PiggyBank className="w-4 h-4 text-primary" /> 月均被动现金落袋
            </span>
            <span className="text-[10px] text-primary font-semibold px-2 py-0.5 rounded-full bg-primary/10">
              睡后收入
            </span>
          </div>
          <div className="text-3xl font-bold tracking-tight mb-1 text-primary">
            ¥{summary.monthlyAverageCashflow.toLocaleString("zh-CN", { minimumFractionDigits: 2 })}
            <span className="text-sm font-normal text-default-400 ml-1">/月</span>
          </div>
          <p className="text-[11px] text-default-400">
            折合每日产生现金约 <b className="text-foreground">¥{summary.dailyAverageCashflow}</b>
          </p>
        </div>

        {/* 卡片 3: 财务自由生活费替代率 */}
        <div className="glass-panel p-5 relative overflow-hidden group">
          <div className="flex items-center justify-between text-xs text-default-400 mb-2">
            <span className="flex items-center gap-1.5">
              <Coffee className="w-4 h-4 text-amber-400" /> 生活开销替代率
            </span>
            <span className="text-[10px] text-amber-400 font-semibold px-2 py-0.5 rounded-full bg-amber-500/10">
              自由进度
            </span>
          </div>
          <div className="text-3xl font-bold tracking-tight mb-1 text-amber-400">
            {summary.financialFreedomCoveragePct}%
          </div>
          <div className="w-full bg-default-100 rounded-full h-1.5 overflow-hidden my-1.5">
            <div
              className="h-full rounded-full bg-gradient-to-r from-amber-500 to-emerald-500 transition-all duration-500"
              style={{ width: `${Math.min(100, summary.financialFreedomCoveragePct * 2)}%` }}
            />
          </div>
          <p className="text-[11px] text-default-400">
            按月生活费目标 ¥{monthlyExpense.toLocaleString()} 计算
          </p>
        </div>

        {/* 卡片 4: 现金流事件与到账频次 */}
        <div className="glass-panel p-5 relative overflow-hidden group">
          <div className="flex items-center justify-between text-xs text-default-400 mb-2">
            <span className="flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-violet-400" /> 年预计分红批次
            </span>
            <span className="text-[10px] text-violet-400 font-semibold px-2 py-0.5 rounded-full bg-violet-500/10">
              真实节点
            </span>
          </div>
          <div className="text-3xl font-bold tracking-tight mb-1 text-violet-400">
            {summary.totalEventsCount}
            <span className="text-sm font-normal text-default-400 ml-1">次</span>
          </div>
          <p className="text-[11px] text-default-400">
            包含年中年度分红与三季报/中报中期派息
          </p>
        </div>
      </div>

      {/* 财务自由目标调节滑块 */}
      <div className="p-4 rounded-2xl bg-black/20 border border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <SlidersHorizontal className="w-4 h-4 text-amber-400 shrink-0" />
          <div>
            <div className="text-xs font-semibold text-white">调整每月生活支出基准目标</div>
            <div className="text-[10px] text-default-400">系统将根据此基准自动推导被动分红替代工薪的进度</div>
          </div>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="flex items-center gap-1.5">
            {[3000, 5000, 8000, 12000].map((val) => (
              <button
                key={val}
                onClick={() => setMonthlyExpense(val)}
                className={`px-2.5 py-1 rounded-lg text-xs font-mono transition-all cursor-pointer ${
                  monthlyExpense === val
                    ? "bg-amber-500/20 text-amber-300 border border-amber-500/40 font-bold"
                    : "bg-white/5 text-default-400 hover:text-white"
                }`}
              >
                ¥{val.toLocaleString()}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <input
              type="range"
              min={2000}
              max={25000}
              step={500}
              value={monthlyExpense}
              onChange={(e) => setMonthlyExpense(parseInt(e.target.value))}
              className="accent-amber-400 cursor-pointer w-28 sm:w-36 h-1.5 bg-default-100 rounded-lg"
            />
            <span className="text-xs font-mono font-bold text-amber-300 min-w-[70px] text-right">
              ¥{monthlyExpense.toLocaleString()}
            </span>
          </div>
        </div>
      </div>

      {/* 中间区：未来 12 个月月度现金流流入分布 + 现金流贡献排行榜 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 柱状趋势图 */}
        <div className="lg:col-span-2 glass-panel p-6 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-emerald-400" />
                未来 12 个月月度现金流入分布
              </h2>
              <p className="text-xs text-default-400 mt-0.5">
                点击月份可联动筛选下方对应的真实分红批次
              </p>
            </div>

            {/* 图例 */}
            <div className="flex items-center gap-3 text-[11px] text-default-400">
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500" /> 股票现金分红
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-sm bg-amber-500" /> 定期存款利息
              </span>
            </div>
          </div>

          {/* 柱状图本体 */}
          <div className="h-64 flex items-end gap-2 sm:gap-3 pt-6 border-b border-divider/50 pb-2">
            {monthlySeries.map((m) => {
              const heightPct = m.totalCashflow > 0 ? Math.max(12, (m.totalCashflow / maxMonthlyCashflow) * 100) : 0;
              const isSelected = selectedMonth === m.month;
              return (
                <div
                  key={m.month}
                  onClick={() => setSelectedMonth(isSelected ? null : m.month)}
                  className={`flex-1 flex flex-col items-center gap-1.5 h-full justify-end group cursor-pointer transition-all ${
                    isSelected ? "scale-105" : "hover:opacity-90"
                  }`}
                >
                  <div className="text-[10px] font-mono text-default-400 group-hover:text-emerald-300 transition-colors">
                    {m.totalCashflow > 0 ? `¥${Math.round(m.totalCashflow)}` : "-"}
                  </div>

                  {/* 多色堆叠柱 */}
                  <div
                    className={`w-full max-w-[40px] rounded-t-lg overflow-hidden flex flex-col justify-end transition-all ${
                      isSelected ? "ring-2 ring-primary ring-offset-2 ring-offset-background" : ""
                    }`}
                    style={{ height: `${heightPct}%` }}
                  >
                    {m.stockDividends > 0 && (
                      <div
                        className="w-full bg-emerald-500/90"
                        style={{ height: `${(m.stockDividends / m.totalCashflow) * 100}%` }}
                      />
                    )}
                    {m.depositInterest > 0 && (
                      <div
                        className="w-full bg-amber-500/90"
                        style={{ height: `${(m.depositInterest / m.totalCashflow) * 100}%` }}
                      />
                    )}
                    {m.totalCashflow === 0 && <div className="w-full h-1 bg-default-100/50 rounded-full" />}
                  </div>

                  <div
                    className={`text-[10px] font-mono whitespace-nowrap mt-1 ${
                      isSelected ? "text-primary font-bold" : "text-default-400"
                    }`}
                  >
                    {m.month.slice(5)}月
                  </div>
                </div>
              );
            })}
          </div>

          {selectedMonth && (
            <div className="flex items-center justify-between p-2.5 rounded-xl bg-primary/10 border border-primary/20 text-xs text-primary">
              <span>已选定查看 <b>{selectedMonth}</b> 单月分红明细</span>
              <button
                onClick={() => setSelectedMonth(null)}
                className="text-[11px] underline hover:text-white cursor-pointer"
              >
                清除单月筛选
              </button>
            </div>
          )}
        </div>

        {/* 现金流贡献排行榜 */}
        <div className="glass-panel p-6 space-y-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <Landmark className="w-4 h-4 text-primary" />
                分红现金流贡献榜
              </h3>
              <span className="text-[10px] text-default-400">年度真实现金贡献</span>
            </div>
            <p className="text-xs text-default-400 leading-relaxed mb-4">
              以下标的为您提供最确定的长线现金分红收入。
            </p>

            <div className="space-y-3">
              {topSources.map((item, idx) => (
                <div key={item.name} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2 truncate">
                      <span className="w-4 h-4 rounded-full bg-default-100 flex items-center justify-center text-[10px] font-bold text-default-500">
                        {idx + 1}
                      </span>
                      <span className="font-medium truncate">{item.name}</span>
                    </div>
                    <span className="font-mono font-bold text-emerald-400">
                      ¥{item.annualAmount.toLocaleString("zh-CN", { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div className="w-full bg-default-100 rounded-full h-1.5 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-emerald-500/80"
                      style={{ width: `${Math.min(100, item.ratio)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="p-3 rounded-xl bg-black/20 border border-white/5 text-[11px] text-default-400 leading-relaxed">
            💡 提示：收到现金分红后，可选择留在可用余额进行逢低加仓，或在设置中配置【再平衡策略】实现复利滚雪球。
          </div>
        </div>
      </div>

      {/* 底部区：真实分红与利息到账日程表 */}
      <div className="glass-panel p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-divider/50">
          <div>
            <h3 className="text-base font-semibold flex items-center gap-2">
              <CalendarDays className="w-5 h-5 text-primary" />
              分红与利息到账事件日程表
            </h3>
            <span className="text-xs text-default-400">
              共筛选出 {filteredEvents.length} 笔实际到账分红批次
            </span>
          </div>

          {/* 分类过滤器 */}
          <div className="flex items-center gap-1.5">
            {[
              { key: "ALL", label: "全部类别" },
              { key: "STOCK", label: "股票现金分红" },
              { key: "DEPOSIT", label: "定存利息" },
            ].map((t) => (
              <button
                key={t.key}
                onClick={() => setFilterType(t.key as any)}
                className={`px-3 py-1 rounded-xl text-xs transition-all cursor-pointer ${
                  filterType === t.key
                    ? "bg-primary text-primary-foreground font-semibold shadow-sm"
                    : "bg-default-100 text-default-500 hover:text-foreground"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {filteredEvents.length === 0 ? (
          <div className="py-12 text-center text-xs text-default-400">
            暂无匹配的现金流事件，请切换筛选条件
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {filteredEvents.map((evt) => {
              const isConfirmed = evt.status === "CONFIRMED";
              return (
                <div
                  key={evt.id}
                  className="p-4 rounded-2xl bg-default-50/40 hover:bg-default-50 border border-divider/40 transition-all flex flex-col justify-between space-y-3 group"
                >
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 truncate">
                        <span className="text-sm font-bold text-foreground group-hover:text-primary transition-colors truncate">
                          {evt.name}
                        </span>
                        {evt.symbol && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-default-100 text-default-400 font-mono">
                            {evt.symbol}
                          </span>
                        )}
                      </div>
                      <span
                        className={`text-[9px] px-2 py-0.5 rounded-full font-medium ${
                          isConfirmed
                            ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 font-semibold"
                            : "bg-amber-500/15 text-amber-300 border border-amber-500/20"
                        }`}
                      >
                        {evt.statusLabel || "同季预估"}
                      </span>
                    </div>

                    <p className="text-[11px] text-default-400 leading-relaxed">
                      {evt.description}
                    </p>
                  </div>

                  <div className="pt-2.5 border-t border-divider/40 flex items-center justify-between">
                    <span className="text-xs font-mono text-default-400">
                      📅 预计 {evt.date}
                    </span>
                    <span className="text-base font-bold font-mono text-emerald-400">
                      +¥{evt.amount.toLocaleString("zh-CN", { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
