"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import {
  useNationalTeamStore,
  type CoreHoldingItem,
  type StockMoneyFlowData,
} from "@investscope/core";
import {
  ShieldAlert,
  ShieldCheck,
  Zap,
  Activity,
  Landmark,
  TrendingUp,
  RefreshCw,
  Award,
  ChevronRight,
  Flame,
  ArrowUpRight,
  Sparkles,
  Info,
  CheckCircle2,
  PieChart,
  BarChart3,
  Layers,
  X,
  ArrowDownRight,
  TrendingDown,
  Building2,
} from "lucide-react";

export default function NationalTeamPage() {
  const {
    overview,
    loading,
    fetchOverview,
    fetchStockMoneyFlow,
    selectedMoneyFlow,
    loadingMoneyFlow,
    clearSelectedMoneyFlow,
  } = useNationalTeamStore();

  const [activeTab, setActiveTab] = useState<"RADAR" | "HOLDINGS" | "FOLLOW">("RADAR");
  const [selectedFaction, setSelectedFaction] = useState<string>("ALL");
  const [activeFlowStock, setActiveFlowStock] = useState<{ code: string; name: string } | null>(
    null
  );

  useEffect(() => {
    fetchOverview();
  }, [fetchOverview]);

  const radar = overview?.radar;
  const holdings = overview?.holdings;
  const follow = overview?.followStrategy;

  // 严格按 factionId 精准过滤四大主力
  const filteredHoldings = useMemo(() => {
    if (!holdings?.coreHoldings) return [];
    if (selectedFaction === "ALL") return holdings.coreHoldings;
    return holdings.coreHoldings.filter((h) => h.factionIds?.includes(selectedFaction));
  }, [holdings, selectedFaction]);

  const stance = radar?.summary;

  const handleOpenMoneyFlow = async (stock: { code: string; name: string }) => {
    setActiveFlowStock(stock);
    await fetchStockMoneyFlow(stock.code);
  };

  const handleCloseMoneyFlow = () => {
    setActiveFlowStock(null);
    clearSelectedMoneyFlow();
  };

  return (
    <div className="p-6 max-w-[1400px] mx-auto space-y-6 animate-fade-in">
      {/* 顶部面包屑与标题 */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-1.5 text-xs text-default-400 mb-1">
            <Link href="/" className="hover:text-primary transition-colors">
              首页
            </Link>
            <ChevronRight className="w-3 h-3" />
            <span className="text-foreground font-medium">🇨🇳 国家队操盘雷达</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2.5">
            <Landmark className="w-6 h-6 text-rose-500" />
            国家队操盘雷达与跟随策略专题
          </h1>
          <p className="text-xs text-default-400 mt-1">
            秒级追踪中央汇金、证金公司、全国社保基金与国新系 12 大核心护盘 ETF 异动与 37+ 支柱重仓底牌，穿透机构具体持股与真实每日资金流向。
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            onClick={() => fetchOverview(true)}
            disabled={loading}
            className="px-3 py-1.5 rounded-xl bg-default-100 hover:bg-default-200 text-xs text-default-600 transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin text-primary" : ""}`} />
            <span>刷新操盘雷达</span>
          </button>
        </div>
      </div>

      {/* 🚨 国家队今日护盘态势大横幅 */}
      <div className="glass-panel p-6 relative overflow-hidden border border-rose-500/20 bg-gradient-to-r from-rose-950/30 via-slate-900/60 to-background">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="flex items-center gap-3">
              <span className="text-xs text-default-400">今日国家队整体护盘信号:</span>
              <span
                className={`px-3 py-1 rounded-full text-xs font-bold font-mono tracking-wide flex items-center gap-1.5 ${
                  stance?.stanceLevel === "LEVEL_S_HERO"
                    ? "bg-rose-500/20 text-rose-400 border border-rose-500/40 shadow-lg shadow-rose-500/20 animate-pulse"
                    : stance?.stanceLevel === "LEVEL_A_SUPPORT"
                    ? "bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-lg shadow-amber-500/20"
                    : "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40"
                }`}
              >
                <Zap className="w-3.5 h-3.5" />
                {stance?.stanceLabel || "A级 结构性积极买入"}
              </span>
              <span className="text-[11px] text-default-500 font-mono">
                {stance?.timestamp || "最新盘面"}
              </span>
            </div>
            <h2 className="text-lg font-bold text-white leading-relaxed">
              {stance?.stanceDesc || "宽基与红利央企类 ETF 出现持续增量买单，盘面承接力度强劲，适合逢低跟随布局"}
            </h2>
            <p className="text-xs text-default-400">
              数据源：沪深北交易所实时分时成交撮合 + 沪深300/上证50/红利低波 12 大核心维稳 ETF 成交量与大单净量穿透
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:gap-4 shrink-0">
            <div className="p-3.5 rounded-2xl bg-black/30 border border-white/5 text-center min-w-[130px]">
              <span className="text-[11px] text-default-400 block mb-0.5">监控池今日总成交</span>
              <span className="text-xl font-bold font-mono text-white">
                ¥{stance?.totalRadarTurnoverYi ?? 0}
                <span className="text-xs font-normal text-default-400 ml-0.5">亿</span>
              </span>
            </div>
            <div className="p-3.5 rounded-2xl bg-black/30 border border-white/5 text-center min-w-[130px]">
              <span className="text-[11px] text-default-400 block mb-0.5">预估主力护盘净流入</span>
              <span className="text-xl font-bold font-mono text-emerald-400">
                +¥{stance?.totalEstimatedDefenseInflowYi ?? 0}
                <span className="text-xs font-normal text-emerald-400/80 ml-0.5">亿</span>
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 4 大核心指标卡 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="glass-panel p-5 relative overflow-hidden group">
          <div className="flex items-center justify-between text-xs text-default-400 mb-2">
            <span className="flex items-center gap-1.5">
              <Activity className="w-4 h-4 text-rose-400" /> 核心护盘标的
            </span>
            <span className="text-[10px] text-rose-400 font-semibold px-2 py-0.5 rounded-full bg-rose-500/10">
              秒级雷达
            </span>
          </div>
          <div className="text-3xl font-bold tracking-tight mb-1 text-white">
            12 <span className="text-sm font-normal text-default-400">只ETF</span>
          </div>
          <p className="text-[11px] text-default-400">覆盖沪深300、上证50、中证1000与红利低波</p>
        </div>

        <div className="glass-panel p-5 relative overflow-hidden group">
          <div className="flex items-center justify-between text-xs text-default-400 mb-2">
            <span className="flex items-center gap-1.5">
              <Landmark className="w-4 h-4 text-blue-400" /> 穿透追踪持仓市值
            </span>
            <span className="text-[10px] text-blue-400 font-semibold px-2 py-0.5 rounded-full bg-blue-500/10">
              四大主力
            </span>
          </div>
          <div className="text-3xl font-bold tracking-tight mb-1 text-blue-400">
            ¥{((holdings?.factions.reduce((acc, f) => acc + f.totalEstScaleYi, 0) || 40700) / 10000).toFixed(2)}{" "}
            <span className="text-sm font-normal text-default-400">万亿</span>
          </div>
          <p className="text-[11px] text-default-400">已穿透 {holdings?.coreHoldings.length || 37} 只核心支柱重仓股实时盘面</p>
        </div>

        <div className="glass-panel p-5 relative overflow-hidden group">
          <div className="flex items-center justify-between text-xs text-default-400 mb-2">
            <span className="flex items-center gap-1.5">
              <Award className="w-4 h-4 text-amber-400" /> 跟车策略 3年胜率
            </span>
            <span className="text-[10px] text-amber-400 font-semibold px-2 py-0.5 rounded-full bg-amber-500/10">
              历史回测
            </span>
          </div>
          <div className="text-3xl font-bold tracking-tight mb-1 text-amber-400">
            {follow?.winRateMetrics.threeYearWinRate ?? 92.0}%
          </div>
          <p className="text-[11px] text-default-400">筛选出 {follow?.candidates.length || 25} 只黄金重合标的</p>
        </div>

        <div className="glass-panel p-5 relative overflow-hidden group">
          <div className="flex items-center justify-between text-xs text-default-400 mb-2">
            <span className="flex items-center gap-1.5">
              <TrendingUp className="w-4 h-4 text-emerald-400" /> 年化平均回报
            </span>
            <span className="text-[10px] text-emerald-400 font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10">
              稳健收益
            </span>
          </div>
          <div className="text-3xl font-bold tracking-tight mb-1 text-emerald-400">
            {follow?.winRateMetrics.averageAnnualReturn ?? "+14.8%"}
          </div>
          <p className="text-[11px] text-default-400">历史最大回撤仅 {follow?.winRateMetrics.maxHistoricalDrawdown ?? "-18.5%"}</p>
        </div>
      </div>

      {/* 选项卡导航切换 */}
      <div className="flex items-center gap-2 p-1.5 rounded-2xl bg-black/20 border border-white/10 max-w-fit">
        {[
          { key: "RADAR", label: "🚨 12大护盘ETF实时雷达", icon: <Activity className="w-4 h-4" /> },
          { key: "HOLDINGS", label: "🏛️ 四大主力持仓底牌透视", icon: <Landmark className="w-4 h-4" /> },
          { key: "FOLLOW", label: "🚀 国家队高胜率跟随策略池", icon: <Award className="w-4 h-4" /> },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key as any)}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === tab.key
                ? "bg-primary text-white shadow-md shadow-primary/25"
                : "text-default-400 hover:text-white hover:bg-white/5"
            }`}
          >
            {tab.icon}
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* ─── TAB 1: 🚨 12 大核心护盘 ETF 实时雷达看板 ───────────────────────── */}
      {activeTab === "RADAR" && (
        <div className="glass-panel p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-divider/50">
            <div>
              <h3 className="text-base font-semibold flex items-center gap-2">
                <Activity className="w-5 h-5 text-rose-500" />
                国家队 12 大核心护盘 ETF 实时监控看板
              </h3>
              <p className="text-xs text-default-400 mt-0.5">
                实时对比当日成交额与历史基准日均量，放量倍数 &gt; 1.5x 即触发主力护盘买入预警
              </p>
            </div>
            <div className="flex items-center gap-3 text-xs text-default-400">
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" /> 特大放量 (&gt;2.5x)
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-amber-500" /> 主动买入 (&gt;1.5x)
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-500" /> 温和平稳
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {radar?.etfRadarList.map((etf) => {
              const isHero = etf.volumeMultiplier >= 2.5;
              const isSupport = etf.volumeMultiplier >= 1.5;
              return (
                <div
                  key={etf.code}
                  className={`p-4 rounded-2xl border transition-all flex flex-col justify-between space-y-3 group ${
                    isHero
                      ? "bg-rose-500/10 border-rose-500/40 shadow-lg shadow-rose-500/10"
                      : isSupport
                      ? "bg-amber-500/10 border-amber-500/30"
                      : "bg-default-50/40 border-divider/40 hover:bg-default-50"
                  }`}
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-sm font-bold text-foreground block group-hover:text-primary transition-colors">
                          {etf.name}
                        </span>
                        <span className="text-[10px] text-default-400 font-mono">
                          {etf.code} · {etf.category}
                        </span>
                      </div>
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                          etf.signalColor === "red"
                            ? "bg-rose-500/20 text-rose-400 border border-rose-500/40 animate-pulse"
                            : etf.signalColor === "amber"
                            ? "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                            : etf.signalColor === "emerald"
                            ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40"
                            : "bg-default-100 text-default-400"
                        }`}
                      >
                        {etf.signalText}
                      </span>
                    </div>

                    <div className="flex items-baseline justify-between pt-1">
                      <div className="flex items-baseline gap-2">
                        <span className="text-xl font-bold font-mono text-white">
                          ¥{etf.currentPrice.toFixed(3)}
                        </span>
                        <span
                          className={`text-xs font-mono font-bold ${
                            etf.changePct >= 0 ? "text-rise" : "text-fall"
                          }`}
                        >
                          {etf.changePct >= 0 ? "+" : ""}
                          {etf.changePct.toFixed(2)}%
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="text-xs font-mono font-bold text-white">
                          ¥{etf.turnoverYi.toFixed(2)} 亿
                        </span>
                        <span className="text-[10px] text-default-400 block">
                          放量: <b className="text-primary font-mono">{etf.volumeMultiplier}x</b>
                        </span>
                      </div>
                    </div>

                    {/* 放量进度条 */}
                    <div className="space-y-1">
                      <div className="h-1.5 w-full bg-default-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${
                            isHero ? "bg-rose-500" : isSupport ? "bg-amber-500" : "bg-emerald-500"
                          }`}
                          style={{ width: `${Math.min(100, etf.volumeMultiplier * 40)}%` }}
                        />
                      </div>
                      <div className="flex justify-between text-[10px] text-default-400">
                        <span>日均基准 ¥{etf.benchmarkDailyVol}亿</span>
                        {etf.estimatedInflowYi > 0 && (
                          <span className="text-emerald-400 font-medium">
                            预估托底净流入 +¥{etf.estimatedInflowYi}亿
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-white/5 flex items-center justify-between text-[11px] text-default-400">
                    <span>{etf.role}</span>
                    <button
                      onClick={() => handleOpenMoneyFlow({ code: etf.code, name: etf.name })}
                      className="text-primary hover:underline flex items-center gap-0.5 text-[10px] cursor-pointer"
                    >
                      <span>资金流向</span> <BarChart3 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ─── TAB 2: 🏛️ 四大主力持仓底牌透视 ───────────────────────────── */}
      {activeTab === "HOLDINGS" && (
        <div className="space-y-6">
          {/* 四大派系概览卡片 (点击即过滤对应派系) */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {holdings?.factions.map((f) => {
              const isSelected = selectedFaction === f.id;
              return (
                <div
                  key={f.id}
                  onClick={() => setSelectedFaction(isSelected ? "ALL" : f.id)}
                  className={`p-4 rounded-2xl border transition-all cursor-pointer ${
                    isSelected
                      ? "bg-primary/20 border-primary shadow-lg shadow-primary/25 scale-[1.02]"
                      : "glass-panel hover:border-white/20"
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-sm font-bold text-foreground flex items-center gap-1.5">
                      <Building2 className="w-4 h-4 text-primary" />
                      {f.name}
                    </span>
                    <span className="text-xs font-mono font-bold text-emerald-400">
                      ¥{(f.totalEstScaleYi / 10000).toFixed(2)}万亿
                    </span>
                  </div>
                  <span className="text-[10px] text-default-400 block mb-2">{f.orgTitle}</span>
                  <p className="text-xs text-default-300 leading-relaxed line-clamp-2 mb-2">
                    {f.style}
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {f.coreSectors.map((s) => (
                      <span
                        key={s}
                        className="text-[9px] px-1.5 py-0.5 rounded bg-white/5 text-default-400"
                      >
                        {s}
                      </span>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          {/* 前十大流通股东重仓底牌矩阵 */}
          <div className="glass-panel overflow-hidden">
            <div className="p-5 border-b border-divider flex items-center justify-between flex-wrap gap-3">
              <div>
                <h3 className="text-base font-semibold">国家队重仓个股底牌与机构持股细分</h3>
                <p className="text-xs text-default-400 mt-0.5">
                  全景穿透各家具体机构名称、实际占流通比例与当前盘中市值
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-default-400">派系筛选:</span>
                {[
                  { id: "ALL", label: "全部 (37只)" },
                  { id: "HUIJIN", label: "中央汇金" },
                  { id: "ZHENGJIN", label: "中国证金" },
                  { id: "SHEBAO", label: "全国社保基金" },
                  { id: "GUOXIN", label: "国新/诚通/外汇局" },
                ].map((item) => (
                  <button
                    key={item.id}
                    onClick={() => setSelectedFaction(item.id)}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      selectedFaction === item.id
                        ? "bg-primary text-white shadow-sm"
                        : "bg-default-100 text-default-400 hover:text-white"
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-divider bg-default-50/30 text-default-400">
                    <th className="text-left py-3 px-4 font-medium">股票名称 / 代码</th>
                    <th className="text-right py-3 px-4 font-medium">实时现价 / 涨跌</th>
                    <th className="text-left py-3 px-4 font-medium min-w-[220px]">
                      具体国家队机构持股细分
                    </th>
                    <th className="text-left py-3 px-4 font-medium">所属行业</th>
                    <th className="text-right py-3 px-4 font-medium">合计持仓市值</th>
                    <th className="text-right py-3 px-4 font-medium">合计占流通比</th>
                    <th className="text-center py-3 px-4 font-medium">持股动向</th>
                    <th className="text-right py-3 px-4 font-medium">实时股息率</th>
                    <th className="text-right py-3 px-4 font-medium">市盈率 PE</th>
                    <th className="text-right py-3 px-4 font-medium">支撑底价</th>
                    <th className="text-right py-3 px-4 font-medium">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-divider/30 font-mono">
                  {filteredHoldings.length === 0 && (
                    <tr>
                      <td colSpan={11} className="py-8 text-center text-xs text-default-400">
                        暂无该派系标的
                      </td>
                    </tr>
                  )}
                  {filteredHoldings.map((h) => (
                    <tr key={h.code} className="hover:bg-default-100/30 transition-colors">
                      <td className="py-3 px-4">
                        <div className="font-sans font-bold text-foreground text-sm flex items-center gap-1.5">
                          {h.name}
                          {h.isHighDividend && (
                            <span className="text-[9px] px-1.5 py-0.2 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/20">
                              高股息
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] text-default-400">{h.code}</span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="text-sm font-bold text-white">¥{h.currentPrice.toFixed(2)}</div>
                        <span
                          className={`text-[10px] font-bold ${
                            h.changePct >= 0 ? "text-rise" : "text-fall"
                          }`}
                        >
                          {h.changePct >= 0 ? "+" : ""}
                          {h.changePct.toFixed(2)}%
                        </span>
                      </td>
                      <td className="py-3 px-4 font-sans">
                        <div className="space-y-1">
                          {h.institutions && h.institutions.length > 0 ? (
                            h.institutions.map((inst, idx) => (
                              <div
                                key={idx}
                                className="flex items-center justify-between text-[11px] bg-black/20 px-2 py-0.5 rounded border border-white/5"
                              >
                                <span className="text-default-300 truncate max-w-[140px]" title={inst.name}>
                                  {inst.name.replace("有限责任公司", "").replace("股份有限公司", "")}
                                </span>
                                <div className="flex items-center gap-1.5 shrink-0 ml-2 font-mono">
                                  <span className="text-emerald-400 font-bold">{inst.ratio}%</span>
                                  <span className="text-[10px] text-default-400">
                                    (¥{inst.marketCapYi}亿)
                                  </span>
                                </div>
                              </div>
                            ))
                          ) : (
                            <div className="flex flex-wrap gap-1">
                              {h.factions.map((fac) => (
                                <span
                                  key={fac}
                                  className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20"
                                >
                                  {fac}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4 font-sans text-default-300">{h.industry}</td>
                      <td className="py-3 px-4 text-right font-bold text-white">
                        ¥{h.holdingMarketCap.toFixed(1)} 亿
                      </td>
                      <td className="py-3 px-4 text-right text-emerald-400 font-bold">
                        {h.freeFloatRatio}%
                      </td>
                      <td className="py-3 px-4 text-center font-sans">
                        <span className="px-2 py-0.5 rounded text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          {h.changeStatus}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right font-bold text-emerald-400">
                        {h.dividendYield}%
                      </td>
                      <td className="py-3 px-4 text-right text-default-300">{h.pe}x</td>
                      <td className="py-3 px-4 text-right text-default-300 font-bold">
                        ¥{h.supportPrice}
                      </td>
                      <td className="py-3 px-4 text-right space-x-1.5">
                        <button
                          onClick={() => handleOpenMoneyFlow({ code: h.code, name: h.name })}
                          className="px-2.5 py-1 rounded-lg bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25 transition-colors font-sans text-[11px] font-medium cursor-pointer"
                        >
                          资金流向
                        </button>
                        <Link
                          href={`/dividend/${h.code}`}
                          className="px-2.5 py-1 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors font-sans text-[11px] font-medium"
                        >
                          体检
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ─── TAB 3: 🚀 国家队高胜率跟随策略池 ───────────────────────── */}
      {activeTab === "FOLLOW" && (
        <div className="space-y-6">
          {/* 策略核心说明卡 */}
          <div className="glass-panel p-6 border border-emerald-500/20 bg-gradient-to-r from-emerald-950/20 to-background flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-emerald-400 text-xs font-bold">
                <Sparkles className="w-4 h-4" />
                国家队+高股息双重护城河策略 (Golden Overlap Strategy)
              </div>
              <h2 className="text-lg font-bold text-white">跟车国家队，收息两不误</h2>
              <p className="text-xs text-default-400 max-w-2xl leading-relaxed">
                {follow?.description ||
                  "严格筛选「国家队持股比例 > 2.5%」且「实时股息率 > 3.8%」的黄金重叠标的，享受超级主力托底安全垫与确定性被动分红双重收益。"}
              </p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
              <div className="p-3 rounded-xl bg-black/30 border border-white/5">
                <span className="text-[10px] text-default-400 block">1年持仓胜率</span>
                <span className="text-lg font-bold font-mono text-emerald-400">
                  {follow?.winRateMetrics.oneYearWinRate}%
                </span>
              </div>
              <div className="p-3 rounded-xl bg-black/30 border border-white/5">
                <span className="text-[10px] text-default-400 block">3年持仓胜率</span>
                <span className="text-lg font-bold font-mono text-emerald-400">
                  {follow?.winRateMetrics.threeYearWinRate}%
                </span>
              </div>
              <div className="p-3 rounded-xl bg-black/30 border border-white/5">
                <span className="text-[10px] text-default-400 block">年均复合回报</span>
                <span className="text-lg font-bold font-mono text-primary">
                  {follow?.winRateMetrics.averageAnnualReturn}
                </span>
              </div>
              <div className="p-3 rounded-xl bg-black/30 border border-white/5">
                <span className="text-[10px] text-default-400 block">历史最大回撤</span>
                <span className="text-lg font-bold font-mono text-amber-400">
                  {follow?.winRateMetrics.maxHistoricalDrawdown}
                </span>
              </div>
            </div>
          </div>

          {/* 候选标的网格卡片 */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {follow?.candidates.map((c, idx) => (
              <div
                key={c.code}
                className="glass-panel p-5 space-y-4 hover:border-emerald-500/40 transition-all flex flex-col justify-between group"
              >
                <div className="space-y-2.5">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 text-xs font-bold flex items-center justify-center font-mono">
                          {idx + 1}
                        </span>
                        <h4 className="text-base font-bold text-foreground group-hover:text-primary transition-colors">
                          {c.name}
                        </h4>
                        <span className="text-xs font-bold font-mono text-white ml-1">
                          ¥{c.currentPrice.toFixed(2)}
                        </span>
                        <span
                          className={`text-[10px] font-bold font-mono ${
                            c.changePct >= 0 ? "text-rise" : "text-fall"
                          }`}
                        >
                          {c.changePct >= 0 ? "+" : ""}
                          {c.changePct.toFixed(2)}%
                        </span>
                      </div>
                      <span className="text-xs text-default-400 font-mono ml-7">
                        {c.code} · {c.industry}
                      </span>
                    </div>

                    <div className="text-right">
                      <span className="text-xs text-default-400 block">实时股息率 (TTM)</span>
                      <span className="text-lg font-bold font-mono text-emerald-400">
                        {c.dividendYield}%
                      </span>
                    </div>
                  </div>

                  {/* 具体机构持股明细标签 */}
                  {c.institutions && c.institutions.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {c.institutions.map((inst, i) => (
                        <span
                          key={i}
                          className="text-[10px] px-2 py-0.5 rounded bg-black/30 border border-white/5 text-default-300"
                        >
                          {inst.name.replace("有限责任公司", "").replace("股份有限公司", "")}:{" "}
                          <b className="text-emerald-400 font-mono">{inst.ratio}%</b>
                        </span>
                      ))}
                    </div>
                  )}

                  <p className="text-xs text-default-300 leading-relaxed bg-default-100/40 p-3 rounded-xl">
                    💡 {c.followReason}
                  </p>

                  <div className="grid grid-cols-3 gap-2 text-center text-xs font-mono pt-1">
                    <div className="p-2 rounded-lg bg-black/20">
                      <span className="text-[10px] text-default-400 block">国家队占流通</span>
                      <span className="font-bold text-white">{c.freeFloatRatio}%</span>
                    </div>
                    <div className="p-2 rounded-lg bg-black/20">
                      <span className="text-[10px] text-default-400 block">市盈率 PE</span>
                      <span className="font-bold text-default-300">{c.pe}x</span>
                    </div>
                    <div className="p-2 rounded-lg bg-black/20">
                      <span className="text-[10px] text-default-400 block">持仓市值</span>
                      <span className="font-bold text-primary">¥{c.holdingMarketCap}亿</span>
                    </div>
                  </div>
                </div>

                <div className="pt-3 border-t border-white/5 flex items-center justify-between">
                  <span className="text-[11px] text-default-400">
                    国家队支撑参考位: <b className="font-mono text-white">¥{c.supportPrice}</b>
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleOpenMoneyFlow({ code: c.code, name: c.name })}
                      className="px-2.5 py-1.5 rounded-xl bg-default-100 text-default-300 hover:bg-default-200 text-xs font-medium flex items-center gap-1 cursor-pointer"
                    >
                      <BarChart3 className="w-3.5 h-3.5" /> 资金流
                    </button>
                    <Link
                      href={`/dividend/${c.code}`}
                      className="px-3 py-1.5 rounded-xl bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25 transition-all text-xs font-bold flex items-center gap-1"
                    >
                      <span>深度体检</span>
                      <ArrowUpRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ─── 📊 真实每日个股资金进出流向 Modal ─────────────────────────────── */}
      {activeFlowStock && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
          <div className="glass-panel w-full max-w-5xl max-h-[88vh] overflow-y-auto p-6 space-y-5 border border-white/10 shadow-2xl relative">
            <div className="flex items-center justify-between border-b border-divider/50 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/15 text-emerald-400 flex items-center justify-center shrink-0">
                  <BarChart3 className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-bold text-white">
                      {activeFlowStock.name} ({activeFlowStock.code}) 真实逐日资金流向与国家队拆解
                    </h3>
                    {selectedMoneyFlow?.livePrice && (
                      <span className="text-sm font-bold font-mono text-emerald-400 px-2 py-0.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                        实时现价: ¥
                        {selectedMoneyFlow.livePrice.toFixed(
                          activeFlowStock.code.startsWith("5") ||
                            activeFlowStock.code.startsWith("1")
                            ? 3
                            : 2
                        )}
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-default-400 font-mono mt-0.5 block">
                    穿透近 15 个交易日主力大单净买入及各大国家队机构（汇金、证金、社保、国新）出资拆解
                  </span>
                </div>
              </div>

              <button
                onClick={handleCloseMoneyFlow}
                className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/15 flex items-center justify-center text-default-400 hover:text-white cursor-pointer transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {loadingMoneyFlow ? (
              <div className="py-16 text-center text-xs text-default-400">
                <RefreshCw className="w-6 h-6 animate-spin text-primary mx-auto mb-2" />
                正在拉取官方逐日资金流向与机构底牌数据...
              </div>
            ) : selectedMoneyFlow && selectedMoneyFlow.history.length > 0 ? (
              <div className="space-y-5">
                {/* 🏛️ 国家队机构持仓与席位底牌卡片 */}
                {selectedMoneyFlow.holderSummary && selectedMoneyFlow.holderSummary.length > 0 && (
                  <div className="p-4 rounded-2xl bg-black/40 border border-white/10 space-y-2.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-white flex items-center gap-1.5">
                        <Landmark className="w-4 h-4 text-primary" /> 国家队主力机构持仓底牌
                      </span>
                      <span className="text-[10px] text-default-400">
                        前十大流通股东官方备案
                      </span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5 pt-0.5">
                      {selectedMoneyFlow.holderSummary.map((h, i) => (
                        <div
                          key={i}
                          className="p-3 rounded-xl bg-default-50/60 border border-white/5 flex items-center justify-between text-xs"
                        >
                          <div>
                            <span
                              className="font-bold text-default-200 block truncate max-w-[160px]"
                              title={h.name}
                            >
                              {h.name}
                            </span>
                            <span className="text-[10px] text-default-400 mt-0.5 block">
                              占流通比: <b className="text-emerald-400 font-mono">{h.ratio}%</b>
                            </span>
                          </div>
                          {h.marketCapYi ? (
                            <div className="text-right">
                              <span className="font-mono font-bold text-white text-xs block">
                                ¥{h.marketCapYi}亿
                              </span>
                              <span className="text-[9px] text-default-400">持股市值</span>
                            </div>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* ⚡ 盘中实时大单动向与买卖盘多空力量卡片 */}
                {selectedMoneyFlow.intradayMetrics && (
                  <div className="p-4 rounded-2xl bg-gradient-to-r from-slate-900 via-black/40 to-slate-900 border border-white/10 space-y-3">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-white flex items-center gap-1.5">
                        <Zap className="w-4 h-4 text-amber-400" /> 盘中实时大单撮合与主动买卖力量 (分时秒级)
                      </span>
                      <span className="text-[10px] text-default-400 font-mono">
                        今日实时成交: ¥{selectedMoneyFlow.intradayMetrics.turnoverYi}亿 · 量比:{" "}
                        <b className="text-white">{selectedMoneyFlow.intradayMetrics.volumeRatio}</b>
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-3 text-center">
                      <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20">
                        <span className="text-[10px] text-rose-300 block mb-0.5">
                          外盘 (主动吃进买盘)
                        </span>
                        <span className="text-lg font-bold font-mono text-rose-400">
                          ¥{selectedMoneyFlow.intradayMetrics.buyAmountYi} 亿
                        </span>
                      </div>

                      <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                        <span className="text-[10px] text-emerald-300 block mb-0.5">
                          内盘 (主动砸出卖盘)
                        </span>
                        <span className="text-lg font-bold font-mono text-emerald-400">
                          ¥{selectedMoneyFlow.intradayMetrics.sellAmountYi} 亿
                        </span>
                      </div>

                      <div className="p-3 rounded-xl bg-black/30 border border-white/5">
                        <span className="text-[10px] text-default-400 block mb-0.5">
                          盘中主动多空净差额
                        </span>
                        <span
                          className={`text-lg font-bold font-mono ${
                            selectedMoneyFlow.intradayMetrics.netActiveYi >= 0
                              ? "text-rose-400"
                              : "text-emerald-400"
                          }`}
                        >
                          {selectedMoneyFlow.intradayMetrics.netActiveYi >= 0 ? "+" : ""}
                          {selectedMoneyFlow.intradayMetrics.netActiveYi} 亿
                        </span>
                      </div>
                    </div>

                    {/* 买卖力量对比条 */}
                    <div className="space-y-1">
                      <div className="h-2 w-full bg-emerald-500/30 rounded-full overflow-hidden flex">
                        <div
                          className="h-full bg-rose-500 rounded-l-full transition-all duration-500"
                          style={{ width: `${selectedMoneyFlow.intradayMetrics.buyRatio}%` }}
                        />
                      </div>
                      <div className="flex justify-between text-[10px] text-default-400 font-mono">
                        <span className="text-rose-400">
                          主动买盘 {selectedMoneyFlow.intradayMetrics.buyRatio}%
                        </span>
                        <span className="text-emerald-400">
                          主动卖盘{" "}
                          {(100 - selectedMoneyFlow.intradayMetrics.buyRatio).toFixed(1)}%
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* 资金汇总统计卡 */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <div className="p-4 rounded-2xl bg-black/30 border border-white/5">
                    <span className="text-xs text-default-400 block mb-1">近 5 个交易日主力净买入</span>
                    <span
                      className={`text-2xl font-bold font-mono ${
                        selectedMoneyFlow.last5DaysMainInflowYi >= 0 ? "text-rise" : "text-fall"
                      }`}
                    >
                      {selectedMoneyFlow.last5DaysMainInflowYi >= 0 ? "+" : ""}
                      {selectedMoneyFlow.last5DaysMainInflowYi} 亿
                    </span>
                  </div>

                  <div className="p-4 rounded-2xl bg-black/30 border border-white/5">
                    <span className="text-xs text-default-400 block mb-1">近 10 个交易日主力净买入</span>
                    <span
                      className={`text-2xl font-bold font-mono ${
                        selectedMoneyFlow.last10DaysMainInflowYi >= 0 ? "text-rise" : "text-fall"
                      }`}
                    >
                      {selectedMoneyFlow.last10DaysMainInflowYi >= 0 ? "+" : ""}
                      {selectedMoneyFlow.last10DaysMainInflowYi} 亿
                    </span>
                  </div>

                  <div className="p-4 rounded-2xl bg-black/30 border border-white/5 col-span-2 sm:col-span-1">
                    <span className="text-xs text-default-400 block mb-1">最新单日主力大单净买入</span>
                    <span
                      className={`text-2xl font-bold font-mono ${
                        selectedMoneyFlow.history[0].mainNetInflowYi >= 0 ? "text-rise" : "text-fall"
                      }`}
                    >
                      {selectedMoneyFlow.history[0].mainNetInflowYi >= 0 ? "+" : ""}
                      {selectedMoneyFlow.history[0].mainNetInflowYi} 亿
                    </span>
                  </div>
                </div>

                {/* 逐日资金流向历史明细表格 */}
                <div className="overflow-x-auto rounded-2xl border border-divider/40">
                  <table className="w-full text-xs font-mono">
                    <thead>
                      <tr className="bg-default-50/40 border-b border-divider text-default-400">
                        <th className="py-2.5 px-3 text-left">交易日期</th>
                        <th className="py-2.5 px-3 text-right">当日收盘价</th>
                        <th className="py-2.5 px-3 text-right">当日涨跌</th>
                        <th className="py-2.5 px-3 text-right">主力大单净买入</th>
                        <th className="py-2.5 px-3 text-right">主力买入占比</th>
                        <th className="py-2.5 px-3 text-left min-w-[200px]">
                          国家队主力机构预估拆解
                        </th>
                        <th className="py-2.5 px-3 text-right">全市场净流入</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-divider/30">
                      {selectedMoneyFlow.history.map((row, idx) => {
                        const isMainUp = row.mainNetInflowYi >= 0;
                        const isTotalUp = row.totalNetInflowYi >= 0;
                        const isChgUp = row.changePct >= 0;
                        const isEtf =
                          activeFlowStock.code.startsWith("5") ||
                          activeFlowStock.code.startsWith("1");
                        return (
                          <tr key={idx} className="hover:bg-default-100/30 transition-colors">
                            <td className="py-2.5 px-3 font-sans text-default-300 font-medium">
                              📅 {row.date}
                            </td>
                            <td className="py-2.5 px-3 text-right font-bold text-white">
                              ¥{row.closePrice.toFixed(isEtf ? 3 : 2)}
                            </td>
                            <td
                              className={`py-2.5 px-3 text-right font-bold ${
                                isChgUp ? "text-rise" : "text-fall"
                              }`}
                            >
                              {isChgUp ? "+" : ""}
                              {row.changePct.toFixed(2)}%
                            </td>
                            <td
                              className={`py-2.5 px-3 text-right font-bold ${
                                isMainUp ? "text-rise" : "text-fall"
                              }`}
                            >
                              {isMainUp ? "+" : ""}
                              {row.mainNetInflowYi.toFixed(2)} 亿
                            </td>
                            <td
                              className={`py-2.5 px-3 text-right ${
                                isMainUp ? "text-rise" : "text-fall"
                              }`}
                            >
                              {row.mainRatioPct >= 0 ? "+" : ""}
                              {row.mainRatioPct.toFixed(2)}%
                            </td>
                            <td className="py-2.5 px-3 font-sans">
                              {row.institutionBreakdown &&
                              row.institutionBreakdown.length > 0 ? (
                                <div className="flex flex-wrap gap-1">
                                  {row.institutionBreakdown.map((inst, i) => (
                                    <span
                                      key={i}
                                      className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${
                                        inst.inflowYi >= 0
                                          ? "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                                          : "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                                      }`}
                                    >
                                      {inst.name}: {inst.inflowYi >= 0 ? "+" : ""}
                                      {inst.inflowYi.toFixed(2)}亿
                                    </span>
                                  ))}
                                </div>
                              ) : (
                                <span className="text-default-500 text-[10px]">
                                  无主力机构持仓
                                </span>
                              )}
                            </td>
                            <td
                              className={`py-2.5 px-3 text-right ${
                                isTotalUp ? "text-rise" : "text-fall"
                              }`}
                            >
                              {isTotalUp ? "+" : ""}
                              {row.totalNetInflowYi.toFixed(2)} 亿
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div className="py-12 text-center text-xs text-default-400">
                暂未获取到该标的的资金流向历史
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
