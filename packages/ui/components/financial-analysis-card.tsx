"use client";

import React, { useState, useMemo } from "react";
import ReactECharts from "echarts-for-react";
import {
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  Coins,
  TrendingUp,
  Activity,
  Layers,
  Sparkles,
  CheckCircle2,
  Calendar,
  BarChart3,
  Award,
} from "lucide-react";
import type { FinancialAnalysisReport } from "@investscope/data/schemas";

import { SegmentedTabs } from "./segmented-tabs";

interface FinancialAnalysisCardProps {
  report: FinancialAnalysisReport | null;
  loading?: boolean;
}

export function FinancialAnalysisCard({ report, loading }: FinancialAnalysisCardProps) {
  const [activeTab, setActiveTab] = useState<"dividend" | "health" | "dupont" | "preview">("dividend");

  // 1. 日度历史动态股息率走势 ECharts (按天, 支持拖拽缩放 dataZoom)
  const dailyYieldOption = useMemo(() => {
    if (!report || !report.dividendCoverage.dailyYieldHistory) return {};
    const dates = report.dividendCoverage.dailyYieldHistory.map((d) => d.date);
    const yields = report.dividendCoverage.dailyYieldHistory.map((d) => d.dividendYield);
    const prices = report.dividendCoverage.dailyYieldHistory.map((d) => d.closePrice);

    return {
      animation: false,
      backgroundColor: "transparent",
      tooltip: {
        trigger: "axis",
        backgroundColor: "rgba(17,17,17,0.95)",
        borderColor: "rgba(255,255,255,0.15)",
        textStyle: { color: "#fff", fontSize: 12 },
        formatter: (params: any) => {
          const p0 = params[0];
          if (!p0) return "";
          const idx = p0.dataIndex;
          return `
            <div style="font-weight:bold;margin-bottom:4px;color:#fff">${p0.name}</div>
            <div style="display:flex;justify-content:space-between;gap:16px;font-size:11px">
              <span style="color:#34d399">日度动态股息率:</span>
              <span style="font-weight:bold;color:#34d399">${yields[idx]}%</span>
            </div>
            <div style="display:flex;justify-content:space-between;gap:16px;font-size:11px">
              <span style="color:#aaa">当日收盘价:</span>
              <span style="font-weight:bold;color:#fff">¥${prices[idx]}</span>
            </div>
          `;
        },
      },
      grid: { left: "4%", right: "4%", bottom: "18%", top: "12%", containLabel: true },
      dataZoom: [
        { type: "inside", start: 0, end: 100 },
        {
          type: "slider",
          show: true,
          start: 0,
          end: 100,
          bottom: 4,
          height: 18,
          borderColor: "rgba(255,255,255,0.1)",
          fillerColor: "rgba(16,185,129,0.15)",
          handleStyle: { color: "#10b981" },
          textStyle: { color: "#888", fontSize: 10 },
        },
      ],
      xAxis: {
        type: "category",
        data: dates,
        axisLine: { lineStyle: { color: "#444" } },
        axisLabel: { color: "#888", fontSize: 10 },
      },
      yAxis: {
        type: "value",
        name: "股息率 (%)",
        nameTextStyle: { color: "#777", fontSize: 10 },
        splitLine: { lineStyle: { color: "rgba(255,255,255,0.06)" } },
        axisLabel: { color: "#34d399", fontSize: 11 },
      },
      series: [
        {
          name: "动态股息率 (%)",
          type: "line",
          data: yields,
          smooth: true,
          showSymbol: false,
          lineStyle: { width: 2, color: "#10b981" },
          areaStyle: {
            color: {
              type: "linear",
              x: 0, y: 0, x2: 0, y2: 1,
              colorStops: [
                { offset: 0, color: "rgba(16,185,129,0.3)" },
                { offset: 1, color: "rgba(16,185,129,0.0)" },
              ],
            },
          },
        },
      ],
    };
  }, [report]);

  // 2. 历年现金分红 ECharts (按年, 支持拖拽缩放 dataZoom)
  const dividendOption = useMemo(() => {
    if (!report) return {};
    const years = report.dividendCoverage.history.map((h) => h.year);
    const dpsList = report.dividendCoverage.history.map((h) => h.dividendPerShare);
    const payoutList = report.dividendCoverage.history.map((h) => h.payoutRatio);

    return {
      animation: false,
      backgroundColor: "transparent",
      tooltip: {
        trigger: "axis",
        backgroundColor: "rgba(17,17,17,0.95)",
        borderColor: "rgba(255,255,255,0.15)",
        textStyle: { color: "#fff", fontSize: 12 },
      },
      legend: {
        data: ["每10股派现 (元)", "股利支付率 (%)"],
        textStyle: { color: "#999", fontSize: 11 },
        top: 0,
      },
      grid: { left: "4%", right: "4%", bottom: "18%", top: "16%", containLabel: true },
      dataZoom: [
        { type: "inside", start: 0, end: 100 },
        {
          type: "slider",
          show: true,
          start: 0,
          end: 100,
          bottom: 4,
          height: 18,
          borderColor: "rgba(255,255,255,0.1)",
          fillerColor: "rgba(59,130,246,0.15)",
          handleStyle: { color: "#3b82f6" },
          textStyle: { color: "#888", fontSize: 10 },
        },
      ],
      xAxis: {
        type: "category",
        data: years,
        axisLine: { lineStyle: { color: "#444" } },
        axisLabel: { color: "#888", fontSize: 11 },
      },
      yAxis: [
        {
          type: "value",
          name: "派现 (元)",
          nameTextStyle: { color: "#777", fontSize: 10 },
          splitLine: { lineStyle: { color: "rgba(255,255,255,0.06)" } },
          axisLabel: { color: "#888", fontSize: 11 },
        },
        {
          type: "value",
          name: "支付率 (%)",
          nameTextStyle: { color: "#777", fontSize: 10 },
          splitLine: { show: false },
          axisLabel: { color: "#888", fontSize: 11 },
        },
      ],
      series: [
        {
          name: "每10股派现 (元)",
          type: "bar",
          data: dpsList,
          barMaxWidth: 24,
          itemStyle: { color: "#3b82f6" },
        },
        {
          name: "股利支付率 (%)",
          type: "line",
          yAxisIndex: 1,
          data: payoutList,
          smooth: true,
          showSymbol: true,
          lineStyle: { width: 2, color: "#f59e0b" },
          itemStyle: { color: "#f59e0b" },
        },
      ],
    };
  }, [report]);

  // 3. 财务三大表趋势 ECharts
  const healthTrendsOption = useMemo(() => {
    if (!report) return {};
    const years = report.healthScan.trends.map((t) => t.year);
    const revs = report.healthScan.trends.map((t) => t.revenue);
    const profits = report.healthScan.trends.map((t) => t.netProfit);
    const cashs = report.healthScan.trends.map((t) => t.operatingCashFlow);

    return {
      animation: false,
      backgroundColor: "transparent",
      tooltip: {
        trigger: "axis",
        backgroundColor: "rgba(17,17,17,0.95)",
        borderColor: "rgba(255,255,255,0.15)",
        textStyle: { color: "#fff", fontSize: 12 },
      },
      legend: {
        data: ["营业收入 (亿)", "归母净利润 (亿)", "经营现金流 (亿)"],
        textStyle: { color: "#999", fontSize: 11 },
        top: 0,
      },
      grid: { left: "5%", right: "5%", bottom: "10%", top: "18%", containLabel: true },
      xAxis: {
        type: "category",
        data: years,
        axisLine: { lineStyle: { color: "#444" } },
        axisLabel: { color: "#888", fontSize: 11 },
      },
      yAxis: {
        type: "value",
        splitLine: { lineStyle: { color: "rgba(255,255,255,0.06)" } },
        axisLabel: { color: "#888", fontSize: 11 },
      },
      series: [
        {
          name: "营业收入 (亿)",
          type: "bar",
          data: revs,
          barMaxWidth: 18,
          itemStyle: { color: "#3b82f6" },
        },
        {
          name: "归母净利润 (亿)",
          type: "line",
          data: profits,
          smooth: true,
          lineStyle: { width: 2, color: "#ef4444" },
          itemStyle: { color: "#ef4444" },
        },
        {
          name: "经营现金流 (亿)",
          type: "line",
          data: cashs,
          smooth: true,
          lineStyle: { width: 2, color: "#22c55e", type: "dashed" },
          itemStyle: { color: "#22c55e" },
        },
      ],
    };
  }, [report]);

  if (loading && !report) {
    return (
      <div className="glass-panel p-8 mb-6 text-center text-xs text-default-400">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p>正在深度分析财报数据、计算现金流覆盖率与排雷指标...</p>
      </div>
    );
  }

  if (!report) {
    return null;
  }

  const { dividendCoverage, healthScan, dupont, earningsPreview } = report;

  return (
    <div className="glass-panel p-6 mb-6">
      {/* 头部标题与 Segmented Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-divider/60 pb-4 mb-5">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-xl bg-primary/10 text-primary">
            <BarChart3 className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold tracking-tight">财报深度分析与体检报告</h3>
            <p className="text-[11px] text-default-400">现金流覆盖率 • 四大排雷扫描 • 杜邦分析 • 业绩前瞻</p>
          </div>
        </div>

        {/* 统一风格的分段 Tab 控制栏 (与日 K 线 Tabs 体验完全一致) */}
        <SegmentedTabs
          items={[
            { key: "dividend", label: "分红与现金流", icon: <Coins className="w-3.5 h-3.5" /> },
            { key: "health", label: "财务排雷雷达", icon: <ShieldCheck className="w-3.5 h-3.5" /> },
            { key: "dupont", label: "杜邦分析拆解", icon: <Layers className="w-3.5 h-3.5" /> },
            { key: "preview", label: "财报前瞻预估", icon: <Sparkles className="w-3.5 h-3.5" /> },
          ]}
          value={activeTab}
          onChange={(val) => setActiveTab(val as any)}
        />
      </div>

      {/* ─── TAB 1: 💰 分红历史与现金流覆盖率 ────────────────────────────────────── */}
      {activeTab === "dividend" && (
        <div className="space-y-6 animate-fade-in">
          {/* 指标面板 */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 rounded-xl bg-default-100/40 border border-divider/40">
              <span className="text-xs text-default-400 block mb-1">现金流分红覆盖率</span>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold font-mono text-primary">{dividendCoverage.coverageRatio}%</span>
                <span className="text-[11px] text-emerald-400 font-medium">真金白银覆盖</span>
              </div>
              <span className="text-[10px] text-default-400 block mt-1">自由现金流 {dividendCoverage.freeCashFlow} 亿 / 分红 {dividendCoverage.totalDividends} 亿</span>
            </div>

            <div className="p-4 rounded-xl bg-default-100/40 border border-divider/40">
              <span className="text-xs text-default-400 block mb-1">股利支付率 (Payout Ratio)</span>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold font-mono text-foreground">{dividendCoverage.payoutRatio}%</span>
                <span className="text-[11px] text-default-400">占当期利润比例</span>
              </div>
              <span className="text-[10px] text-default-400 block mt-1">处于 30%~70% 健康分红分配区间</span>
            </div>

            <div className="p-4 rounded-xl bg-default-100/40 border border-divider/40">
              <span className="text-xs text-default-400 block mb-1">连续现金分红记录</span>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold font-mono text-emerald-400">{dividendCoverage.consecutiveYears} 年</span>
                <span className="text-[11px] text-emerald-500/80 font-medium">长青收息股</span>
              </div>
              <span className="text-[10px] text-default-400 block mt-1">长期尊重股东回报，历史稳健</span>
            </div>
          </div>

          {/* 状态 Alert 提示盒 */}
          <div
            className={`p-3.5 rounded-xl border text-xs flex items-start gap-3 ${
              dividendCoverage.status === "HEALTHY"
                ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                : dividendCoverage.status === "WARNING"
                ? "bg-yellow-500/10 border-yellow-500/20 text-yellow-400"
                : "bg-red-500/10 border-red-500/20 text-red-400"
            }`}
          >
            <ShieldCheck className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <div>
              <strong className="font-semibold block mb-0.5">分红质量诊断:</strong>
              <p>{dividendCoverage.message}</p>
            </div>
          </div>

          {/* 独立图表 1：日度历史动态股息率走势 (按天粒度, 拖拽缩放 dataZoom) */}
          {dividendCoverage.dailyYieldHistory && dividendCoverage.dailyYieldHistory.length > 0 && (
            <div className="p-4 rounded-2xl bg-default-50/50 border border-divider/40">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <h4 className="text-xs font-bold text-foreground">📅 历史日度动态股息率走势 (按天, 可左右滑动与拖拽缩放)</h4>
                </div>
                <span className="text-[11px] text-default-400 font-mono">
                  支持像 K 线一样拖动滑块查看任意区间
                </span>
              </div>
              <ReactECharts option={dailyYieldOption} style={{ height: "260px", width: "100%" }} />
            </div>
          )}

          {/* 独立图表 2：历年现金分红派息金额与支付率 (按年粒度, 拖拽缩放 dataZoom) */}
          <div className="p-4 rounded-2xl bg-default-50/50 border border-divider/40">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-blue-400" />
                <h4 className="text-xs font-bold text-foreground">💰 历年现金分红金额与支付率 (按年, 可拖拽缩放)</h4>
              </div>
              <span className="text-[11px] text-default-400">
                每 10 股派现金额 vs 股利支付率
              </span>
            </div>
            <ReactECharts option={dividendOption} style={{ height: "260px", width: "100%" }} />
          </div>
        </div>
      )}

      {/* ─── TAB 2: 🛡️ 财务排雷雷达 ────────────────────────────────────────── */}
      {activeTab === "health" && (
        <div className="space-y-5 animate-fade-in">
          {/* 4 大扫描卡片 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {healthScan.items.map((item) => {
              const isPass = item.status === "PASS";
              const isWarn = item.status === "WARNING";
              return (
                <div
                  key={item.key}
                  className={`p-4 rounded-xl border transition-all ${
                    isPass
                      ? "bg-emerald-500/5 border-emerald-500/20"
                      : isWarn
                      ? "bg-yellow-500/5 border-yellow-500/20"
                      : "bg-red-500/5 border-red-500/20"
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-semibold text-foreground flex items-center gap-2">
                      {isPass ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      ) : isWarn ? (
                        <AlertTriangle className="w-4 h-4 text-yellow-400" />
                      ) : (
                        <ShieldAlert className="w-4 h-4 text-red-400" />
                      )}
                      {item.name}
                    </span>
                    <span
                      className={`text-xs font-mono font-bold px-2 py-0.5 rounded ${
                        isPass ? "bg-emerald-500/10 text-emerald-400" : isWarn ? "bg-yellow-500/10 text-yellow-400" : "bg-red-500/10 text-red-400"
                      }`}
                    >
                      {item.valueStr}
                    </span>
                  </div>
                  <p className="text-[11px] text-default-400 leading-relaxed">{item.detail}</p>
                </div>
              );
            })}
          </div>

          {/* 趋势图 */}
          <div className="pt-2">
            <h4 className="text-xs font-semibold text-default-400 mb-2">近 5 年营收、归母净利润与经营现金流对照</h4>
            <ReactECharts option={healthTrendsOption} style={{ height: "260px", width: "100%" }} />
          </div>
        </div>
      )}

      {/* ─── TAB 3: 🌳 杜邦分析拆解 ────────────────────────────────────────── */}
      {activeTab === "dupont" && (
        <div className="space-y-5 animate-fade-in">
          {/* 商业模式标签卡 */}
          <div className="p-4 rounded-xl bg-primary/10 border border-primary/20 flex flex-wrap items-center justify-between gap-4">
            <div>
              <span className="text-xs text-primary font-medium block mb-0.5">商业模式自动判定</span>
              <h4 className="text-lg font-bold text-foreground">{dupont.businessTypeLabel}</h4>
              <p className="text-xs text-default-400 mt-1">{dupont.description}</p>
            </div>
            <div className="text-right">
              <span className="text-xs text-default-400 block">净资产收益率 (ROE)</span>
              <span className="text-3xl font-bold font-mono text-primary">{dupont.roe}%</span>
            </div>
          </div>

          {/* 树状拆解卡片 */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 rounded-xl bg-default-100/40 border border-divider/40 text-center">
              <span className="text-xs text-default-400 block mb-1">销售净利率 (Profit Margin)</span>
              <span className="text-2xl font-bold font-mono text-red-400">{dupont.netProfitMargin}%</span>
              <span className="text-[10px] text-default-400 block mt-1">反映产品溢价与高毛利护城河</span>
            </div>

            <div className="p-4 rounded-xl bg-default-100/40 border border-divider/40 text-center">
              <span className="text-xs text-default-400 block mb-1">资产周转率 (Asset Turnover)</span>
              <span className="text-2xl font-bold font-mono text-amber-400">{dupont.assetTurnover} 次</span>
              <span className="text-[10px] text-default-400 block mt-1">反映资产管理效率与现金回笼</span>
            </div>

            <div className="p-4 rounded-xl bg-default-100/40 border border-divider/40 text-center">
              <span className="text-xs text-default-400 block mb-1">权益乘数 (Equity Multiplier)</span>
              <span className="text-2xl font-bold font-mono text-blue-400">{dupont.equityMultiplier} 倍</span>
              <span className="text-[10px] text-default-400 block mt-1">反映资本杠杆与债务扩张程度</span>
            </div>
          </div>

          {/* 历史 ROE 拆解数据明细 */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-divider/60 text-default-400">
                  <th className="py-2 px-3">年份</th>
                  <th className="py-2 px-3">ROE 净资产收益率</th>
                  <th className="py-2 px-3">销售净利率</th>
                  <th className="py-2 px-3">资产周转率</th>
                  <th className="py-2 px-3">权益乘数</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-divider/30 font-mono">
                {dupont.history.map((h) => (
                  <tr key={h.year} className="hover:bg-default-100/30">
                    <td className="py-2.5 px-3 font-sans font-medium text-foreground">{h.year}</td>
                    <td className="py-2.5 px-3 font-bold text-primary">{h.roe}%</td>
                    <td className="py-2.5 px-3 text-red-400">{h.netProfitMargin}%</td>
                    <td className="py-2.5 px-3 text-amber-400">{h.assetTurnover}次</td>
                    <td className="py-2.5 px-3 text-blue-400">{h.equityMultiplier}倍</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ─── TAB 4: 🔮 财报前瞻与预估 ────────────────────────────────────────── */}
      {activeTab === "preview" && (
        <div className="space-y-5 animate-fade-in">
          {/* 披露倒计时与评价概览 */}
          <div className="p-4 rounded-xl bg-default-100/50 border border-divider/60 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-400">
                <Calendar className="w-5 h-5" />
              </div>
              <div>
                <span className="text-xs text-default-400 block">{earningsPreview.nextReportName}</span>
                <span className="text-sm font-bold text-foreground">
                  预计披露日期: {earningsPreview.disclosureDate || "待定"}
                </span>
              </div>
            </div>

            {earningsPreview.daysToDisclosure !== null && (
              <div className="px-3 py-1.5 rounded-xl bg-primary/10 text-primary border border-primary/20 text-xs font-bold font-mono">
                距披露还有 {earningsPreview.daysToDisclosure} 天
              </div>
            )}
          </div>

          {/* 官方预告区间与卖方分析师预测 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* 官方业绩预告 */}
            <div className="p-4 rounded-xl bg-default-100/40 border border-divider/40 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-default-400">官方业绩预告</span>
                <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  {earningsPreview.officialNotice?.type || "最新公告"}
                </span>
              </div>
              <p className="text-sm font-bold text-foreground">{earningsPreview.officialNotice?.netProfitRange}</p>
              <span className="text-[11px] text-default-400 block">预估同比变动: {earningsPreview.officialNotice?.changePctRange}</span>
            </div>

            {/* 券商卖方一致预期 */}
            <div className="p-4 rounded-xl bg-default-100/40 border border-divider/40 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-default-400">券商卖方一致预期 (Consensus)</span>
                <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-primary/10 text-primary border border-primary/20">
                  {earningsPreview.consensus?.analystCount} 家机构覆盖
                </span>
              </div>
              <p className="text-sm font-bold font-mono text-primary">
                机构预测中位数: {earningsPreview.consensus?.predictedProfit} 亿元
              </p>
              <span className="text-[11px] text-emerald-400 block">
                近1月预测变动: 上调 +{earningsPreview.consensus?.changePct}% (机构看好)
              </span>
            </div>
          </div>

          {/* 总结分析 */}
          <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-400 flex items-start gap-2.5">
            <Sparkles className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <div>
              <strong className="font-semibold block mb-0.5">财报前瞻诊断小结:</strong>
              <p className="text-emerald-300/90 leading-relaxed">{earningsPreview.summary}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
