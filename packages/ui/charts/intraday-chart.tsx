"use client";

import React from "react";
import ReactECharts from "echarts-for-react";
import type { IntradayTick } from "@investscope/data/schemas";

interface IntradayChartProps {
  ticks: IntradayTick[];
  prevClose: number | null;
  height?: string;
}

export function IntradayChart({ ticks, prevClose, height = "450px" }: IntradayChartProps) {
  if (!ticks || ticks.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-xs text-default-400">
        暂无分时数据（非交易时段或数据加载中）
      </div>
    );
  }

  const times     = ticks.map((t) => t.time);
  const prices    = ticks.map((t) => t.price);
  const avgPrices = ticks.map((t) => t.avgPrice);
  const volumes   = ticks.map((t) => t.volume);
  const changePcts= ticks.map((t) => t.changePct);

  // 价格对称轴：以昨收为基准，上下对称
  const pc = prevClose ?? prices[0];
  const priceMin = Math.min(...prices, ...avgPrices);
  const priceMax = Math.max(...prices, ...avgPrices);
  const maxDeviation = Math.max(Math.abs(priceMax - pc), Math.abs(priceMin - pc), pc * 0.005);
  const yMin = Math.max(0, pc - maxDeviation * 1.05);
  const yMax = pc + maxDeviation * 1.05;

  const option = {
    animation: false,
    backgroundColor: "transparent",
    tooltip: {
      trigger: "axis",
      axisPointer: {
        type: "cross",
        lineStyle: { color: "rgba(255,255,255,0.3)", type: "dashed" },
      },
      backgroundColor: "rgba(17,17,17,0.95)",
      borderColor: "rgba(255,255,255,0.15)",
      textStyle: { color: "#fff", fontSize: 12 },
      formatter: (params: any[]) => {
        const idx = params[0]?.dataIndex ?? 0;
        const t   = ticks[idx];
        if (!t) return "";
        const isUp    = t.changePct >= 0;
        const color   = isUp ? "#ef4444" : "#22c55e";
        const sign    = isUp ? "+" : "";
        return `
          <div style="font-weight:bold;margin-bottom:4px;border-bottom:1px solid #444;padding-bottom:4px;">${t.time}</div>
          <div style="color:${color};margin-bottom:2px;">现价: <strong>${t.price.toFixed(2)}</strong> 元</div>
          <div style="color:${color};margin-bottom:2px;">涨跌: ${sign}${t.changePct.toFixed(2)}%</div>
          <div style="color:#888;margin-bottom:2px;">均价: ${t.avgPrice.toFixed(2)} 元</div>
          <div style="color:#3b82f6;margin-top:4px;">成交量: ${(t.volume / 10000).toFixed(2)} 万股</div>
        `;
      },
    },
    axisPointer: {
      link: [{ xAxisIndex: [0, 1] }],
    },
    grid: [
      { left: "6%", right: "5%", top: "6%",  height: "58%" },
      { left: "6%", right: "5%", top: "72%", height: "18%" },
    ],
    xAxis: [
      {
        type: "category",
        data: times,
        boundaryGap: false,
        axisLine: { lineStyle: { color: "#333" } },
        splitLine: {
          show: true,
          lineStyle: { color: "rgba(255,255,255,0.05)" },
          // 整点竖线（10:00、11:00、13:00、14:00）
          interval: (idx: number) => ["10:00", "11:00", "13:00", "14:00"].includes(times[idx]),
        },
        axisLabel: {
          color: "#777",
          fontSize: 11,
          interval: (idx: number) =>
            ["09:30", "10:00", "10:30", "11:00", "11:30", "13:00", "13:30", "14:00", "14:30", "15:00"].includes(times[idx]),
        },
      },
      {
        type: "category",
        gridIndex: 1,
        data: times,
        boundaryGap: false,
        axisLabel: { show: false },
        axisTick: { show: false },
        axisLine: { lineStyle: { color: "#333" } },
        splitLine: { show: false },
      },
    ],
    yAxis: [
      {
        min: yMin,
        max: yMax,
        scale: false,
        splitLine: { lineStyle: { color: "rgba(255,255,255,0.06)" } },
        axisLabel: {
          color: "#888",
          fontSize: 11,
          formatter: (val: number) => val.toFixed(2),
        },
        // 右侧涨跌幅标签
      },
      {
        gridIndex: 1,
        splitNumber: 2,
        axisLabel: { show: false },
        axisLine: { show: false },
        axisTick: { show: false },
        splitLine: { show: false },
      },
    ],
    series: [
      {
        // 昨收基准线
        name: "昨收",
        type: "line",
        data: ticks.map(() => pc),
        showSymbol: false,
        lineStyle: { color: "rgba(255,255,255,0.25)", width: 1, type: "dashed" },
        z: 1,
      },
      {
        // 分时价格线（面积填充：涨红跌绿）
        name: "分时价格",
        type: "line",
        data: prices,
        showSymbol: false,
        smooth: false,
        lineStyle: { width: 1.5, color: "#ef4444" },
        areaStyle: {
          color: {
            type: "linear",
            x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: "rgba(239, 68, 68, 0.30)" },
              { offset: 1, color: "rgba(239, 68, 68, 0.02)" },
            ],
          },
        },
        z: 3,
        // 根据涨跌动态着色（在tooltip和volume里用changePct区分）
      },
      {
        // 均价线（黄色）
        name: "均价",
        type: "line",
        data: avgPrices,
        showSymbol: false,
        smooth: false,
        lineStyle: { width: 1.5, color: "#f59e0b" },
        z: 4,
      },
      {
        // 成交量柱状图
        name: "成交量",
        type: "bar",
        xAxisIndex: 1,
        yAxisIndex: 1,
        data: volumes.map((v, i) => ({
          value: v,
          itemStyle: {
            color: changePcts[i] >= 0
              ? "rgba(239, 68, 68, 0.65)"
              : "rgba(34, 197, 94, 0.65)",
          },
        })),
        barMaxWidth: 4,
      },
    ],
    legend: {
      data: ["分时价格", "均价"],
      textStyle: { color: "#888", fontSize: 11 },
      top: 2,
      right: "5%",
    },
  };

  return <ReactECharts option={option} style={{ height, width: "100%" }} />;
}
