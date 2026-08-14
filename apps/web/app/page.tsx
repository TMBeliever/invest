"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useMarketStore, useDividendStore, usePortfolioStore, useAuthStore, useNationalTeamStore } from "@investscope/core";
import {
  TrendingUp,
  Thermometer,
  ArrowUpRight,
  ArrowDownRight,
  Activity,
  PieChart,
  RefreshCw,
  Sparkles,
  Landmark,
  Zap,
} from "lucide-react";

function IndexCard({ index }: { index: { code: string; name: string; price: number; changePct: number } }) {
  const isUp = index.changePct >= 0;
  return (
    <Link href={`/dividend/${index.code}`} className="glass-panel p-4 animate-fade-in hover:scale-[1.02] transition-transform cursor-pointer block">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-default-400 font-medium">{index.name}</span>
        {isUp ? (
          <ArrowUpRight className="w-4 h-4 text-rise" />
        ) : (
          <ArrowDownRight className="w-4 h-4 text-fall" />
        )}
      </div>
      <div className="text-xl font-bold tracking-tight">
        {index.price.toLocaleString("zh-CN", { minimumFractionDigits: 2 })}
      </div>
      <div className={`text-sm font-medium mt-1 ${isUp ? "text-rise" : "text-fall"}`}>
        {isUp ? "+" : ""}{index.changePct.toFixed(2)}%
      </div>
    </Link>
  );
}

function TemperatureWidget() {
  const { temperature, fetchTemperature, loading, error } = useDividendStore();

  useEffect(() => {
    fetchTemperature();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading["temperature"]) {
    return (
      <div className="glass-panel p-6 animate-pulse flex items-center justify-center h-48 text-xs text-default-400">
        <RefreshCw className="w-4 h-4 animate-spin mr-2" /> 实时加载红利板块温度...
      </div>
    );
  }

  if (error["temperature"]) {
    return (
      <div className="glass-panel p-6 text-xs text-red-400">
        温度加载失败: {error["temperature"]}
      </div>
    );
  }

  const temp = temperature?.temperature ?? 0;
  const pct = temp / 100;
  const suggestion = temperature?.suggestion ?? "--";

  return (
    <div className="glass-panel p-6 animate-fade-in">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Thermometer className="w-5 h-5 text-primary" />
          <h3 className="text-sm font-semibold">红利板块温度</h3>
        </div>
      </div>

      <div className="flex items-end gap-2 mb-4">
        <span className="text-5xl font-bold tracking-tighter">{temp}</span>
        <span className="text-2xl text-default-400 mb-1">°C</span>
        <span className={`
          ml-auto text-xs font-medium px-2.5 py-1 rounded-full
          ${temp < 30 ? "bg-blue-500/15 text-blue-400" :
            temp < 60 ? "bg-yellow-500/15 text-yellow-400" :
            temp < 80 ? "bg-orange-500/15 text-orange-400" :
            "bg-red-500/15 text-red-400"
          }
        `}>
          {temp < 30 ? "偏冷 · 贪婪区" : temp < 60 ? "中性" : temp < 80 ? "偏热" : "过热"}
        </span>
      </div>

      <div className="relative h-3 rounded-full temperature-gradient overflow-hidden mb-3">
        <div
          className="absolute top-1/2 -translate-y-1/2 w-4 h-4 bg-white rounded-full shadow-lg border-2 border-default-200 transition-all duration-500"
          style={{ left: `calc(${pct * 100}% - 8px)` }}
        />
      </div>

      <p className="text-xs text-default-400 leading-relaxed">
        💡 {suggestion}
      </p>
    </div>
  );
}

function TopDividendWidget() {
  const { topStocks, fetchTopStocks, loading } = useDividendStore();

  useEffect(() => {
    fetchTopStocks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const stocks = topStocks.slice(0, 5);

  return (
    <div className="glass-panel p-6 animate-fade-in">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-emerald-500" />
          <h3 className="text-sm font-semibold">高胜率红利股 Top 5</h3>
        </div>
        <a href="/dividend" className="text-xs text-primary hover:underline">查看全部 →</a>
      </div>

      {loading["topStocks"] ? (
        <div className="py-12 text-center text-xs text-default-400">
          <RefreshCw className="w-4 h-4 animate-spin inline mr-1" /> 加载高胜率榜单...
        </div>
      ) : stocks.length === 0 ? (
        <div className="py-12 text-center text-xs text-default-400">暂无排行数据</div>
      ) : (
        <div className="space-y-3">
          {stocks.map((stock: any, index: number) => (
            <a key={stock.code} href={`/dividend/${stock.code}`} className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-default-100/50 transition-colors cursor-pointer block">
              <span className={`
                w-6 h-6 flex items-center justify-center rounded-full text-xs font-bold
                ${index < 3 ? "bg-primary/15 text-primary" : "bg-default-100 text-default-500"}
              `}>
                {index + 1}
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium truncate">{stock.name}</span>
                  <span className="text-[10px] text-default-400">{stock.code}</span>
                </div>
                <div className="flex items-center gap-3 mt-0.5">
                  <span className="text-[10px] text-default-400">评分 {stock.overallScore}</span>
                  <span className="text-[10px] text-default-400">股息率 {stock.dividendYield}%</span>
                  <span className="text-[10px] text-default-400">
                    胜率 {typeof stock.winRates?.threeYear === "object" && stock.winRates.threeYear !== null ? stock.winRates.threeYear.winRate : stock.winRates?.threeYear}%
                  </span>
                </div>
              </div>
              <span className={`
                text-[10px] font-medium px-2 py-0.5 rounded-full
                ${stock.signal === "STRONG_BUY" ? "bg-emerald-500/15 text-emerald-400" :
                  stock.signal === "BUY" ? "bg-green-500/15 text-green-400" :
                  "bg-yellow-500/15 text-yellow-400"
                }
              `}>
                {stock.signal === "STRONG_BUY" ? "强烈买入" : stock.signal === "BUY" ? "买入" : "持有"}
              </span>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

function AllocationWidget() {
  const { summary, fetchSummary, loading } = usePortfolioStore();

  useEffect(() => {
    fetchSummary();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading["summary"]) {
    return (
      <div className="glass-panel p-6 animate-pulse flex items-center justify-center h-48 text-xs text-default-400">
        <RefreshCw className="w-4 h-4 animate-spin mr-2" /> 读取持仓与配置...
      </div>
    );
  }

  const totalAssets = summary?.totalAssets ?? 0;
  const core = summary?.allocation.core ?? 0;
  const satellite = summary?.allocation.satellite ?? 0;
  const reserve = summary?.allocation.reserve ?? 0;
  const profitPct = summary?.totalProfitLossPct ?? 0;

  return (
    <div className="glass-panel p-6 animate-fade-in">
      <div className="flex items-center gap-2 mb-4">
        <PieChart className="w-5 h-5 text-violet-500" />
        <h3 className="text-sm font-semibold">资产配置</h3>
      </div>

      <div className="flex items-end gap-2 mb-4">
        <span className="text-3xl font-bold">
          ¥{(totalAssets / 10000).toFixed(1)}
        </span>
        <span className="text-sm text-default-400 mb-0.5">万</span>
        <span className="text-sm text-emerald-400 ml-auto">+{profitPct}%</span>
      </div>

      <div className="flex rounded-full overflow-hidden h-2.5 mb-4">
        <div className="bg-emerald-500" style={{ width: `${core}%` }} />
        <div className="bg-violet-500" style={{ width: `${satellite}%` }} />
        <div className="bg-amber-500" style={{ width: `${reserve}%` }} />
      </div>

      <div className="grid grid-cols-3 gap-2 text-center">
        <div>
          <div className="flex items-center justify-center gap-1.5 mb-1">
            <div className="w-2 h-2 rounded-full bg-emerald-500" />
            <span className="text-[10px] text-default-400">核心仓</span>
          </div>
          <span className="text-sm font-semibold">{core}%</span>
          <span className="text-[10px] text-default-400 block">目标 60%</span>
        </div>
        <div>
          <div className="flex items-center justify-center gap-1.5 mb-1">
            <div className="w-2 h-2 rounded-full bg-violet-500" />
            <span className="text-[10px] text-default-400">卫星仓</span>
          </div>
          <span className="text-sm font-semibold">{satellite}%</span>
          <span className="text-[10px] text-default-400 block">目标 30%</span>
        </div>
        <div>
          <div className="flex items-center justify-center gap-1.5 mb-1">
            <div className="w-2 h-2 rounded-full bg-amber-500" />
            <span className="text-[10px] text-default-400">储备金</span>
          </div>
          <span className="text-sm font-semibold">{reserve}%</span>
          <span className="text-[10px] text-default-400 block">目标 10%</span>
        </div>
      </div>
    </div>
  );
}

function SentimentWidget() {
  const { sentiment, fetchSentiment } = useMarketStore();

  useEffect(() => {
    fetchSentiment();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const score = sentiment?.fearGreedIndex ?? 50;
  const bondYield = sentiment?.bondYield10Y ?? 1.71;

  let desc = "中性平稳 — 结构性轮动行情，维持核心配置纪律";
  let color = "text-yellow-400";
  if (score <= 25) {
    desc = "极度恐慌 — 市场悲观情绪浓厚，逆向加仓高胜率良机";
    color = "text-red-400";
  } else if (score <= 45) {
    desc = "偏恐慌 — 波动释放期，加仓高股息防御资产良机";
    color = "text-amber-400";
  } else if (score <= 55) {
    desc = "中性平稳 — 市场情绪均衡，维持核心分层纪律";
    color = "text-blue-400";
  } else if (score <= 75) {
    desc = "偏贪婪 — 市场风险偏好提升，注意控制追高仓位";
    color = "text-emerald-400";
  } else {
    desc = "极度贪婪 — 估值情绪全面亢奋，可适度止盈卫星仓位";
    color = "text-rose-400";
  }

  return (
    <div className="glass-panel p-6 animate-fade-in">
      <div className="flex items-center gap-2 mb-4">
        <Activity className="w-5 h-5 text-amber-500" />
        <h3 className="text-sm font-semibold">市场情绪 & 国债收益率</h3>
      </div>
      <div className="flex items-end gap-2 mb-2">
        <span className="text-4xl font-bold">{score}</span>
        <span className="text-sm text-default-400 mb-1">/ 100</span>
        <span className="text-xs text-default-400 ml-auto mb-1">10年国债 {bondYield}%</span>
      </div>
      <div className="h-2 bg-default-100 rounded-full overflow-hidden mb-3">
        <div
          className="h-full rounded-full bg-gradient-to-r from-red-500 via-yellow-500 to-green-500"
          style={{ width: `${score}%` }}
        />
      </div>
      <p className={`text-xs font-medium ${color}`}>{desc}</p>
    </div>
  );
}

function OpportunityPatrolWidget() {
  const [opportunities, setOpportunities] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const API_BASE = process.env.NEXT_PUBLIC_API_URL || "";

  const fetchOpportunities = async () => {
    try {
      const token = useAuthStore.getState().token;
      if (!token) return;
      const res = await fetch(`${API_BASE}/api/intelligence/opportunities`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setOpportunities(data.opportunities || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleScanNow = async () => {
    setScanning(true);
    try {
      const token = useAuthStore.getState().token;
      const res = await fetch(`${API_BASE}/api/intelligence/opportunities/scan`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setOpportunities(data.opportunities || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setScanning(false);
    }
  };

  useEffect(() => {
    fetchOpportunities();
  }, []);

  const topOpps = opportunities.slice(0, 4);

  return (
    <div className="glass-panel p-6 animate-fade-in space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <Sparkles className="w-5 h-5 text-emerald-400" />
          <h3 className="text-sm font-semibold text-white">🎯 机会巡视雷达 (高胜率捡漏)</h3>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 font-semibold border border-emerald-500/20">
            量化评分 ≥ 80分
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleScanNow}
            disabled={scanning}
            className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/15 border border-white/10 text-[11px] text-gray-300 hover:text-white transition-all flex items-center gap-1 cursor-pointer disabled:opacity-40"
          >
            <RefreshCw className={`w-3 h-3 ${scanning ? "animate-spin text-emerald-400" : "text-emerald-400"}`} />
            <span>{scanning ? "全域扫描中..." : "即刻巡视"}</span>
          </button>
          <Link href="/settings" className="text-xs text-primary hover:underline">
            策略调参 →
          </Link>
        </div>
      </div>

      {loading ? (
        <div className="py-8 text-center text-xs text-default-400">
          <RefreshCw className="w-4 h-4 animate-spin inline mr-1 text-emerald-400" /> 正在巡视 4 大核心黄金资产池...
        </div>
      ) : topOpps.length === 0 ? (
        <div className="py-8 text-center text-xs text-default-400 bg-black/20 rounded-2xl border border-white/5">
          🎯 当前市场标的暂未触及极端黄金买点阈值（宁缺毋滥，严控风险）
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {topOpps.map((op: any) => {
            const score = op.structured_metrics?.score || 80;
            const dy = op.structured_metrics?.dividend_yield;
            const pb = op.structured_metrics?.pb;
            return (
              <div
                key={op.id}
                className="p-3.5 rounded-2xl bg-black/30 hover:bg-black/40 border border-emerald-500/20 hover:border-emerald-500/40 transition-all group flex flex-col justify-between space-y-2"
              >
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold text-white group-hover:text-emerald-300 transition-colors truncate">
                      {op.symbol_name || op.title}
                    </span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-mono font-bold">
                      {score}分
                    </span>
                  </div>
                  <div className="text-[10px] text-default-400 font-mono mb-1.5">
                    {op.symbol ? `${op.symbol}` : "宏观/大类"}
                    {dy ? ` · 股息率 ${dy}%` : ""}
                    {pb ? ` · PB ${pb}` : ""}
                  </div>
                  <p className="text-[11px] text-gray-300 line-clamp-2 leading-relaxed">
                    {op.summary}
                  </p>
                </div>

                {op.decision_options && op.decision_options.length > 0 && (
                  <div className="pt-2 border-t border-white/10 flex items-center justify-between">
                    <span className="text-[10px] text-emerald-400 font-medium">
                      💡 {op.decision_options[0].name}
                    </span>
                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-white/5 text-default-400">
                      {op.decision_options[0].tag}
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function NationalTeamBannerWidget() {
  const { overview, fetchOverview, loading } = useNationalTeamStore();

  useEffect(() => {
    fetchOverview();
  }, [fetchOverview]);

  const stance = overview?.radar?.summary;

  return (
    <div className="glass-panel p-4 animate-fade-in border border-rose-500/20 bg-gradient-to-r from-rose-950/20 via-slate-900/40 to-background flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-rose-500/15 text-rose-400 flex items-center justify-center shrink-0">
          <Landmark className="w-5 h-5" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h4 className="text-xs font-bold text-white">🇨🇳 国家队操盘雷达</h4>
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-bold font-mono ${
                stance?.stanceLevel === "LEVEL_S_HERO"
                  ? "bg-rose-500/20 text-rose-400 border border-rose-500/30 animate-pulse"
                  : stance?.stanceLevel === "LEVEL_A_SUPPORT"
                  ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                  : "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
              }`}
            >
              {stance?.stanceLabel || "A级 结构性买入"}
            </span>
          </div>
          <p className="text-[11px] text-default-400 mt-0.5 line-clamp-1">
            今日 12 大护盘 ETF 成交 ¥{stance?.totalRadarTurnoverYi ?? 0} 亿，预估托底资金流入 +¥{stance?.totalEstimatedDefenseInflowYi ?? 0} 亿
          </p>
        </div>
      </div>

      <Link
        href="/national-team"
        className="px-3 py-1.5 rounded-xl bg-rose-500/15 text-rose-300 hover:bg-rose-500/25 transition-all text-xs font-bold flex items-center gap-1 shrink-0 self-start sm:self-auto"
      >
        <span>查看操盘底牌与跟车策略</span>
        <ArrowUpRight className="w-3.5 h-3.5" />
      </Link>
    </div>
  );
}

export default function DashboardPage() {
  const { indices, fetchIndices, loading } = useMarketStore();

  useEffect(() => {
    fetchIndices();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="p-6 max-w-[1400px] mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">仪表盘</h1>
        <p className="text-sm text-default-400 mt-1">
          {new Date().toLocaleDateString("zh-CN", { year: "numeric", month: "long", day: "numeric", weekday: "long" })}
        </p>
      </div>

      {/* 指数行情 */}
      {loading["indices"] && indices.length === 0 ? (
        <div className="py-8 text-center text-xs text-default-400 glass-panel">
          <RefreshCw className="w-4 h-4 animate-spin inline mr-2" /> 抓取实时大盘指数中...
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {indices.map((index) => (
            <IndexCard key={index.code} index={index} />
          ))}
        </div>
      )}

      {/* 🇨🇳 国家队操盘雷达快速入口 */}
      <NationalTeamBannerWidget />

      {/* 🎯 机会巡视雷达 (全新攻防一体核心组件) */}
      <OpportunityPatrolWidget />

      {/* 主要内容区 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="space-y-4">
          <TemperatureWidget />
          <SentimentWidget />
        </div>
        <div>
          <TopDividendWidget />
        </div>
        <div>
          <AllocationWidget />
        </div>
      </div>
    </div>
  );
}
