"use client";

import React from "react";
import ReactECharts from "echarts-for-react";
import type { KlinePoint } from "@investscope/data/schemas";

interface KlineChartProps {
  data: KlinePoint[];
  height?: string;
}

export function KlineChart({ data, height = "450px" }: KlineChartProps) {
  if (!data || data.length === 0) {
    return <div className="flex items-center justify-center h-48 text-xs text-default-400">暂无 K 线数据</div>;
  }

  const categoryData = data.map((d) => d.date);
  const values = data.map((d) => [d.open, d.close, d.low, d.high]);
  const volumes = data.map((d, i) => [i, d.volume, d.close >= d.open ? 1 : -1]);
  const ma5 = data.map((d) => d.ma5 ?? null);
  const ma20 = data.map((d) => d.ma20 ?? null);
  const ma60 = data.map((d) => d.ma60 ?? null);

  const option = {
    animation: false,
    tooltip: {
      trigger: "axis",
      axisPointer: { type: "cross" },
      backgroundColor: "rgba(17, 17, 17, 0.95)",
      borderColor: "rgba(255, 255, 255, 0.15)",
      textStyle: { color: "#fff", fontSize: 12 },
      formatter: (params: any[]) => {
        if (!params || params.length === 0) return "";
        const dateStr = params[0].name;
        let kItem: any = null;
        let volItem: any = null;

        params.forEach((p) => {
          if (p.seriesName === "K线形态") kItem = p;
          if (p.seriesName === "成交量") volItem = p;
        });

        let html = `<div style="font-weight:bold;margin-bottom:4px;border-bottom:1px solid #444;padding-bottom:4px;">交易日期: ${dateStr}</div>`;
        if (kItem && kItem.value) {
          const [, openVal, closeVal, lowVal, highVal] = kItem.value;
          const isUp = closeVal >= openVal;
          const color = isUp ? "#ef4444" : "#22c55e";
          html += `
            <div style="color:${color};margin-bottom:2px;">开盘价: <strong>${openVal}</strong> 元</div>
            <div style="color:${color};margin-bottom:2px;">收盘价: <strong>${closeVal}</strong> 元</div>
            <div style="color:#aaa;margin-bottom:2px;">最高价: ${highVal} 元</div>
            <div style="color:#aaa;margin-bottom:2px;">最低价: ${lowVal} 元</div>
          `;
        }
        if (volItem) {
          const volVal = volItem.value ? (typeof volItem.value === "object" ? volItem.value.value : volItem.value) : 0;
          html += `<div style="color:#3b82f6;margin-top:4px;">成交量: ${(volVal / 10000).toFixed(2)} 万股</div>`;
        }
        return html;
      },
    },
    axisPointer: {
      link: [{ xAxisIndex: "all" }],
      label: { backgroundColor: "#777" },
    },
    legend: {
      data: ["K线形态", "5日均线 (MA5)", "20日均线 (MA20)", "60日均线 (MA60)"],
      textStyle: { color: "#999" },
      top: 0,
    },
    grid: [
      { left: "8%", right: "4%", top: "10%", height: "55%" },
      { left: "8%", right: "4%", top: "72%", height: "18%" },
    ],
    xAxis: [
      {
        type: "category",
        data: categoryData,
        boundaryGap: false,
        axisLine: { onZero: false, lineStyle: { color: "#444" } },
        splitLine: { show: false },
        min: "dataMin",
        max: "dataMax",
      },
      {
        type: "category",
        gridIndex: 1,
        data: categoryData,
        boundaryGap: false,
        axisLine: { onZero: false },
        axisTick: { show: false },
        splitLine: { show: false },
        axisLabel: { show: false },
        min: "dataMin",
        max: "dataMax",
      },
    ],
    yAxis: [
      {
        scale: true,
        splitArea: { show: false },
        splitLine: { lineStyle: { color: "rgba(255, 255, 255, 0.06)" } },
        axisLabel: { color: "#888" },
      },
      {
        scale: true,
        gridIndex: 1,
        splitNumber: 2,
        axisLabel: { show: false },
        axisLine: { show: false },
        axisTick: { show: false },
        splitLine: { show: false },
      },
    ],
    dataZoom: [
      { type: "inside", xAxisIndex: [0, 1], start: 30, end: 100 },
      { show: true, xAxisIndex: [0, 1], type: "slider", top: "93%", start: 30, end: 100 },
    ],
    series: [
      {
        name: "K线形态",
        type: "candlestick",
        data: values,
        itemStyle: {
          color: "#ef4444",        // 阳线 红
          color0: "#22c55e",       // 阴线 绿
          borderColor: "#ef4444",
          borderColor0: "#22c55e",
        },
      },
      {
        name: "5日均线 (MA5)",
        type: "line",
        data: ma5,
        smooth: true,
        showSymbol: false,
        lineStyle: { width: 1.5, color: "#3b82f6" },
      },
      {
        name: "20日均线 (MA20)",
        type: "line",
        data: ma20,
        smooth: true,
        showSymbol: false,
        lineStyle: { width: 1.5, color: "#eab308" },
      },
      {
        name: "60日均线 (MA60)",
        type: "line",
        data: ma60,
        smooth: true,
        showSymbol: false,
        lineStyle: { width: 1.5, color: "#a855f7" },
      },
      {
        name: "成交量",
        type: "bar",
        xAxisIndex: 1,
        yAxisIndex: 1,
        data: volumes.map((item) => ({
          value: item[1],
          itemStyle: { color: item[2] === 1 ? "rgba(239, 68, 68, 0.6)" : "rgba(34, 197, 94, 0.6)" },
        })),
      },
    ],
  };

  return <ReactECharts option={option} style={{ height, width: "100%" }} />;
}
