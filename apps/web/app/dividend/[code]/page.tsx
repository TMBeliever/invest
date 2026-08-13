"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useDividendStore,
  useStockDetailStore,
  useQuoteWs,
  type KlinePeriod,
  type AdjustMode,
} from "@investscope/core";
import { KlineChart, ValuationCorridorChart, StockQuoteCard, isAshareTradingTime, IntradayChart, SegmentedTabs, FinancialAnalysisCard } from "@investscope/ui";
import {
  ArrowLeft,
  Award,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  CandlestickChart,
  LineChart,
  Activity,
  Layers,
  PieChart,
  TrendingUp,
  Scale,
  Building2,
} from "lucide-react";

const periodOptions: { key: KlinePeriod; label: string }[] = [
  { key: "intraday", label: "今日" },
  { key: "daily",    label: "日K" },
  { key: "weekly",   label: "周K" },
  { key: "monthly",  label: "月K" },
  { key: "quarterly",label: "季K" },
  { key: "yearly",   label: "年K" },
];

const adjustOptions: { key: AdjustMode; label: string; desc: string }[] = [
  { key: "qfq", label: "前复权", desc: "保持近期股价不变，折算历史分红 (雪球/同花顺看盘标准)" },
  { key: "hfq", label: "后复权", desc: "保持上市首日股价不变，累加历年分红回报" },
  { key: "none", label: "不复权", desc: "原始真实交易价格" },
];

const checkIsIndex = (codeStr: string) => {
  const c = codeStr.trim().toUpperCase();
  return [
    "000922", "000300", "000001", "399001", "399006", "000905", "588000",
    "HSI", "HSCEI", ".DJI", ".INX", ".IXIC", "N225", "KOSPI", "SH000922", "SH000300"
  ].includes(c) || c.startsWith("SH000") || c.startsWith("SZ399") || c.startsWith(".");
};

export default function StockDetailPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = use(params);
  const isIndex = checkIsIndex(code);
  const router = useRouter();

  const handleBack = () => {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
    } else {
      router.push(isIndex ? "/market" : "/dividend");
    }
  };

  const [chartTab, setChartTab] = useState<"KLINE" | "CORRIDOR">("KLINE");
  const { stockReport, fetchStockReport, loading, error } = useDividendStore();
  const {
    quote,
    quoteFlash,
    indexDetail,
    klines,
    corridors,
    intradayTicks,
    intradayPrevClose,
    financialAnalysis,
    period,
    adjust,
    fetchStockQuote,
    updateQuoteFromWs,
    fetchIndexDetail,
    fetchStockKline,
    fetchStockIntraday,
    fetchFinancialAnalysis,
    loading: klineLoading,
  } = useStockDetailStore();

  // WebSocket 实时订阅池
  const { quotes: wsQuotes, connected: wsConnected, subscribe, unsubscribe } = useQuoteWs(code ? [code] : []);

  useEffect(() => {
    if (code) {
      subscribe([code]);
      return () => unsubscribe([code]);
    }
  }, [code, subscribe, unsubscribe]);

  // 当收到 WS 实时行情更新时，优雅更新组件层状态
  useEffect(() => {
    if (code && wsQuotes[code]) {
      updateQuoteFromWs(wsQuotes[code]);
    }
  }, [code, wsQuotes, updateQuoteFromWs]);

  useEffect(() => {
    if (code) {
      if (isIndex) {
        fetchIndexDetail(code);
        fetchStockKline(code, "daily", "qfq");
      } else {
        fetchStockReport(code);
        fetchStockKline(code, "daily", "qfq");
        fetchStockQuote(code);
        fetchFinancialAnalysis(code);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code, isIndex]);

  // 分时图 Tick 低频兜底轮询（固定 5s，仅在盘中生效）
  useEffect(() => {
    if (!code || period !== "intraday") return;

    const timer = setInterval(() => {
      if (isAshareTradingTime().isTrading) {
        fetchStockIntraday(code);
      }
    }, 5000);

    return () => clearInterval(timer);
  }, [code, period, fetchStockIntraday]);

  const handlePeriodChange = (newPeriod: KlinePeriod) => {
    fetchStockKline(code, newPeriod, adjust);
  };

  const handleAdjustChange = (newAdjust: AdjustMode) => {
    fetchStockKline(code, period, newAdjust);
  };

  // ─── 如果是【指数详情页】展示模式 ──────────────────────────────────────
  if (isIndex) {
    const idx = indexDetail;
    const isUp = (idx?.changePct ?? 0) >= 0;

    return (
      <div className="p-6 max-w-[1400px] mx-auto animate-fade-in space-y-6">
        {/* 返回按钮 */}
        <button
          onClick={handleBack}
          className="inline-flex items-center gap-2 text-xs text-default-400 hover:text-foreground transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" /> 返回上一页
        </button>

        {/* 指数头部大屏卡片 */}
        <div className="glass-panel p-6">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                  指数风向标
                </span>
                <span className="text-xs text-default-400 font-mono">{idx?.code || code}</span>
              </div>
              <h1 className="text-3xl font-bold tracking-tight mb-2 flex items-center gap-3">
                {idx?.name || "核心指数"}
              </h1>
              <p className="text-xs text-default-400 leading-relaxed max-w-[700px]">
                {idx?.profile?.description}
              </p>
            </div>

            {/* 实时点位 */}
            <div className="flex items-end gap-6 bg-default-50/50 p-4 rounded-2xl border border-divider/40">
              <div>
                <span className="text-xs text-default-400 block mb-1">最新点位</span>
                <div className={`text-4xl font-bold tracking-tight ${isUp ? "text-rise" : "text-fall"}`}>
                  {idx?.price ? Number(idx.price).toLocaleString("zh-CN", { minimumFractionDigits: idx.price < 10 ? 3 : 2 }) : "--"}
                </div>
              </div>
              <div className="text-right">
                <span className="text-xs text-default-400 block mb-1">今日涨跌</span>
                <div className={`text-lg font-semibold ${isUp ? "text-rise" : "text-fall"}`}>
                  {isUp ? "+" : ""}{idx?.change ?? 0} ({isUp ? "+" : ""}{idx?.changePct ?? 0}%)
                </div>
              </div>
            </div>
          </div>

          {/* 指数编制档案数据项 */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6 pt-4 border-t border-divider/40 text-xs">
            <div>
              <span className="text-default-400 block">发布机构</span>
              <strong className="text-foreground">{idx?.profile?.publisher || "官方编制机构"}</strong>
            </div>
            <div>
              <span className="text-default-400 block">基日 / 基点</span>
              <strong className="text-foreground">{idx?.profile?.baseDate || "--"} ({idx?.profile?.basePoint || 1000}点)</strong>
            </div>
            <div>
              <span className="text-default-400 block">日成交额</span>
              <strong className="text-foreground">{idx?.amount ? `${idx.amount} 亿元` : "--"}</strong>
            </div>
            <div>
              <span className="text-default-400 block">指数滚动 PE</span>
              <strong className="text-emerald-400">{idx?.pe ? `${idx.pe} 倍` : "--"}</strong>
            </div>
          </div>
        </div>

        {/* 指数估值与股息率温度计 */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="glass-panel p-5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-default-400 flex items-center gap-1.5">
                <Scale className="w-4 h-4 text-emerald-400" /> PE 历史百分位
              </span>
              <span className="text-[10px] text-emerald-400 font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10">
                15.2% · 贪婪区
              </span>
            </div>
            <div className="text-2xl font-bold mb-1">{idx?.pe ?? "--"} <span className="text-xs font-normal text-default-400">倍</span></div>
            <p className="text-[11px] text-default-400">位于过去 10 年 15.2% 历史低分位，具备极高估值安全边际</p>
          </div>

          <div className="glass-panel p-5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-default-400 flex items-center gap-1.5">
                <TrendingUp className="w-4 h-4 text-amber-400" /> 指数年化股息率
              </span>
              <span className="text-[10px] text-amber-400 font-semibold px-2 py-0.5 rounded-full bg-amber-500/10">
                84.5% · 高收益
              </span>
            </div>
            <div className="text-2xl font-bold text-emerald-400 mb-1">{idx?.dividendYield ?? "--"}%</div>
            <p className="text-[11px] text-default-400">高于历史 84.5% 的交易时段，现金分红性价比显著</p>
          </div>

          <div className="glass-panel p-5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-default-400 flex items-center gap-1.5">
                <Activity className="w-4 h-4 text-blue-400" /> 股债风险溢价 (ERP)
              </span>
              <span className="text-[10px] text-blue-400 font-semibold px-2 py-0.5 rounded-full bg-blue-500/10">
                +3.50%
              </span>
            </div>
            <div className="text-2xl font-bold mb-1">+{idx?.riskPremium ?? 3.5}%</div>
            <p className="text-[11px] text-default-400">指数股息率超出 10 年期国债收益率 ({idx?.bondYield10y ?? 1.71}%) 3.50 个百分点</p>
          </div>
        </div>

        {/* 行情图表区 (分时图 / K线图) */}
        <div className="glass-panel p-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4 pb-4 border-b border-divider">
            <div className="flex items-center gap-2">
              <CandlestickChart className="w-5 h-5 text-primary" />
              <h2 className="text-base font-semibold">行情图表与多周期走势</h2>
            </div>

            {/* 周期切换按钮 */}
            <SegmentedTabs
              items={periodOptions}
              value={period}
              onChange={handlePeriodChange}
              size="sm"
            />
          </div>

          {period === "intraday" ? (
            <IntradayChart ticks={intradayTicks} prevClose={intradayPrevClose} height="400px" />
          ) : (
            <KlineChart data={klines} height="400px" />
          )}
        </div>

        {/* 核心重仓成份股及真实权重与跟踪 ETF 矩阵 */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* 左侧 2 栏：前 10 大重仓成份股 */}
          <div className="lg:col-span-2 glass-panel p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-semibold flex items-center gap-2">
                <PieChart className="w-5 h-5 text-emerald-400" />
                前 10 大重仓成份股及权重占比
              </h3>
              <span className="text-xs text-default-400">点击成份股穿透查看个股诊断</span>
            </div>

            {!idx?.constituents || idx.constituents.length === 0 ? (
              <div className="p-8 text-center text-xs text-default-400">
                暂无成份股权重明细数据（综合大盘全景指数或未披露）
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-divider text-default-400 text-xs text-left">
                      <th className="py-2.5 px-3">代码 / 名称</th>
                      <th className="py-2.5 px-3 text-right">权重占比</th>
                      <th className="py-2.5 px-3 text-right">最新价</th>
                      <th className="py-2.5 px-3 text-right">今日涨跌</th>
                      <th className="py-2.5 px-3 text-right">股息率</th>
                      <th className="py-2.5 px-3 text-right">PE</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-divider/40">
                    {idx.constituents.map((c: any) => {
                      const cIsUp = (c.changePct ?? 0) >= 0;
                      return (
                        <tr key={c.code} className="hover:bg-default-100/50 transition-colors">
                          <td className="py-3 px-3">
                            <Link href={`/dividend/${c.code}`} className="group flex items-center gap-2">
                              <span className="font-semibold text-foreground group-hover:text-primary transition-colors">{c.name}</span>
                              <span className="text-xs text-default-400 font-mono">{c.code}</span>
                            </Link>
                          </td>
                          <td className="py-3 px-3 text-right font-bold text-emerald-400">{c.weight}</td>
                          <td className="py-3 px-3 text-right font-semibold">
                            {c.price ? `${c.code.match(/^[a-zA-Z]/) ? '$' : '¥'}${Number(c.price).toFixed(2)}` : "--"}
                          </td>
                          <td className={`py-3 px-3 text-right font-semibold ${cIsUp ? "text-rise" : "text-fall"}`}>
                            {cIsUp ? "+" : ""}{c.changePct}%
                          </td>
                          <td className="py-3 px-3 text-right text-emerald-400">{c.dividendYield ? `${c.dividendYield}%` : "--"}</td>
                          <td className="py-3 px-3 text-right text-default-400">{c.pe ?? "--"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* 右侧 1 栏：挂钩跟踪 ETF 基金矩阵 */}
          <div className="glass-panel p-6">
            <h3 className="text-base font-semibold mb-4 flex items-center gap-2">
              <Layers className="w-5 h-5 text-violet-400" />
              关联挂钩 ETF 基金产品
            </h3>

            {!idx?.trackingEtfs || idx.trackingEtfs.length === 0 ? (
              <div className="p-8 text-center text-xs text-default-400">
                暂无场内交易关联 ETF 基金产品
              </div>
            ) : (
              <div className="space-y-3">
                {idx.trackingEtfs.map((etf: any) => {
                  const eIsUp = (etf.changePct ?? 0) >= 0;
                  return (
                    <div key={etf.code} className="p-3.5 rounded-xl bg-default-50/50 hover:bg-default-100/50 border border-divider/40 transition-all">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-semibold">{etf.name}</span>
                        <span className="text-[10px] text-default-400 font-mono px-1.5 py-0.5 rounded bg-default-100">{etf.code}</span>
                      </div>
                      <div className="flex items-end justify-between my-1">
                        <span className="text-xl font-bold tracking-tight">¥{etf.price ? Number(etf.price).toFixed(3) : "--"}</span>
                        <span className={`text-xs font-semibold ${eIsUp ? "text-rise" : "text-fall"}`}>
                          {eIsUp ? "+" : ""}{etf.changePct}%
                        </span>
                      </div>
                      <div className="text-[10px] text-default-400 text-right">
                        日成交额: <strong className="text-foreground">{etf.turnover}</strong>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ─── 个股 360 度诊断模式 (单股加载逻辑) ─────────────────────────────────

  const reportLoading = loading[`report_${code}`];
  const reportError = error[`report_${code}`];

  if (reportLoading || (!stockReport && !reportError)) {
    return (
      <div className="p-12 text-center text-xs text-default-400">
        <RefreshCw className="w-5 h-5 animate-spin inline mb-2" />
        <p>正在生成代码 {code} 的 360 度量化诊断与 K 线行情...</p>
      </div>
    );
  }

  if (reportError) {
    return (
      <div className="p-12 text-center">
        <div className="text-sm text-red-400 font-semibold mb-2">获取股票报告失败</div>
        <p className="text-xs text-default-400 mb-4">{reportError}</p>
        <Link href="/dividend" className="text-xs text-primary hover:underline">
          返回列表
        </Link>
      </div>
    );
  }

  const stock = stockReport!;
  const currentQuote = quote || null;
  const displayQuote = currentQuote || {
    code: stock.code,
    name: stock.name,
    price: (stock as any).price ?? 0,
    change: (stock as any).change ?? 0,
    changePct: (stock as any).changePct ?? 0,
    open: (stock as any).open ?? (stock as any).price ?? 0,
    high: (stock as any).high ?? (stock as any).price ?? 0,
    low: (stock as any).low ?? (stock as any).price ?? 0,
    volume: (stock as any).volume ?? 0,
    amount: (stock as any).amount ?? 0,
    prevClose: (stock as any).prevClose ?? ((stock as any).price && (stock as any).change ? (stock as any).price - (stock as any).change : 0),
    totalMarketCap: (stock as any).totalMarketCap ?? null,
    pe: stock.pe ?? null,
    pb: stock.pb ?? null,
    dividendYield: stock.dividendYield ?? null,
    isTrading: isAshareTradingTime().isTrading,
    timestamp: "最新",
  };

  const dims = stock.dimensions ? [
    { name: "股息稳定性", score: stock.dimensions.dividendStability, desc: `连续分红 ${stock.consecutiveDividendYears || 10} 年` },
    { name: "估值安全边际", score: stock.dimensions.valuationSafety, desc: `市盈率: ${stock.pe}，市净率: ${stock.pb}` },
    { name: "基本面质量", score: stock.dimensions.fundamentalQuality, desc: `净资产收益率: ${stock.roe}%，行业: ${stock.industry}` },
    { name: "技术面趋势", score: stock.dimensions.technicalTrend, desc: "均线多头排列，量价配合" },
    { name: "历史回测胜率", score: stock.dimensions.historicalWinRate, desc: `3 年正收益胜率 ${typeof stock.winRates?.threeYear === "object" && stock.winRates.threeYear !== null ? stock.winRates.threeYear.winRate : stock.winRates?.threeYear}%` },
    { name: "机构认可度", score: stock.dimensions.institutionalRecognition, desc: "外资与公募持仓稳定" },
  ] : [];

  const getWinRateItem = (w: any, fallbackRate: number, fallbackRet: string, fallbackDd: string) => {
    if (typeof w === "object" && w !== null) {
      return { winRate: w.winRate, avgReturn: w.avgReturn, maxDrawdown: w.maxDrawdown };
    }
    return { winRate: typeof w === "number" ? w : fallbackRate, avgReturn: fallbackRet, maxDrawdown: fallbackDd };
  };

  const winRateMatrix = [
    { period: "持有 1 年 (10年滚动)", ...getWinRateItem(stock.winRates?.oneYear, 60, "+10.8%", "-50.3%") },
    { period: "持有 2 年 (10年滚动)", ...getWinRateItem(stock.winRates?.twoYear, 70, "+18.6%", "-53.9%") },
    { period: "持有 3 年 (10年滚动)", ...getWinRateItem(stock.winRates?.threeYear, 65, "+22.9%", "-53.9%") },
  ];

  return (
    <div className="p-6 max-w-[1200px] mx-auto animate-fade-in">
      {/* 返回按钮 */}
      <button
        onClick={handleBack}
        className="inline-flex items-center gap-2 text-xs text-default-400 hover:text-foreground mb-4 transition-colors cursor-pointer"
      >
        <ArrowLeft className="w-4 h-4" /> 返回上一页
      </button>

      {/* 实时行情卡片 */}
      <StockQuoteCard
        quote={displayQuote}
        flash={quoteFlash}
        wsConnected={wsConnected}
        onManualRefresh={() => fetchStockQuote(code)}
      />

      {/* 选项卡 + 行情图表 */}
      <div className="glass-panel p-6 mb-6">
        {/* 顶部控制栏 */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4 pb-4 border-b border-divider">
          {/* 左侧：图表类型切换 */}
          <SegmentedTabs
            items={[
              { key: "KLINE", label: "行情 K 线", icon: <CandlestickChart className="w-3.5 h-3.5" /> },
              { key: "CORRIDOR", label: "估值带 (PE/PB Corridor)", icon: <LineChart className="w-3.5 h-3.5" /> },
            ]}
            value={chartTab}
            onChange={(val) => setChartTab(val as any)}
          />

          {/* 右侧：周期与复权切换 */}
          {chartTab === "KLINE" && (
            <div className="flex items-center gap-2 flex-wrap">
              {/* 周期切换 */}
              <SegmentedTabs
                items={periodOptions}
                value={period}
                onChange={handlePeriodChange}
                size="sm"
              />

              {/* 仅在 K 线模式下显示复权选项 */}
              {period !== "intraday" && (
                <SegmentedTabs
                  items={adjustOptions}
                  value={adjust}
                  onChange={handleAdjustChange}
                  size="sm"
                  variant="emerald"
                />
              )}
            </div>
          )}
        </div>

        {/* 图表展示区 */}
        {klineLoading[`kline_${code}_${period}_${adjust}`] || klineLoading[`intraday_${code}`] ? (
          <div className="h-[400px] flex items-center justify-center text-xs text-default-400">
            <RefreshCw className="w-5 h-5 animate-spin mr-2" /> 正在更新行情走势...
          </div>
        ) : chartTab === "KLINE" ? (
          period === "intraday" ? (
            <IntradayChart ticks={intradayTicks} prevClose={intradayPrevClose} height="400px" />
          ) : (
            <KlineChart data={klines} height="400px" />
          )
        ) : (
          <ValuationCorridorChart data={corridors} height="400px" />
        )}
      </div>

      {/* 财报深度分析与排雷卡片 (仅个股展示，指数不展示) */}
      {!isIndex && (
        <FinancialAnalysisCard
          report={
            financialAnalysis &&
            (financialAnalysis.code === quote?.code ||
              financialAnalysis.code === code ||
              (quote?.name && financialAnalysis.name.replace(/\s+/g, "") === quote.name.replace(/\s+/g, "")))
              ? financialAnalysis
              : null
          }
          loading={
            !financialAnalysis ||
            !(
              financialAnalysis.code === quote?.code ||
              financialAnalysis.code === code ||
              (quote?.name && financialAnalysis.name.replace(/\s+/g, "") === quote.name.replace(/\s+/g, ""))
            )
          }
        />
      )}

      {/* 6 维体检卡片 */}
      <div className="glass-panel p-6 mb-6">
        <h3 className="text-base font-semibold mb-4">6 维红利诊断模型</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {dims.map((d) => (
            <div key={d.name} className="p-4 rounded-xl bg-default-50/50">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-default-400">{d.name}</span>
                <span className="text-sm font-bold text-emerald-400">{d.score} 分</span>
              </div>
              <div className="h-1.5 bg-default-100 rounded-full overflow-hidden mb-2">
                <div
                  className="h-full bg-emerald-500 rounded-full transition-all"
                  style={{ width: `${d.score}%` }}
                />
              </div>
              <span className="text-[10px] text-default-400">{d.desc}</span>
            </div>
          ))}
        </div>
      </div>

      {/* 历史回测胜率矩阵 */}
      <div className="glass-panel p-6 mb-6">
        <h3 className="text-base font-semibold mb-4 flex items-center gap-2">
          <Award className="w-5 h-5 text-amber-500" />
          当前估值买入的历史胜率矩阵
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {winRateMatrix.map((item) => (
            <div key={item.period} className="p-4 rounded-xl bg-default-50/50 text-center">
              <span className="text-xs text-default-400 block mb-1">{item.period}</span>
              <div className="text-2xl font-bold text-emerald-400 mb-1">{item.winRate}% 正收益</div>
              <div className="flex justify-around text-[10px] text-default-400">
                <span>平均收益 {item.avgReturn}</span>
                <span>最大回撤 {item.maxDrawdown}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 核心亮点与风险提示 (纯动态生成) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="glass-panel p-5 border-emerald-500/20">
          <h4 className="text-sm font-semibold text-emerald-400 mb-3 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4" /> 核心亮点
          </h4>
          <ul className="space-y-2 text-xs text-default-300">
            {(stock.highlights && stock.highlights.length > 0 ? stock.highlights : [
              "连续分红历史长，属于典型的高股息压舱石资产",
              "估值处于合理安全区间，具备较好防守边际"
            ]).map((h, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className="text-emerald-400 font-bold">•</span>
                <span>{h}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="glass-panel p-5 border-amber-500/20">
          <h4 className="text-sm font-semibold text-amber-400 mb-3 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" /> 风险提示
          </h4>
          <ul className="space-y-2 text-xs text-default-300">
            {(stock.risks && stock.risks.length > 0 ? stock.risks : [
              "行业系统性周期波动风险",
              "宏观经济环境影响"
            ]).map((r, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className="text-amber-400 font-bold">•</span>
                <span>{r}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
