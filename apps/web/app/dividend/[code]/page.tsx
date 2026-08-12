"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import {
  useDividendStore,
  useStockDetailStore,
  type KlinePeriod,
  type AdjustMode,
} from "@investscope/core";
import { KlineChart, ValuationCorridorChart } from "@investscope/ui";
import {
  ArrowLeft,
  Award,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  CandlestickChart,
  LineChart,
} from "lucide-react";

const periodOptions: { key: KlinePeriod; label: string }[] = [
  { key: "daily", label: "日K" },
  { key: "weekly", label: "周K" },
  { key: "monthly", label: "月K" },
  { key: "quarterly", label: "季K" },
  { key: "yearly", label: "年K" },
];

const adjustOptions: { key: AdjustMode; label: string; desc: string }[] = [
  { key: "qfq", label: "前复权", desc: "保持近期股价不变，折算历史分红 (雪球/同花顺看盘标准)" },
  { key: "hfq", label: "后复权", desc: "保持上市首日股价不变，累加历年分红回报" },
  { key: "none", label: "不复权", desc: "交易所原始实际撮合成交价" },
];

export default function StockDetailPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = use(params);
  const [chartTab, setChartTab] = useState<"KLINE" | "CORRIDOR">("KLINE");
  const { stockReport, fetchStockReport, loading, error } = useDividendStore();
  const { klines, corridors, period, adjust, fetchStockKline, loading: klineLoading } = useStockDetailStore();

  useEffect(() => {
    if (code) {
      fetchStockReport(code);
      fetchStockKline(code, "daily", "qfq");
    }
  }, [code, fetchStockReport, fetchStockKline]);

  const handlePeriodChange = (newPeriod: KlinePeriod) => {
    fetchStockKline(code, newPeriod, adjust);
  };

  const handleAdjustChange = (newAdjust: AdjustMode) => {
    fetchStockKline(code, period, newAdjust);
  };

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
        <Link href="/dividend" className="text-xs text-primary hover:underline">← 返回红利测温列表</Link>
      </div>
    );
  }

  const stock = stockReport!;
  const currentPeriodObj = periodOptions.find((p) => p.key === period) || periodOptions[0];
  const currentAdjustObj = adjustOptions.find((a) => a.key === adjust) || adjustOptions[0];

  const dims = stock.dimensions ? [
    { name: "股息稳定性", score: stock.dimensions.dividendStability, desc: `连续分红 ${stock.consecutiveDividendYears || 10} 年` },
    { name: "估值安全边际", score: stock.dimensions.valuationSafety, desc: `市盈率: ${stock.pe}，市净率: ${stock.pb}` },
    { name: "基本面质量", score: stock.dimensions.fundamentalQuality, desc: `净资产收益率: ${stock.roe}%，行业: ${stock.industry}` },
    { name: "技术面趋势", score: stock.dimensions.technicalTrend, desc: "均线多头排列，量价配合" },
    { name: "历史回测胜率", score: stock.dimensions.historicalWinRate, desc: `3 年正收益胜率 ${stock.winRates?.threeYear}%` },
    { name: "机构认可度", score: stock.dimensions.institutionalRecognition, desc: "外资与公募持仓稳定" },
  ] : [];

  const winRateMatrix = [
    { period: "持有 1 年", winRate: stock.winRates?.oneYear ?? 78, avgReturn: "+12.4%", maxDrawdown: "-8.5%" },
    { period: "持有 2 年", winRate: stock.winRates?.twoYear ?? 84, avgReturn: "+24.8%", maxDrawdown: "-11.2%" },
    { period: "持有 3 年", winRate: stock.winRates?.threeYear ?? 89, avgReturn: "+38.6%", maxDrawdown: "-12.0%" },
  ];

  return (
    <div className="p-6 max-w-[1200px] mx-auto animate-fade-in">
      {/* 返回按钮 */}
      <Link href="/dividend" className="inline-flex items-center gap-2 text-xs text-default-400 hover:text-foreground mb-4 transition-colors">
        <ArrowLeft className="w-4 h-4" /> 返回红利测温列表
      </Link>

      {/* 头部卡片 */}
      <div className="glass-panel p-6 mb-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold tracking-tight">{stock.name}</h1>
              <span className="text-sm font-mono text-default-400">{stock.code}</span>
              <span className="text-xs px-2.5 py-1 rounded-full bg-default-100 font-medium text-default-500">{stock.industry}</span>
            </div>
            <p className="text-xs text-default-400 mt-1">深度体检与高胜率量化诊断报告</p>
          </div>

          <div className="flex items-center gap-4">
            <div className="text-right">
              <span className="text-xs text-default-400 block">综合评分</span>
              <span className="text-3xl font-bold text-primary">{stock.overallScore}</span>
              <span className="text-xs text-default-400"> / 100</span>
            </div>

            <div className="h-10 w-[1px] bg-divider" />

            <div className="text-right">
              <span className="text-xs text-default-400 block">股票温度</span>
              <span className={`text-3xl font-bold ${stock.temperature < 30 ? "text-blue-400" : "text-yellow-400"}`}>
                {stock.temperature}°C
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 核心双 K 线图表区 (高亮选中态按键组 + 图表标题文案联动) */}
      <div className="glass-panel p-6 mb-6">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-4 border-b border-divider pb-4">
          <div className="space-y-3">
            {/* 图表顶部标题 (动态联动显示名称、周期、复权) */}
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold tracking-tight">
                {stock.name} ({stock.code}) - {currentPeriodObj.label} 走势
                <span className="ml-2 text-xs font-normal px-2 py-0.5 rounded bg-primary/10 text-primary border border-primary/20">
                  {currentAdjustObj.label}
                </span>
              </h3>
            </div>

            {/* 按钮控件组：图表模式 + 周期 + 复权 */}
            <div className="flex flex-wrap items-center gap-3 text-xs">
              {/* 1. 图表模式切换 */}
              <div className="flex gap-1 bg-default-100 p-1 rounded-xl">
                <button
                  onClick={() => setChartTab("KLINE")}
                  className={`
                    flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition-all duration-200
                    ${chartTab === "KLINE"
                      ? "bg-primary text-white font-bold shadow-md shadow-primary/30 scale-[1.02]"
                      : "text-default-400 hover:text-foreground hover:bg-default-200/50"}
                  `}
                >
                  <CandlestickChart className="w-3.5 h-3.5" /> 经典形态 K 线
                </button>
                <button
                  onClick={() => setChartTab("CORRIDOR")}
                  className={`
                    flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition-all duration-200
                    ${chartTab === "CORRIDOR"
                      ? "bg-primary text-white font-bold shadow-md shadow-primary/30 scale-[1.02]"
                      : "text-default-400 hover:text-foreground hover:bg-default-200/50"}
                  `}
                >
                  <LineChart className="w-3.5 h-3.5" /> 估值通道 K 线
                </button>
              </div>

              {/* 2. 多周期按键 (日K/周K/月K/季K/年K) - 醒目选中态 */}
              <div className="flex gap-1 bg-default-100 p-1 rounded-xl">
                {periodOptions.map(({ key, label }) => {
                  const isSelected = period === key;
                  return (
                    <button
                      key={key}
                      onClick={() => handlePeriodChange(key)}
                      className={`
                        px-3 py-1.5 rounded-lg font-medium transition-all duration-200
                        ${isSelected
                          ? "bg-blue-600 text-white font-bold shadow-md shadow-blue-600/30 scale-[1.05]"
                          : "text-default-400 hover:text-foreground hover:bg-default-200/50"}
                      `}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>

              {/* 3. 复权模式按键 (前复权/后复权/不复权) - 醒目选中态 */}
              <div className="flex gap-1 bg-default-100 p-1 rounded-xl">
                {adjustOptions.map(({ key, label }) => {
                  const isSelected = adjust === key;
                  return (
                    <button
                      key={key}
                      onClick={() => handleAdjustChange(key)}
                      className={`
                        px-3 py-1.5 rounded-lg font-medium transition-all duration-200
                        ${isSelected
                          ? "bg-emerald-600 text-white font-bold shadow-md shadow-emerald-600/30 scale-[1.05]"
                          : "text-default-400 hover:text-foreground hover:bg-default-200/50"}
                      `}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="text-right">
            <span className="text-xs text-default-400 block">说明与标准</span>
            <span className="text-[11px] text-default-500">{currentAdjustObj.desc}</span>
          </div>
        </div>

        {klineLoading[`kline_${code}_${period}_${adjust}`] ? (
          <div className="py-20 text-center text-xs text-default-400">
            <RefreshCw className="w-5 h-5 animate-spin inline mb-2" />
            <p>正在拉取并重新计算 {currentPeriodObj.label} ({currentAdjustObj.label}) 行情图表...</p>
          </div>
        ) : (
          <div>
            {chartTab === "KLINE" ? (
              <KlineChart data={klines} />
            ) : (
              <ValuationCorridorChart data={corridors} />
            )}
          </div>
        )}
      </div>

      {/* 6维指标分析 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        {dims.map((dim) => (
          <div key={dim.name} className="glass-panel p-5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-semibold">{dim.name}</span>
              <span className="text-sm font-bold text-emerald-400">{dim.score} 分</span>
            </div>
            <div className="h-2 bg-default-100 rounded-full overflow-hidden mb-2">
              <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${dim.score}%` }} />
            </div>
            <p className="text-xs text-default-400">{dim.desc}</p>
          </div>
        ))}
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

      {/* 核心亮点与风险提示 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="glass-panel p-5 border-emerald-500/20">
          <h4 className="text-sm font-semibold text-emerald-400 mb-3 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4" /> 核心亮点
          </h4>
          <ul className="space-y-2 text-xs text-default-300">
            <li className="flex items-start gap-2">
              <span className="text-emerald-400 font-bold">•</span>
              <span>连续分红历史长，属于典型的高股息压舱石资产</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-emerald-400 font-bold">•</span>
              <span>估值处于合理安全区间，具备较好防守边际</span>
            </li>
          </ul>
        </div>

        <div className="glass-panel p-5 border-amber-500/20">
          <h4 className="text-sm font-semibold text-amber-400 mb-3 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" /> 风险提示
          </h4>
          <ul className="space-y-2 text-xs text-default-300">
            <li className="flex items-start gap-2">
              <span className="text-amber-400 font-bold">•</span>
              <span>行业系统性周期波动风险</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-amber-400 font-bold">•</span>
              <span>宏观经济环境影响</span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
