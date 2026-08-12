"use client";

import React from "react";
import ReactECharts from "echarts-for-react";
import type { ValuationCorridorPoint } from "@investscope/data/schemas";

interface ValuationCorridorChartProps {
  data: ValuationCorridorPoint[];
  height?: string;
}

export function ValuationCorridorChart({ data, height = "450px" }: ValuationCorridorChartProps) {
  if (!data || data.length === 0) {
    return <div className="flex items-center justify-center h-48 text-xs text-default-400">暂无估值通道数据</div>;
  }

  const categoryData = data.map((d) => d.date);
  const prices = data.map((d) => d.price);
  const pe20 = data.map((d) => d.pe20);
  const pe50 = data.map((d) => d.pe50);
  const pe80 = data.map((d) => d.pe80);

  const option = {
    animation: true,
    tooltip: {
      trigger: "axis",
      backgroundColor: "rgba(17, 17, 17, 0.9)",
      borderColor: "rgba(255, 255, 255, 0.1)",
      textStyle: { color: "#fff", fontSize: 12 },
    },
    legend: {
      data: ["实际股价", "20%极低估线 (买入区)", "50%中性估值线", "80%偏高估线 (风险区)"],
      textStyle: { color: "#999" },
      top: 0,
    },
    grid: { left: "8%", right: "4%", top: "12%", bottom: "12%" },
    xAxis: {
      type: "category",
      data: categoryData,
      boundaryGap: false,
      axisLine: { lineStyle: { color: "#444" } },
      axisLabel: { color: "#888" },
    },
    yAxis: {
      type: "value",
      scale: true,
      splitLine: { lineStyle: { color: "rgba(255, 255, 255, 0.06)" } },
      axisLabel: { color: "#888" },
    },
    dataZoom: [
      { type: "inside", start: 0, end: 100 },
      { show: true, type: "slider", bottom: "2%", start: 0, end: 100 },
    ],
    series: [
      {
        name: "实际股价",
        type: "line",
        data: prices,
        smooth: true,
        showSymbol: false,
        lineStyle: { width: 3, color: "#38bdf8" },
        z: 10,
      },
      {
        name: "20%极低估线 (买入区)",
        type: "line",
        data: pe20,
        smooth: true,
        showSymbol: false,
        lineStyle: { width: 2, color: "#22c55e", type: "dashed" },
        areaStyle: {
          color: "rgba(34, 197, 94, 0.08)",
        },
      },
      {
        name: "50%中性估值线",
        type: "line",
        data: pe50,
        smooth: true,
        showSymbol: false,
        lineStyle: { width: 1.5, color: "#eab308", type: "dotted" },
      },
      {
        name: "80%偏高估线 (风险区)",
        type: "line",
        data: pe80,
        smooth: true,
        showSymbol: false,
        lineStyle: { width: 2, color: "#ef4444", type: "dashed" },
        areaStyle: {
          color: "rgba(239, 68, 68, 0.05)",
        },
      },
    ],
  };

  return <ReactECharts option={option} style={{ height, width: "100%" }} />;
}
