"use client";

import { useEffect, useState } from "react";
import { useDividendStore, type DividendStrategy } from "@investscope/core";
import { SegmentedTabs } from "@investscope/ui";
import {
  Thermometer,
  Search,
  Award,
  RefreshCw,
  ArrowRight,
  TrendingUp,
  ShieldCheck,
  Zap,
  Coins,
  Scale,
} from "lucide-react";

const strategyTabs: { key: DividendStrategy; label: string; icon: any; desc: string }[] = [
  { key: "composite",  label: "🏆 综合高胜率", icon: Award,       desc: "兼顾股息率、低 PE、低 PB 的三维量化评分降序排列" },
  { key: "high_yield", label: "💰 绝对高股息", icon: Coins,       desc: "筛选股息率 ≥ 4.0% 的高现金流资产，按股息率降序排列" },
  { key: "break_net",  label: "🛡️ 破净防守榜", icon: ShieldCheck, desc: "筛选市净率 PB < 1.0 且股息率 ≥ 3.0% 的破净资产，按 PB 升序排列" },
  { key: "high_roe",   label: "👑 优质高ROE",  icon: Zap,         desc: "筛选 ROE ≥ 8.0% 且 PE ≤ 18.0 的高盈利品质资产，按 ROE 降序排列" },
  { key: "low_pe",     label: "💎 低PE洼地",   icon: Scale,       desc: "筛选动态市盈率 PE ≤ 10.0 的估值洼地，按 PE 升序排列" },
];

const signalConfig: Record<string, { label: string; class: string }> = {
  STRONG_BUY: { label: "强烈买入", class: "bg-emerald-500/15 text-emerald-400 border border-emerald-500/20" },
  BUY: { label: "买入", class: "bg-green-500/15 text-green-400 border border-green-500/20" },
  HOLD: { label: "持有", class: "bg-yellow-500/15 text-yellow-400 border border-yellow-500/20" },
  SELL: { label: "卖出", class: "bg-orange-500/15 text-orange-400 border border-orange-500/20" },
  STRONG_SELL: { label: "强烈卖出", class: "bg-red-500/15 text-red-400 border border-red-500/20" },
};

export default function DividendPage() {
  const [searchCode, setSearchCode] = useState("");
  const { temperature, topStocks, strategy, fetchTemperature, fetchTopStocks, setStrategy, loading } = useDividendStore();

  useEffect(() => {
    fetchTemperature();
    fetchTopStocks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchCode.trim()) {
      window.location.href = `/dividend/${searchCode.trim()}`;
    }
  };

  const tempVal = temperature?.temperature ?? 0;
  const suggestion = temperature?.suggestion ?? "板块数据加载中...";

  const indicators = temperature && temperature.indicators ? [
    { name: "PE百分位", score: temperature.indicators.pePercentile ?? 50, desc: "处于历史低位，便宜" },
    { name: "股息率", score: temperature.indicators.dividendYield ?? 50, desc: "高于历史中位数" },
    { name: "股息率/国债比", score: temperature.indicators.yieldVsBondRatio ?? 50, desc: "相对债券具备性价比" },
    { name: "超额收益60日", score: temperature.indicators.excessReturn60d ?? 50, desc: "相对大盘表现" },
    { name: "ETF资金流", score: temperature.indicators.etfFlowScore ?? 50, desc: "净资金流向" },
    { name: "破净率", score: temperature.indicators.breakNetRatio ?? 50, desc: "成份股破净状况" },
    { name: "北向资金", score: temperature.indicators.northboundChange ?? 50, desc: "外资持仓动向" },
  ] : [];

  const filteredStocks = searchCode.trim()
    ? topStocks.filter((s) => s.code.includes(searchCode.trim()) || s.name.includes(searchCode.trim()))
    : topStocks;

  return (
    <div className="p-6 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Thermometer className="w-6 h-6 text-primary" />
            红利测温
          </h1>
          <p className="text-sm text-default-400 mt-1">板块温度 · 胜率排行 · 个股体检 (支持任意股票代码搜诊)</p>
        </div>

        {/* 搜索框 */}
        <form onSubmit={handleSearchSubmit} className="relative flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-default-400" />
            <input
              type="text"
              placeholder="输入股票代码(如600519)回车测温..."
              value={searchCode}
              onChange={(e) => setSearchCode(e.target.value)}
              className="pl-9 pr-4 py-2.5 w-72 rounded-xl bg-default-100 text-sm border border-transparent focus:border-primary focus:outline-none transition-colors"
            />
          </div>
          <button type="submit" className="p-2.5 rounded-xl bg-primary/10 text-primary hover:bg-primary/20 transition-colors">
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>
      </div>

      {/* 温度计大卡片 */}
      <div className="glass-panel p-8 mb-6 animate-fade-in">
        {loading["temperature"] && !temperature ? (
          <div className="py-12 text-center text-xs text-default-400">
            <RefreshCw className="w-4 h-4 animate-spin inline mr-1" /> 实时抓取并计算红利板块温度...
          </div>
        ) : (
          <>
            <div className="flex items-start gap-8">
              {/* 左侧 - 温度 */}
              <div className="flex-shrink-0 text-center">
                <div className="relative inline-flex items-center justify-center w-36 h-36">
                  <svg viewBox="0 0 120 120" className="w-full h-full -rotate-90">
                    <circle cx="60" cy="60" r="52" fill="none" stroke="currentColor" className="text-default-100" strokeWidth="8" />
                    <circle
                      cx="60" cy="60" r="52" fill="none"
                      strokeWidth="8" strokeLinecap="round"
                      strokeDasharray={`${(tempVal / 100) * 327} 327`}
                      className={
                        tempVal < 30 ? "stroke-blue-500" :
                        tempVal < 60 ? "stroke-yellow-500" :
                        tempVal < 80 ? "stroke-orange-500" : "stroke-red-500"
                      }
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-3xl font-bold">{tempVal}°</span>
                    <span className="text-[10px] text-default-400">偏冷 · 贪婪区</span>
                  </div>
                </div>
              </div>

              {/* 右侧 - 指标列表 */}
              <div className="flex-1 grid grid-cols-2 gap-3">
                {indicators.map((ind) => (
                  <div key={ind.name} className="flex items-center gap-3 p-3 rounded-xl bg-default-50/50">
                    <div className="relative w-10 h-10 flex-shrink-0">
                      <svg viewBox="0 0 40 40" className="w-full h-full -rotate-90">
                        <circle cx="20" cy="20" r="16" fill="none" stroke="currentColor" className="text-default-100" strokeWidth="3" />
                        <circle
                          cx="20" cy="20" r="16" fill="none" strokeWidth="3" strokeLinecap="round"
                          strokeDasharray={`${(ind.score / 100) * 100.5} 100.5`}
                          className={
                            ind.score < 40 ? "stroke-emerald-500" :
                            ind.score < 60 ? "stroke-yellow-500" : "stroke-red-400"
                          }
                        />
                      </svg>
                      <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold">{ind.score}</span>
                    </div>
                    <div>
                      <div className="text-xs font-medium">{ind.name}</div>
                      <div className="text-[10px] text-default-400">{ind.desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="mt-6 p-4 rounded-xl bg-primary/5 border border-primary/10">
              <p className="text-sm">💡 <strong>板块建议：</strong>{suggestion}</p>
            </div>
          </>
        )}
      </div>

      {/* 排行表格 */}
      <div className="glass-panel overflow-hidden animate-fade-in">
        <div className="p-5 border-b border-divider space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <h2 className="text-base font-semibold flex items-center gap-2">
              <Award className="w-5 h-5 text-amber-500" />
              中证红利 & 高股息成份股排行榜 ({filteredStocks.length} 只)
            </h2>
            <div className="flex items-center gap-2">
              {loading["topStocks"] && <RefreshCw className="w-3.5 h-3.5 animate-spin text-default-400" />}
              <span className="text-xs text-default-400">点击任意行查看单股 360 度体检报告</span>
            </div>
          </div>

          {/* 策略切页 Tab - 统一 SegmentedTabs 规范 */}
          <SegmentedTabs
            items={strategyTabs}
            value={strategy}
            onChange={setStrategy}
          />

          {/* 当前选中的策略说明 Banner */}
          {(() => {
            const currentTab = strategyTabs.find((t) => t.key === strategy) || strategyTabs[0];
            return (
              <div className="text-xs text-default-400 bg-primary/5 border border-primary/10 rounded-xl px-3.5 py-2 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                <span><strong>当前量化策略：</strong>{currentTab.desc}</span>
              </div>
            );
          })()}
        </div>

        {loading["topStocks"] && topStocks.length === 0 ? (
          <div className="py-12 text-center text-xs text-default-400">
            <RefreshCw className="w-4 h-4 animate-spin inline mr-1" /> 加载全量红利池...
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-divider bg-default-50/30">
                  <th className="text-left py-3 px-4 font-medium text-default-400 text-xs">排名</th>
                  <th className="text-left py-3 px-4 font-medium text-default-400 text-xs">股票</th>
                  <th className="text-left py-3 px-4 font-medium text-default-400 text-xs">行业</th>
                  <th className="text-right py-3 px-4 font-medium text-default-400 text-xs">综合评分</th>
                  <th className="text-right py-3 px-4 font-medium text-default-400 text-xs">温度</th>
                  <th className="text-right py-3 px-4 font-medium text-default-400 text-xs">股息率</th>
                  <th className="text-right py-3 px-4 font-medium text-default-400 text-xs">PE</th>
                  <th className="text-right py-3 px-4 font-medium text-default-400 text-xs">ROE</th>
                  <th className="text-right py-3 px-4 font-medium text-default-400 text-xs">1年胜率</th>
                  <th className="text-right py-3 px-4 font-medium text-default-400 text-xs">3年胜率</th>
                  <th className="text-center py-3 px-4 font-medium text-default-400 text-xs">信号</th>
                </tr>
              </thead>
              <tbody>
                {filteredStocks.map((stock: any, index: number) => {
                  const sig = signalConfig[stock.signal] || signalConfig["BUY"];
                  return (
                    <tr
                      key={stock.code}
                      onClick={() => window.location.href = `/dividend/${stock.code}`}
                      className="border-b border-divider/50 hover:bg-default-50/50 transition-colors cursor-pointer"
                    >
                      <td className="py-3 px-4">
                        <span className={`
                          inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold
                          ${index < 3 ? "bg-gradient-to-br from-amber-500 to-orange-500 text-white" : "bg-default-100 text-default-500"}
                        `}>
                          {index + 1}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-medium">{stock.name}</div>
                        <div className="text-[10px] text-default-400">{stock.code}</div>
                      </td>
                      <td className="py-3 px-4 text-default-400">{stock.industry}</td>
                      <td className="py-3 px-4 text-right font-semibold">{stock.overallScore}</td>
                      <td className="py-3 px-4 text-right">
                        <span className={stock.temperature < 30 ? "text-blue-400" : "text-yellow-400"}>
                          {stock.temperature}°C
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right text-emerald-400 font-medium">{stock.dividendYield}%</td>
                      <td className="py-3 px-4 text-right text-default-400">{stock.pe}</td>
                      <td className="py-3 px-4 text-right text-default-400">{stock.roe}%</td>
                      <td className="py-3 px-4 text-right">
                        {typeof stock.winRates?.oneYear === "object" && stock.winRates.oneYear !== null
                          ? `${stock.winRates.oneYear.winRate}%`
                          : stock.winRates?.oneYear ? `${stock.winRates.oneYear}%` : "--"}
                      </td>
                      <td className="py-3 px-4 text-right font-medium">
                        {typeof stock.winRates?.threeYear === "object" && stock.winRates.threeYear !== null
                          ? `${stock.winRates.threeYear.winRate}%`
                          : stock.winRates?.threeYear ? `${stock.winRates.threeYear}%` : "--"}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className={`inline-block text-[10px] font-medium px-2 py-0.5 rounded-full ${sig.class}`}>
                          {sig.label}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
