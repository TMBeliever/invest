"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  useStrategyBasketStore,
  type BasketStrategyKey,
  type BasketWeightMethod,
  type TrapAuditItem,
} from "@investscope/core";
import {
  Sparkles,
  Award,
  ShieldCheck,
  Zap,
  Landmark,
  Layers,
  ArrowRight,
  RefreshCw,
  TrendingUp,
  Percent,
  CheckCircle2,
  AlertTriangle,
  Sliders,
  DollarSign,
  PieChart,
  Copy,
  Check,
  Wallet,
  Bot,
  ExternalLink,
  Ban,
  Filter,
  ChevronDown,
  ChevronUp,
  Flame,
  ShieldAlert,
} from "lucide-react";

const strategyCards: {
  key: BasketStrategyKey;
  label: string;
  badge: string;
  icon: any;
  desc: string;
  color: string;
}[] = [
  {
    key: "BALANCED_QUALITY",
    label: "优质红利避坑组合",
    badge: "综合胜率最高",
    icon: Award,
    desc: "严选 ROE>10% 优质白马 + 连续 10 年稳定派息 + 国家队压舱石，兼顾高分红与资产增值",
    color: "from-amber-500/20 to-orange-500/10 border-amber-500/30 text-amber-400",
  },
  {
    key: "DEEP_VALUE_SAFETY",
    label: "深度破净低波防守",
    badge: "下行极度安全",
    icon: ShieldCheck,
    desc: "聚焦 PB < 1.0 破净金融与特许公用事业，提供极致破净安全垫与高确定性分红",
    color: "from-emerald-500/20 to-teal-500/10 border-emerald-500/30 text-emerald-400",
  },
  {
    key: "HIGH_ROE_GROWTH",
    label: "高 ROE 复利白马",
    badge: "造血复利最强",
    icon: Zap,
    desc: "筛选平均 ROE > 15% 的真正造血龙头（消费/家电/能源白马），红利再投资复利效应最强",
    color: "from-purple-500/20 to-indigo-500/10 border-purple-500/30 text-purple-400",
  },
  {
    key: "SOVEREIGN_SUPPORT",
    label: "国家队托底压舱石",
    badge: "主力资金护航",
    icon: Landmark,
    desc: "汇金、证金与全国社保大比例重仓的核心支柱，国家大资金长期护盘与分红双保驾",
    color: "from-blue-500/20 to-cyan-500/10 border-blue-500/30 text-blue-400",
  },
];

const quickCounts = [3, 5, 8, 10, 15, 20];

const trapDimensionFilters = [
  { key: "ALL", label: "全部淘汰黑名单" },
  { key: "REALTIME_NOTICE_NEGATIVE", label: "🚨 突发早盘利空公告" },
  { key: "CYCLICAL_PEAK", label: "⚡ 强周期见顶" },
  { key: "FINANCIAL_FRAUD_OR_DEBT", label: "🛑 财务负债/现金断裂" },
  { key: "REGULATORY_OR_LEGAL", label: "🔴 监管立案/舆情" },
  { key: "PAYOUT_TRAP", label: "❌ 掏空式分红" },
  { key: "PROFIT_DEGRADATION", label: "⚠️ 盈利严重恶化" },
  { key: "PLEDGE_OR_LOCKUP", label: "⛓️ 高质押爆仓风险" },
];

export default function StrategyBasketsPage() {
  const {
    count,
    strategy,
    weightMethod,
    basketData,
    loading,
    applying,
    error,
    setCount,
    setStrategy,
    setWeightMethod,
    generateBasket,
    applyToAssets,
  } = useStrategyBasketStore();

  const [copied, setCopied] = useState(false);
  const [applyModalOpen, setApplyModalOpen] = useState(false);
  const [investmentAmount, setInvestmentAmount] = useState<number>(100000);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [activeTrapFilter, setActiveTrapFilter] = useState("ALL");
  const [trapsExpanded, setTrapsExpanded] = useState(true);

  useEffect(() => {
    generateBasket();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCopyList = () => {
    if (!basketData) return;
    const text = basketData.stocks
      .map(
        (s, i) =>
          `${i + 1}. ${s.name}(${s.code}) - 权重: ${s.weightPct}% | 股息率: ${s.dividendYield}% | ROE: ${s.roe}%`
      )
      .join("\n");
    navigator.clipboard.writeText(
      `【InvestScope 策略魔方 · ${basketData.strategyMeta.name} (${basketData.count}只)】\n${text}\n加权股息率: ${basketData.metrics.weightedDividendYield}% | 加权ROE: ${basketData.metrics.weightedRoe}%`
    );
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleConfirmApply = async () => {
    const res = await applyToAssets(investmentAmount);
    setApplyModalOpen(false);
    setToastMessage(res.message);
    setTimeout(() => setToastMessage(null), 5000);
  };

  const allTraps: TrapAuditItem[] = basketData?.antiTrapAudit?.trapsList || [];
  const filteredTraps = activeTrapFilter === "ALL"
    ? allTraps
    : allTraps.filter((t) => t.trapDimension === activeTrapFilter);

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-[1440px] mx-auto space-y-8 animate-fade-in">
      {/* 顶部 Header & Direct Indexing 价值主张 */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-white/10 pb-6">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="p-1.5 rounded-xl bg-gradient-to-tr from-amber-500/30 to-purple-500/20 text-amber-400 border border-amber-500/20">
              <Sparkles className="w-5 h-5" />
            </span>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
              策略魔方 · 自选优质红利组合工厂
            </h1>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-primary/20 text-primary border border-primary/30">
              Direct Indexing
            </span>
          </div>
          <p className="text-xs sm:text-sm text-default-400 leading-relaxed max-w-3xl">
            告别传统红利 ETF 机械式按股息率选股的「周期见顶陷阱」与「高负债伪高息股」。
            基于 7 重全景排雷与国家队机构托底，智能生成 <b>3 ~ 20 只</b> 最优红利自建篮子，<b>0 管理费磨损</b>！
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <button
            onClick={() => generateBasket()}
            disabled={loading}
            className="px-3.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-medium text-gray-200 hover:text-white transition-all flex items-center gap-1.5 active:scale-95 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin text-primary" : ""}`} />
            <span>重新测算</span>
          </button>

          <button
            onClick={handleCopyList}
            disabled={!basketData}
            className="px-3.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-medium text-gray-200 hover:text-white transition-all flex items-center gap-1.5 active:scale-95 cursor-pointer"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? "已复制清单" : "复制组合清单"}</span>
          </button>

          <button
            onClick={() => setApplyModalOpen(true)}
            disabled={!basketData}
            className="px-4 py-2 rounded-xl bg-gradient-to-r from-primary to-blue-600 hover:from-primary/90 hover:to-blue-600/90 text-white text-xs font-bold shadow-lg shadow-primary/20 transition-all flex items-center gap-1.5 active:scale-95 cursor-pointer"
          >
            <Wallet className="w-3.5 h-3.5" />
            <span>一键入账持仓</span>
          </button>
        </div>
      </div>

      {/* 4 大策略风格选择卡片 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        {strategyCards.map((sc) => {
          const isSelected = strategy === sc.key;
          const Icon = sc.icon;
          return (
            <button
              key={sc.key}
              onClick={() => setStrategy(sc.key)}
              className={`p-4 rounded-2xl border text-left transition-all relative overflow-hidden flex flex-col justify-between cursor-pointer group ${
                isSelected
                  ? `bg-gradient-to-b ${sc.color} shadow-lg ring-1 ring-white/20`
                  : "bg-[#14161d]/80 border-white/5 hover:border-white/15 hover:bg-[#181a24]"
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-2.5">
                  <div className="flex items-center gap-2">
                    <span
                      className={`p-2 rounded-xl ${
                        isSelected ? "bg-white/15 text-white" : "bg-white/5 text-default-400 group-hover:text-white"
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                    </span>
                    <span className="font-bold text-sm text-white">{sc.label}</span>
                  </div>
                  <span
                    className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                      isSelected ? "bg-white/20 text-white" : "bg-white/5 text-default-400"
                    }`}
                  >
                    {sc.badge}
                  </span>
                </div>
                <p className="text-[11px] text-default-400 leading-relaxed">{sc.desc}</p>
              </div>

              <div className="mt-3.5 pt-2 border-t border-white/5 flex items-center justify-between text-[10px]">
                <span className={isSelected ? "text-white font-medium" : "text-default-500"}>
                  {isSelected ? "● 当前生效策略" : "点击切换"}
                </span>
                <ArrowRight
                  className={`w-3 h-3 transition-transform ${
                    isSelected ? "text-white translate-x-0.5" : "text-default-500 group-hover:translate-x-1"
                  }`}
                />
              </div>
            </button>
          );
        })}
      </div>

      {/* 参数定制控制台：数量滑块 + 权重模型选择 */}
      <div className="p-5 rounded-2xl bg-[#14161e] border border-white/10 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          {/* 选股数量滑块 */}
          <div className="space-y-2 flex-1 max-w-xl">
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-200 font-bold flex items-center gap-1.5">
                <Sliders className="w-4 h-4 text-primary" /> 自选股票数量 ({count} 只)
              </span>
              <span className="text-default-400 text-[11px]">
                推荐 <b>5 ~ 12 只</b> 兼顾收益与分散度
              </span>
            </div>

            <div className="flex items-center gap-3">
              <input
                type="range"
                min="3"
                max="20"
                step="1"
                value={count}
                onChange={(e) => setCount(Number(e.target.value))}
                className="w-full h-2 bg-white/10 rounded-lg appearance-none cursor-pointer accent-primary"
              />
              <span className="w-8 text-center font-mono font-bold text-sm text-primary">{count}</span>
            </div>

            <div className="flex items-center gap-1.5 pt-1">
              <span className="text-[10px] text-default-500 mr-1">快捷预设:</span>
              {quickCounts.map((qc) => (
                <button
                  key={qc}
                  onClick={() => setCount(qc)}
                  className={`px-2 py-0.5 rounded-lg text-[10px] font-mono transition-all ${
                    count === qc
                      ? "bg-primary text-primary-foreground font-bold shadow-xs"
                      : "bg-white/5 hover:bg-white/10 text-default-400 hover:text-white"
                  }`}
                >
                  {qc}只
                </button>
              ))}
            </div>
          </div>

          {/* 权重分配方式 */}
          <div className="space-y-2 shrink-0">
            <span className="text-xs text-gray-200 font-bold flex items-center gap-1.5">
              <PieChart className="w-4 h-4 text-primary" /> 组合权重配置方式
            </span>
            <div className="flex items-center bg-black/40 p-1 rounded-xl border border-white/10 text-xs">
              <button
                onClick={() => setWeightMethod("EQUAL")}
                className={`px-3 py-1.5 rounded-lg transition-all font-medium ${
                  weightMethod === "EQUAL"
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-default-400 hover:text-white"
                }`}
              >
                等权均衡配置 (Equal)
              </button>
              <button
                onClick={() => setWeightMethod("DIVIDEND")}
                className={`px-3 py-1.5 rounded-lg transition-all font-medium ${
                  weightMethod === "DIVIDEND"
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-default-400 hover:text-white"
                }`}
              >
                股息率加权 (Dividend Weighted)
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* 🚫 7 重深度排雷过滤全景审计看板 (Excluded Traps Audit Board) */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      {basketData?.antiTrapAudit && (
        <div className="p-6 rounded-3xl bg-gradient-to-br from-[#1a1520] via-[#16141e] to-[#12131a] border border-rose-500/20 shadow-2xl space-y-5">
          {/* 排雷看板头部 */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-rose-500/10 pb-4">
            <div className="flex items-center gap-3">
              <span className="p-2.5 rounded-2xl bg-rose-500/15 text-rose-400 border border-rose-500/30">
                <ShieldAlert className="w-6 h-6" />
              </span>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-extrabold text-white text-base sm:text-lg">
                    7 重全景排雷过滤审计看板 (已拦截 {basketData.antiTrapAudit.totalExcludedCount} 只不合格标的)
                  </h3>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30">
                    负向证明 · 拒当接盘侠
                  </span>
                </div>
                <p className="text-xs text-default-400 mt-0.5">
                  全市场审计母池 <b>{basketData.antiTrapAudit.totalAuditedCount} 只</b>，
                  合格入围 <b>{basketData.antiTrapAudit.passedCandidatesCount} 只</b>，
                  严厉拦截剔除 <b>{basketData.antiTrapAudit.totalExcludedCount} 只</b> 伪高息与暴雷股。
                </p>
              </div>
            </div>

            <button
              onClick={() => setTrapsExpanded(!trapsExpanded)}
              className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-medium text-gray-300 hover:text-white transition-all flex items-center gap-1.5 self-start sm:self-auto cursor-pointer"
            >
              <span>{trapsExpanded ? "折叠排雷明细" : "展开排雷明细"}</span>
              {trapsExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
          </div>

          {/* 6 大维度拦截统计徽章网格 */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
            <div className="p-3 rounded-xl bg-black/40 border border-rose-500/20 text-center space-y-0.5">
              <span className="text-[11px] text-default-400 block">⚡ 强周期见顶</span>
              <span className="text-lg font-mono font-bold text-rose-400">
                {basketData.antiTrapAudit.dimensionCounts["CYCLICAL_PEAK"] || 0} 只
              </span>
            </div>
            <div className="p-3 rounded-xl bg-black/40 border border-rose-500/20 text-center space-y-0.5">
              <span className="text-[11px] text-default-400 block">🛑 财务负债断裂</span>
              <span className="text-lg font-mono font-bold text-rose-400">
                {basketData.antiTrapAudit.dimensionCounts["FINANCIAL_FRAUD_OR_DEBT"] || 0} 只
              </span>
            </div>
            <div className="p-3 rounded-xl bg-black/40 border border-rose-500/20 text-center space-y-0.5">
              <span className="text-[11px] text-default-400 block">🔴 监管立案舆情</span>
              <span className="text-lg font-mono font-bold text-amber-400">
                {basketData.antiTrapAudit.dimensionCounts["REGULATORY_OR_LEGAL"] || 0} 只
              </span>
            </div>
            <div className="p-3 rounded-xl bg-black/40 border border-rose-500/20 text-center space-y-0.5">
              <span className="text-[11px] text-default-400 block">❌ 掏空式分红</span>
              <span className="text-lg font-mono font-bold text-purple-400">
                {basketData.antiTrapAudit.dimensionCounts["PAYOUT_TRAP"] || 0} 只
              </span>
            </div>
            <div className="p-3 rounded-xl bg-black/40 border border-rose-500/20 text-center space-y-0.5">
              <span className="text-[11px] text-default-400 block">⚠️ 盈利恶化失速</span>
              <span className="text-lg font-mono font-bold text-orange-400">
                {basketData.antiTrapAudit.dimensionCounts["PROFIT_DEGRADATION"] || 0} 只
              </span>
            </div>
            <div className="p-3 rounded-xl bg-black/40 border border-rose-500/20 text-center space-y-0.5">
              <span className="text-[11px] text-default-400 block">⛓️ 高质押爆仓</span>
              <span className="text-lg font-mono font-bold text-blue-400">
                {basketData.antiTrapAudit.dimensionCounts["PLEDGE_OR_LOCKUP"] || 0} 只
              </span>
            </div>
          </div>

          {/* 展开的排雷黑名单明细表 */}
          {trapsExpanded && (
            <div className="space-y-3 pt-2">
              {/* 分类过滤器 Tab */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                {trapDimensionFilters.map((tf) => {
                  const isActive = activeTrapFilter === tf.key;
                  return (
                    <button
                      key={tf.key}
                      onClick={() => setActiveTrapFilter(tf.key)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap transition-all cursor-pointer ${
                        isActive
                          ? "bg-rose-500 text-white shadow-md shadow-rose-500/20 font-bold"
                          : "bg-white/5 hover:bg-white/10 text-default-400 hover:text-white"
                      }`}
                    >
                      {tf.label}
                    </button>
                  );
                })}
              </div>

              {/* 明细表格 */}
              <div className="overflow-x-auto rounded-2xl border border-white/10 bg-[#12131a] shadow-inner">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-white/10 bg-white/5 text-default-400">
                      <th className="py-3 px-4 font-semibold">淘汰标的名称/代码</th>
                      <th className="py-3 px-3 font-semibold">所属行业</th>
                      <th className="py-3 px-3 font-semibold">表面股息率</th>
                      <th className="py-3 px-3 font-semibold">排雷风险标签</th>
                      <th className="py-3 px-4 font-semibold">致命排雷原因（为什么绝不能买）</th>
                      <th className="py-3 px-3 text-right font-semibold">操作</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {filteredTraps.map((trap, idx) => (
                      <tr key={trap.code} className="hover:bg-white/5 transition-colors group">
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <span className="w-5 h-5 rounded-full bg-rose-500/15 text-rose-400 text-[10px] font-mono flex items-center justify-center font-bold">
                              ✕
                            </span>
                            <div>
                              <Link
                                href={`/dividend/${trap.code}`}
                                className="font-bold text-gray-200 hover:text-rose-400 line-through decoration-rose-500/50 block text-xs transition-colors"
                              >
                                {trap.name}
                              </Link>
                              <span className="text-[10px] text-default-500 font-mono">{trap.code}</span>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-3 text-default-300">{trap.industry}</td>
                        <td className="py-3 px-3 font-mono">
                          <span className="text-rose-400 font-bold">
                            {trap.surfaceDividendYield > 0 ? `${trap.surfaceDividendYield.toFixed(2)}%` : "--"}
                          </span>
                          <span className="text-[9px] text-rose-500/80 block">⚠️ 虚高陷阱</span>
                        </td>
                        <td className="py-3 px-3">
                          <span className="text-[11px] px-2 py-0.5 rounded-md bg-rose-500/10 border border-rose-500/30 text-rose-300 font-medium">
                            {trap.trapLabel}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <div className="text-xs text-rose-200 font-medium leading-relaxed">
                            {trap.deadlyReason}
                          </div>
                          <div className="text-[10px] text-default-500 mt-0.5">
                            官方依据：{trap.financialEvidence}
                          </div>
                        </td>
                        <td className="py-3 px-3 text-right">
                          <Link
                            href={`/dividend/${trap.code}`}
                            className="px-2.5 py-1 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 hover:text-rose-200 border border-rose-500/30 text-[11px] font-medium transition-colors inline-flex items-center gap-1"
                          >
                            <span>排雷体检</span>
                            <ExternalLink className="w-3 h-3" />
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* 降维打击传统 ETF 对比大看板 */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      {basketData && (
        <div className="p-6 rounded-3xl bg-gradient-to-br from-[#171a24] via-[#14161f] to-[#13141b] border border-white/10 shadow-xl space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <Percent className="w-5 h-5" />
              </span>
              <div>
                <h3 className="font-bold text-white text-base">
                  自建定制组合 vs 传统中证红利 ETF (510880) 降维对比
                </h3>
                <p className="text-xs text-default-400">
                  {basketData.etfComparison.summaryVerdict}
                </p>
              </div>
            </div>

            <div className="text-right shrink-0">
              <span className="text-[10px] text-default-500 block">测算时间</span>
              <span className="text-xs text-default-400 font-mono">{basketData.generatedAt}</span>
            </div>
          </div>

          {/* 4 核心指标对比网格 */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
            {/* 指标 1: 加权股息率 */}
            <div className="p-4 rounded-2xl bg-black/30 border border-white/5 space-y-1">
              <span className="text-xs text-default-400 block">组合加权股息率</span>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-extrabold font-mono text-emerald-400">
                  {basketData.metrics.weightedDividendYield}%
                </span>
                <span className="text-xs text-default-400">
                  (ETF: {basketData.etfBenchmark.dividendYield}%)
                </span>
              </div>
              <span className="text-[10px] text-emerald-400 font-medium block">
                ▲ 股息超额 +{basketData.etfComparison.yieldAdvantagePct}%
              </span>
            </div>

            {/* 指标 2: 加权 ROE 质量 */}
            <div className="p-4 rounded-2xl bg-black/30 border border-white/5 space-y-1">
              <span className="text-xs text-default-400 block">组合加权 ROE (造血能力)</span>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-extrabold font-mono text-amber-400">
                  {basketData.metrics.weightedRoe}%
                </span>
                <span className="text-xs text-default-400">
                  (ETF: {basketData.etfBenchmark.roe}%)
                </span>
              </div>
              <span className="text-[10px] text-amber-400 font-medium block">
                ▲ 盈利品质 +{basketData.etfComparison.roeAdvantagePct}%
              </span>
            </div>

            {/* 指标 3: 排除垃圾股与周期陷阱 */}
            <div className="p-4 rounded-2xl bg-black/30 border border-white/5 space-y-1">
              <span className="text-xs text-default-400 block">7 重排雷已拦截风险股</span>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-extrabold font-mono text-rose-400">
                  {basketData.antiTrapAudit.totalExcludedCount} 只
                </span>
                <span className="text-xs text-default-400">
                  (已排雷)
                </span>
              </div>
              <span className="text-[10px] text-rose-300 truncate block">
                全景拦截周期见顶/高负债/立案
              </span>
            </div>

            {/* 指标 4: 年省管理费 */}
            <div className="p-4 rounded-2xl bg-black/30 border border-white/5 space-y-1">
              <span className="text-xs text-default-400 block">每年净省基金管理与托管费</span>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-extrabold font-mono text-blue-400">
                  0.60%
                </span>
                <span className="text-xs text-default-400">
                  (¥0 磨损)
                </span>
              </div>
              <span className="text-[10px] text-blue-300 block">
                100万本金每年净省 ¥{basketData.etfComparison.savedFeePer1mAnnual}
              </span>
            </div>
          </div>

          {/* 行业穿透分布条 */}
          <div className="pt-2 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-gray-300 flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-primary" /> 行业穿透分布 (严格执行 ≤30% 分散约束)
              </span>
              <span className="text-[10px] text-default-500">
                涵盖 {Object.keys(basketData.industryDistribution).length} 个细分核心行业
              </span>
            </div>

            <div className="flex flex-wrap gap-2">
              {Object.entries(basketData.industryDistribution).map(([ind, pct]) => (
                <div
                  key={ind}
                  className="px-2.5 py-1 rounded-xl bg-white/5 border border-white/10 text-xs flex items-center gap-1.5"
                >
                  <span className="text-gray-300">{ind}</span>
                  <span className="font-mono font-bold text-primary">{pct}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 精选个股清单卡片与表格 */}
      {basketData && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-400" />
              入选优质股票明细 ({basketData.stocks.length} 只)
            </h2>
            <span className="text-xs text-default-400">
              数据源：交易所实时行情 + 官方三大财报体检
            </span>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-white/10 bg-[#14161e]/90 shadow-xl">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-white/10 bg-white/5 text-default-400">
                  <th className="py-3.5 px-4 font-semibold">标的名称/代码</th>
                  <th className="py-3.5 px-3 font-semibold">现价/今日</th>
                  <th className="py-3.5 px-3 font-semibold">动态股息率</th>
                  <th className="py-3.5 px-3 font-semibold">ROE (收益率)</th>
                  <th className="py-3.5 px-3 font-semibold">估值 PE/PB</th>
                  <th className="py-3.5 px-3 font-semibold">建议配置权重</th>
                  <th className="py-3.5 px-4 font-semibold">入选核心理由与国家队标签</th>
                  <th className="py-3.5 px-3 text-right font-semibold">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {basketData.stocks.map((stock, idx) => (
                  <tr key={stock.code} className="hover:bg-white/5 transition-colors group">
                    {/* 标的名称/代码 */}
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-white/5 text-default-400 text-[10px] font-mono flex items-center justify-center">
                          {idx + 1}
                        </span>
                        <div>
                          <Link
                            href={`/dividend/${stock.code}`}
                            className="font-bold text-white hover:text-primary transition-colors block text-xs"
                          >
                            {stock.name}
                          </Link>
                          <span className="text-[10px] text-default-500 font-mono">{stock.code} · {stock.industry}</span>
                        </div>
                      </div>
                    </td>

                    {/* 现价/涨跌幅 */}
                    <td className="py-3.5 px-3 font-mono">
                      <div className="text-white font-bold">¥{stock.price.toFixed(2)}</div>
                      <div
                        className={`text-[10px] font-semibold ${
                          stock.changePct >= 0 ? "text-rose-400" : "text-emerald-400"
                        }`}
                      >
                        {stock.changePct >= 0 ? "+" : ""}
                        {stock.changePct.toFixed(2)}%
                      </div>
                    </td>

                    {/* 股息率 */}
                    <td className="py-3.5 px-3 font-mono">
                      <span className="text-emerald-400 font-bold text-sm">
                        {stock.dividendYield.toFixed(2)}%
                      </span>
                    </td>

                    {/* ROE */}
                    <td className="py-3.5 px-3 font-mono">
                      <span className="text-amber-400 font-semibold">
                        {stock.roe.toFixed(1)}%
                      </span>
                    </td>

                    {/* PE / PB */}
                    <td className="py-3.5 px-3 font-mono text-[11px] text-default-300">
                      <div>PE: {stock.pe > 0 ? stock.pe.toFixed(1) : "--"}</div>
                      <div className="text-default-500">PB: {stock.pb.toFixed(2)}</div>
                    </td>

                    {/* 建议权重 */}
                    <td className="py-3.5 px-3 font-mono">
                      <div className="flex items-center gap-1.5">
                        <div className="w-16 h-2 bg-white/10 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-primary rounded-full"
                            style={{ width: `${Math.min(100, stock.weightPct * 3)}%` }}
                          />
                        </div>
                        <span className="font-bold text-white text-xs">{stock.weightPct}%</span>
                      </div>
                    </td>

                    {/* 入选核心理由与潜在风险提示 */}
                    <td className="py-3.5 px-4">
                      <div className="space-y-1.5">
                        {/* 理由标签 */}
                        <div className="flex flex-wrap gap-1.5">
                          {stock.nationalTeamRatio > 0 && (
                            <span className="text-[10px] px-2 py-0.5 rounded-md bg-blue-500/15 border border-blue-500/25 text-blue-400 font-medium flex items-center gap-1">
                              <Landmark className="w-2.5 h-2.5" /> 国家队{stock.nationalTeamRatio}%
                            </span>
                          )}
                          {stock.reasons.map((r, ri) => (
                            <span
                              key={ri}
                              className="text-[10px] px-2 py-0.5 rounded-md bg-white/5 border border-white/10 text-default-300"
                            >
                              {r}
                            </span>
                          ))}
                        </div>

                        {/* 潜在可能风险与宏观逆风提示 */}
                        {stock.potentialRisks && stock.potentialRisks.length > 0 && (
                          <div className="flex flex-wrap gap-1 pt-0.5">
                            {stock.potentialRisks.map((risk, rki) => (
                              <span
                                key={rki}
                                className="text-[9.5px] px-1.5 py-0.5 rounded-md bg-amber-500/10 border border-amber-500/20 text-amber-300/90 flex items-center gap-1"
                              >
                                <AlertTriangle className="w-2.5 h-2.5 text-amber-400 shrink-0" />
                                {risk}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </td>

                    {/* 操作 */}
                    <td className="py-3.5 px-3 text-right">
                      <Link
                        href={`/dividend/${stock.code}`}
                        className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-default-400 hover:text-white transition-all inline-flex items-center"
                        title="查看深度财报体检"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 一键入账模态框 */}
      {applyModalOpen && basketData && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-[#161822] border border-white/15 rounded-3xl p-6 shadow-2xl space-y-5 animate-scale-in">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Wallet className="w-5 h-5 text-primary" />
                一键入账持仓账本
              </h3>
              <button
                onClick={() => setApplyModalOpen(false)}
                className="text-default-400 hover:text-white text-xs"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-default-400 leading-relaxed">
              系统将按照当前 <b>{basketData.strategyMeta.name}</b> 的权重比例，将 <b>{basketData.stocks.length} 只标的</b> 批量入账至您的个人资产持仓列表中。
            </p>

            <div className="space-y-2">
              <label className="text-xs font-bold text-gray-200 block">
                拟投入总金额 (元)
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-default-400 text-sm">
                  ¥
                </span>
                <input
                  type="number"
                  min="1000"
                  step="10000"
                  value={investmentAmount}
                  onChange={(e) => setInvestmentAmount(Number(e.target.value))}
                  className="w-full pl-8 pr-4 py-2.5 rounded-xl bg-black/40 border border-white/10 text-white font-mono text-sm focus:outline-none focus:border-primary"
                />
              </div>
              <div className="flex justify-between text-[10px] text-default-500 font-mono">
                <span>预估组合年分红收益:</span>
                <span className="text-emerald-400 font-bold">
                  ≈ ¥{(investmentAmount * (basketData.metrics.weightedDividendYield / 100)).toFixed(2)} / 年
                </span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setApplyModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-xs text-default-300"
              >
                取消
              </button>
              <button
                onClick={handleConfirmApply}
                disabled={applying}
                className="px-5 py-2 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-bold transition-all shadow-md active:scale-95 flex items-center gap-1.5 cursor-pointer"
              >
                {applying ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                <span>{applying ? "入账中..." : "确认批量入账"}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 浮动 Toast 提示 */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 p-4 rounded-2xl bg-[#1c2438] border border-emerald-500/40 text-emerald-400 text-xs shadow-2xl flex items-center gap-2 animate-slide-up">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span className="font-medium">{toastMessage}</span>
        </div>
      )}
    </div>
  );
}
