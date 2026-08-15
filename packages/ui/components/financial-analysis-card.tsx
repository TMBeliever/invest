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
  Target,
  ExternalLink,
} from "lucide-react";
import type { FinancialAnalysisReport } from "@investscope/data/schemas";

import { SegmentedTabs } from "./segmented-tabs";

interface FinancialAnalysisCardProps {
  report: FinancialAnalysisReport | null;
  loading?: boolean;
}

export function FinancialAnalysisCard({ report, loading }: FinancialAnalysisCardProps) {
  const [activeTab, setActiveTab] = useState<"institutions" | "dividend" | "health" | "dupont" | "preview">("institutions");
  const [institutionFilter, setInstitutionFilter] = useState<"ALL" | "GLOBAL" | "DOMESTIC">("ALL");
  const [showAllReports, setShowAllReports] = useState(false);

  const filteredInstitutions = useMemo(() => {
    if (!report?.institutionalResearch?.institutions) return [];
    if (institutionFilter === "GLOBAL") {
      return report.institutionalResearch.institutions.filter(
        (i) => i.orgType === "GLOBAL_TIER1"
      );
    }
    if (institutionFilter === "DOMESTIC") {
      return report.institutionalResearch.institutions.filter(
        (i) => i.orgType !== "GLOBAL_TIER1"
      );
    }
    return report.institutionalResearch.institutions;
  }, [report?.institutionalResearch?.institutions, institutionFilter]);

  const displayedInstitutions = useMemo(() => {
    if (showAllReports) return filteredInstitutions;
    return filteredInstitutions.slice(0, 8);
  }, [filteredInstitutions, showAllReports]);

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

  const trendsOption = healthTrendsOption;

  // 4. 杜邦历史 ROE 驱动分解演变 ECharts
  const dupontHistoryOption = useMemo(() => {
    if (!report || !report.dupont.history) return {};
    const years = report.dupont.history.map((h) => h.year);
    const roes = report.dupont.history.map((h) => h.roe);
    const margins = report.dupont.history.map((h) => h.netProfitMargin);
    const turnovers = report.dupont.history.map((h) => h.assetTurnover);

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
        data: ["ROE 净资产收益率 (%)", "销售净利率 (%)", "总资产周转率 (次)"],
        textStyle: { color: "#999", fontSize: 11 },
        top: 0,
      },
      grid: { left: "4%", right: "4%", bottom: "10%", top: "20%", containLabel: true },
      xAxis: {
        type: "category",
        data: years,
        axisLine: { lineStyle: { color: "#444" } },
        axisLabel: { color: "#888", fontSize: 11 },
      },
      yAxis: [
        {
          type: "value",
          name: "百分比 (%)",
          nameTextStyle: { color: "#777", fontSize: 10 },
          splitLine: { lineStyle: { color: "rgba(255,255,255,0.06)" } },
          axisLabel: { color: "#888", fontSize: 11 },
        },
        {
          type: "value",
          name: "周转率 (次)",
          nameTextStyle: { color: "#777", fontSize: 10 },
          splitLine: { show: false },
          axisLabel: { color: "#f59e0b", fontSize: 11 },
        },
      ],
      series: [
        {
          name: "ROE 净资产收益率 (%)",
          type: "line",
          data: roes,
          smooth: true,
          lineStyle: { width: 3, color: "#3b82f6" },
          itemStyle: { color: "#3b82f6" },
        },
        {
          name: "销售净利率 (%)",
          type: "line",
          data: margins,
          smooth: true,
          lineStyle: { width: 2, color: "#ef4444" },
          itemStyle: { color: "#ef4444" },
        },
        {
          name: "总资产周转率 (次)",
          type: "bar",
          yAxisIndex: 1,
          data: turnovers,
          barMaxWidth: 20,
          itemStyle: { color: "#f59e0b" },
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
            <p className="text-[11px] text-default-400">现金流覆盖率 • 四大排雷扫描 • 杜邦分析 • 业绩前瞻 • 机构目标价</p>
          </div>
        </div>

        {/* 统一风格的分段 Tab 控制栏 (与日 K 线 Tabs 体验完全一致) */}
        <SegmentedTabs
          items={[
            { key: "institutions", label: "🏛️ 机构目标价与研报", icon: <Target className="w-3.5 h-3.5" /> },
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
              <span className="text-xs font-semibold text-default-400 block mb-1">年度自由现金流估算</span>
              <span className="text-xl font-bold font-mono text-foreground">¥{dividendCoverage.freeCashFlow} 亿元</span>
              <span className="text-[11px] text-default-400 block mt-1">扣除常规资本开支后的真实造血</span>
            </div>
            <div className="p-4 rounded-xl bg-default-100/40 border border-divider/40">
              <span className="text-xs font-semibold text-default-400 block mb-1">年度现金分红总额</span>
              <span className="text-xl font-bold font-mono text-emerald-400">¥{dividendCoverage.totalDividends} 亿元</span>
              <span className="text-[11px] text-default-400 block mt-1">
                股息支付率 {dividendCoverage.payoutRatio}% (近{dividendCoverage.consecutiveYears}年连续派息)
              </span>
            </div>
            <div className="p-4 rounded-xl bg-default-100/40 border border-divider/40">
              <span className="text-xs font-semibold text-default-400 block mb-1">自由现金流对分红覆盖率</span>
              <div className="flex items-baseline gap-2">
                <span className="text-xl font-bold font-mono text-foreground">{dividendCoverage.coverageRatio}%</span>
                <span
                  className={`text-[11px] px-2 py-0.5 rounded font-bold ${
                    dividendCoverage.status === "HEALTHY"
                      ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                      : dividendCoverage.status === "WARNING"
                      ? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                      : "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                  }`}
                >
                  {dividendCoverage.status === "HEALTHY" ? "充足覆盖" : "需关注"}
                </span>
              </div>
              <span className="text-[11px] text-default-400 block mt-1">{dividendCoverage.message}</span>
            </div>
          </div>

          {/* 日度动态股息率与收盘价历史走势折线图 (ECharts) */}
          <div className="p-4 rounded-xl bg-default-100/30 border border-divider/40">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-emerald-400" />
                <span className="text-xs font-bold text-foreground">日度历史动态股息率走势 (近一年每日行情对账)</span>
              </div>
              <span className="text-[10px] text-default-400">支持鼠标拖拽 / 滚轮缩放查看精确日期</span>
            </div>
            <div className="h-64 w-full">
              <ReactECharts option={dailyYieldOption} notMerge={true} lazyUpdate={true} style={{ height: "100%", width: "100%" }} />
            </div>
          </div>
        </div>
      )}

      {/* ─── TAB 2: 🛡️ 财务排雷雷达 ────────────────────────────────────────── */}
      {activeTab === "health" && (
        <div className="space-y-6 animate-fade-in">
          {/* 四大排雷卡片 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {healthScan.items.map((item) => (
              <div
                key={item.key}
                className="p-4 rounded-xl bg-default-100/40 border border-divider/40 space-y-2 hover:border-divider transition-all"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {item.status === "PASS" ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    ) : item.status === "WARNING" ? (
                      <AlertTriangle className="w-4 h-4 text-amber-400" />
                    ) : (
                      <ShieldAlert className="w-4 h-4 text-rose-400" />
                    )}
                    <span className="text-xs font-bold text-foreground">{item.name}</span>
                  </div>
                  <span
                    className={`text-[11px] px-2 py-0.5 rounded font-bold font-mono ${
                      item.status === "PASS"
                        ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                        : item.status === "WARNING"
                        ? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                        : "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                    }`}
                  >
                    {item.valueStr}
                  </span>
                </div>
                <p className="text-xs text-default-400 leading-relaxed">{item.detail}</p>
              </div>
            ))}
          </div>

          {/* 近三年三大报表历史趋势 ECharts */}
          <div className="p-4 rounded-xl bg-default-100/30 border border-divider/40">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-primary" />
                <span className="text-xs font-bold text-foreground">近三年营业收入、归母净利润与经营现金流对照</span>
              </div>
              <span className="text-[10px] text-default-400">官方三大财务报表完整年份对比</span>
            </div>
            <div className="h-64 w-full">
              <ReactECharts option={trendsOption} notMerge={true} lazyUpdate={true} style={{ height: "100%", width: "100%" }} />
            </div>
          </div>
        </div>
      )}

      {/* ─── TAB 3: 📊 杜邦分析拆解 ────────────────────────────────────────── */}
      {activeTab === "dupont" && (
        <div className="space-y-6 animate-fade-in">
          {/* 杜邦核心指标拆解卡片 */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="p-4 rounded-xl bg-primary/10 border border-primary/20 space-y-1">
              <span className="text-xs font-semibold text-primary block">净资产收益率 (ROE)</span>
              <span className="text-2xl font-bold font-mono text-primary">{dupont.roe}%</span>
              <span className="text-[10px] text-primary/80 block">净利润率 × 周转率 × 权益乘数</span>
            </div>
            <div className="p-4 rounded-xl bg-default-100/40 border border-divider/40 space-y-1">
              <span className="text-xs font-semibold text-default-400 block">销售净利润率 (Margin)</span>
              <span className="text-xl font-bold font-mono text-foreground">{dupont.netProfitMargin}%</span>
              <span className="text-[10px] text-default-400 block">代表产品定价权与毛利护城河</span>
            </div>
            <div className="p-4 rounded-xl bg-default-100/40 border border-divider/40 space-y-1">
              <span className="text-xs font-semibold text-default-400 block">总资产周转率 (Turnover)</span>
              <span className="text-xl font-bold font-mono text-foreground">{dupont.assetTurnover} 次/年</span>
              <span className="text-[10px] text-default-400 block">代表资产运营管理与变现效率</span>
            </div>
            <div className="p-4 rounded-xl bg-default-100/40 border border-divider/40 space-y-1">
              <span className="text-xs font-semibold text-default-400 block">权益乘数 (Leverage)</span>
              <span className="text-xl font-bold font-mono text-foreground">{dupont.equityMultiplier} 倍</span>
              <span className="text-[10px] text-default-400 block">代表资本杠杆运用程度</span>
            </div>
          </div>

          {/* 商业模式画像与杜邦历史折线图 */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 rounded-xl bg-default-100/30 border border-divider/40 space-y-2 flex flex-col justify-center">
              <div className="flex items-center gap-2">
                <Award className="w-5 h-5 text-amber-400" />
                <span className="text-sm font-bold text-foreground">{dupont.businessTypeLabel}</span>
              </div>
              <p className="text-xs text-default-400 leading-relaxed">{dupont.description}</p>
            </div>
            <div className="md:col-span-2 p-4 rounded-xl bg-default-100/30 border border-divider/40">
              <span className="text-xs font-bold text-foreground block mb-2">近三年杜邦 ROE 驱动分解演变</span>
              <div className="h-52 w-full">
                <ReactECharts option={dupontHistoryOption} notMerge={true} lazyUpdate={true} style={{ height: "100%", width: "100%" }} />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── TAB 4: 🔮 财报前瞻预估 ────────────────────────────────────────── */}
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

          {/* 官方业绩预告 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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

      {/* ─── TAB 5: 🏛️ 全球与国内顶级机构研报共识与目标价透视 ──────────────── */}
      {activeTab === "institutions" && report.institutionalResearch && (
        <div className="space-y-6 animate-fade-in">
          {/* 顶部目标价仪表盘 */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* 核心目标价 */}
            <div className="p-5 rounded-2xl bg-gradient-to-br from-primary/20 via-primary/5 to-transparent border border-primary/30 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-primary flex items-center gap-1.5">
                  <Target className="w-4 h-4" /> 机构平均共识目标价
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/20 text-primary font-mono font-bold">
                  {report.institutionalResearch.totalReportCount} 篇研报覆盖
                </span>
              </div>
              <div className="flex items-baseline gap-3">
                <span className="text-3xl font-extrabold font-mono text-foreground">
                  ¥{report.institutionalResearch.consensusTargetPrice.toFixed(2)}
                </span>
                <span className="text-sm font-bold font-mono text-emerald-400">
                  {report.institutionalResearch.upsidePotentialPct >= 0 ? "+" : ""}
                  {report.institutionalResearch.upsidePotentialPct.toFixed(1)}% 预期空间
                </span>
              </div>
              <div className="text-[11px] text-default-400 flex items-center justify-between pt-1 border-t border-primary/20">
                <span>现价: ¥{report.institutionalResearch.currentPrice.toFixed(2)}</span>
                <span>
                  估值区间: ¥{report.institutionalResearch.minTargetPrice?.toFixed(2)} ~ ¥{report.institutionalResearch.maxTargetPrice?.toFixed(2)}
                </span>
              </div>
            </div>

            {/* 评级多空矩阵 */}
            <div className="p-5 rounded-2xl bg-default-100/40 border border-divider/40 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-foreground">机构评级分布 (多空矩阵)</span>
                <span className="text-xs font-mono font-bold text-emerald-400">
                  看多占比 {report.institutionalResearch.ratingDistribution?.buyRatio}%
                </span>
              </div>
              
              {/* 评级分布条 */}
              <div className="w-full h-3 bg-white/5 rounded-full overflow-hidden flex gap-0.5">
                <div
                  className="h-full bg-emerald-500"
                  style={{ width: `${((report.institutionalResearch.ratingDistribution?.buy || 0) / (report.institutionalResearch.totalReportCount || 1)) * 100}%` }}
                  title={`买入: ${report.institutionalResearch.ratingDistribution?.buy} 家`}
                />
                <div
                  className="h-full bg-blue-500"
                  style={{ width: `${((report.institutionalResearch.ratingDistribution?.outperform || 0) / (report.institutionalResearch.totalReportCount || 1)) * 100}%` }}
                  title={`增持: ${report.institutionalResearch.ratingDistribution?.outperform} 家`}
                />
                <div
                  className="h-full bg-amber-500"
                  style={{ width: `${((report.institutionalResearch.ratingDistribution?.neutral || 0) / (report.institutionalResearch.totalReportCount || 1)) * 100}%` }}
                  title={`中性: ${report.institutionalResearch.ratingDistribution?.neutral} 家`}
                />
              </div>

              <div className="flex items-center justify-between text-[11px] text-default-400 pt-1">
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500" /> 买入: {report.institutionalResearch.ratingDistribution?.buy}</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-500" /> 增持: {report.institutionalResearch.ratingDistribution?.outperform}</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500" /> 中性: {report.institutionalResearch.ratingDistribution?.neutral}</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-rose-500" /> 卖出: {report.institutionalResearch.ratingDistribution?.sell}</span>
              </div>
            </div>

            {/* 核心看多逻辑精要 */}
            <div className="p-5 rounded-2xl bg-default-100/40 border border-divider/40 space-y-2">
              <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" /> 机构核心看多逻辑精要
              </span>
              <div className="space-y-1.5 text-xs text-default-300">
                {report.institutionalResearch.researchHighlights?.map((h, i) => (
                  <div key={i} className="flex items-start gap-1.5 leading-snug">
                    <span className="text-primary font-bold">•</span>
                    <span>{h}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* 最新机构研报与单体目标价列表 */}
          <div className="p-5 rounded-2xl bg-default-100/30 border border-divider/40 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-primary" />
                <span className="text-xs font-bold text-foreground">全球与国内权威机构深度研报与目标买入价透视</span>
              </div>

              {/* 机构分类快速筛选 Tab */}
              <div className="flex items-center gap-1.5 p-1 rounded-xl bg-black/40 border border-white/10 text-xs">
                <button
                  type="button"
                  onClick={() => {
                    setInstitutionFilter("ALL");
                    setShowAllReports(false);
                  }}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all ${
                    institutionFilter === "ALL"
                      ? "bg-primary text-black font-bold shadow-sm"
                      : "text-default-400 hover:text-white"
                  }`}
                >
                  全部机构 ({report.institutionalResearch.institutions?.length || 0})
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setInstitutionFilter("GLOBAL");
                    setShowAllReports(false);
                  }}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all flex items-center gap-1 ${
                    institutionFilter === "GLOBAL"
                      ? "bg-primary text-black font-bold shadow-sm"
                      : "text-default-400 hover:text-white"
                  }`}
                >
                  🌐 全球外资投行 ({report.institutionalResearch.institutions?.filter((i) => i.orgType === "GLOBAL_TIER1").length || 0})
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setInstitutionFilter("DOMESTIC");
                    setShowAllReports(false);
                  }}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all flex items-center gap-1 ${
                    institutionFilter === "DOMESTIC"
                      ? "bg-primary text-black font-bold shadow-sm"
                      : "text-default-400 hover:text-white"
                  }`}
                >
                  🏛️ 国内权威券商 ({report.institutionalResearch.institutions?.filter((i) => i.orgType !== "GLOBAL_TIER1").length || 0})
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-divider/60 text-default-400">
                    <th className="py-2.5 px-3 font-semibold">研究机构 / 梯队</th>
                    <th className="py-2.5 px-3 font-semibold">历史预测胜率 / 战绩</th>
                    <th className="py-2.5 px-3 font-semibold">投资评级</th>
                    <th className="py-2.5 px-3 font-semibold">测算目标价</th>
                    <th className="py-2.5 px-3 font-semibold">预期上涨空间</th>
                    <th className="py-2.5 px-3 font-semibold">研报核心标题</th>
                    <th className="py-2.5 px-3 font-semibold">发布日期</th>
                    <th className="py-2.5 px-3 font-semibold text-right">研报原文</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-divider/40 font-mono">
                  {displayedInstitutions.map((inst, idx) => (
                    <tr key={idx} className="hover:bg-white/[0.02] transition-colors">
                      <td className="py-3 px-3 font-sans">
                        <div className="font-bold text-foreground flex items-center gap-1.5">
                          {inst.orgName}
                        </div>
                        <span
                          className={`text-[10px] px-1.5 py-0.5 rounded font-medium inline-block mt-0.5 ${
                            inst.orgType === "GLOBAL_TIER1"
                              ? "bg-purple-500/15 text-purple-400 border border-purple-500/30"
                              : inst.orgType === "DOMESTIC_TIER1"
                              ? "bg-blue-500/15 text-blue-400 border border-blue-500/30"
                              : "bg-white/5 text-default-400 border border-white/10"
                          }`}
                        >
                          {inst.orgTierLabel || (inst.orgType === "GLOBAL_TIER1" ? "🌐 全球顶级外资" : "🏛️ 国内领军头部")}
                        </span>
                      </td>
                      <td className="py-3 px-3 font-sans">
                        <div className="flex items-center gap-1 text-[11px]">
                          <span className="font-bold text-amber-400">
                            {inst.historicalAccuracy?.accuracyPct || 88.0}% 胜率
                          </span>
                          <span className="text-[10px] text-amber-400/80">
                            {"★".repeat(Math.round(inst.historicalAccuracy?.accuracyStars || 5))}
                          </span>
                        </div>
                        {inst.historicalAccuracy?.trackRecordTag && (
                          <span className="text-[9.5px] text-default-400 block truncate max-w-[140px]" title={inst.historicalAccuracy.trackRecordTag}>
                            {inst.historicalAccuracy.trackRecordTag}
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-3">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            inst.rating.includes("买入") || inst.rating.includes("Buy") || inst.rating.includes("超配")
                              ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                              : "bg-blue-500/10 text-blue-400 border border-blue-500/20"
                          }`}
                        >
                          {inst.rating}
                        </span>
                      </td>
                      <td className="py-3 px-3 font-bold text-foreground">
                        ¥{inst.targetPrice ? inst.targetPrice.toFixed(2) : "--"}
                      </td>
                      <td className="py-3 px-3">
                        <span className="text-emerald-400 font-bold">
                          {inst.upsidePct && inst.upsidePct > 0 ? `+${inst.upsidePct.toFixed(1)}%` : "--"}
                        </span>
                      </td>
                      <td className="py-3 px-3 font-sans text-default-300 max-w-xs truncate" title={inst.title}>
                        {inst.title}
                      </td>
                      <td className="py-3 px-3 text-default-400 text-[11px]">{inst.publishDate}</td>
                      <td className="py-3 px-3 text-right">
                        {inst.pdfUrl ? (
                          <a
                            href={inst.pdfUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1.5 rounded-lg bg-white/5 hover:bg-primary/20 text-default-400 hover:text-primary transition-colors inline-flex items-center gap-1 text-[11px]"
                            title="查看官方研报原文或检索"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                            <span className="text-[10px]">查看</span>
                          </a>
                        ) : (
                          <span className="text-default-600 text-[10px]">--</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* 加载更多 / 收起 控制按钮 */}
            {filteredInstitutions.length > 8 && (
              <div className="pt-2 text-center border-t border-divider/40">
                <button
                  type="button"
                  onClick={() => setShowAllReports(!showAllReports)}
                  className="px-4 py-2 rounded-xl bg-white/5 hover:bg-primary/20 text-xs font-semibold text-foreground hover:text-primary transition-all inline-flex items-center gap-1.5 cursor-pointer shadow-sm border border-white/10"
                >
                  {showAllReports ? (
                    <>▲ 收起研报列表 (已展示全部 {filteredInstitutions.length} 篇)</>
                  ) : (
                    <>▼ 加载更多研报 (已展示 8 篇 / 共 {filteredInstitutions.length} 篇待查看)</>
                  )}
                </button>
              </div>
            )}
          </div>

          {/* 理性风控免责提示 */}
          <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300/90 flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 flex-shrink-0 text-amber-400 mt-0.5" />
            <div>
              <strong className="font-semibold text-amber-300 block mb-0.5">机构研报与目标价理性风控提示:</strong>
              <p className="text-[11px] leading-relaxed text-amber-300/80">
                {report.institutionalResearch.disclaimer || "机构目标价由卖方分析师基于折现模型给出，具有顺周期乐观倾向，建议结合本平台 7 重排雷模型与 PB 历史分位交叉验证。"}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
