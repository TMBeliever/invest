"use client";

import React, { useMemo } from "react";
import ReactECharts from "echarts-for-react";
import type { KlinePoint } from "@investscope/data/schemas";

interface KlineChartProps {
  data: KlinePoint[];
  height?: string;
}

export const KlineChart = React.memo(function KlineChart({ data, height = "450px" }: KlineChartProps) {
  if (!data || data.length === 0) {
    return <div className="flex items-center justify-center h-48 text-xs text-default-400">暂无 K 线数据</div>;
  }

  const latestItem = data[data.length - 1];
  const prevItem = data.length > 1 ? data[data.length - 2] : null;
  const latestPrevClose = prevItem ? prevItem.close : latestItem.open;
  const latestChange = latestItem.close - latestPrevClose;
  const latestChangePct = latestPrevClose > 0 ? (latestChange / latestPrevClose) * 100 : 0;
  const latestIsUp = latestChange >= 0;

  const option = useMemo(() => {
    const categoryData = data.map((d) => d.date);
    const values = data.map((d) => [d.open, d.close, d.low, d.high]);
    const volumes = data.map((d, i) => [i, d.volume, d.close >= d.open ? 1 : -1]);
    const ma5 = data.map((d) => d.ma5 ?? null);
    const ma20 = data.map((d) => d.ma20 ?? null);
    const ma60 = data.map((d) => d.ma60 ?? null);

    return {
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

          let html = `<div style="font-weight:bold;margin-bottom:6px;border-bottom:1px solid rgba(255,255,255,0.15);padding-bottom:4px;font-size:13px;">${dateStr}</div>`;
          if (kItem && kItem.value) {
            const idx = kItem.dataIndex;
            const curPoint = data[idx] || {};
            const prevCloseVal = idx > 0 ? data[idx - 1].close : (curPoint.open ?? kItem.value[1]);
            const closeVal = curPoint.close ?? kItem.value[2];
            const openVal = curPoint.open ?? kItem.value[1];
            const lowVal = curPoint.low ?? kItem.value[3];
            const highVal = curPoint.high ?? kItem.value[4];

            const changeVal = closeVal - prevCloseVal;
            const changePctVal = prevCloseVal > 0 ? (changeVal / prevCloseVal) * 100 : 0;
            const isUp = changeVal >= 0;
            const color = isUp ? "#ef4444" : "#22c55e";
            const sign = isUp ? "+" : "";

            html += `
              <div style="display:flex;justify-content:space-between;gap:16px;margin-bottom:3px;">
                <span style="color:#aaa;">收盘价:</span>
                <strong style="color:${color};">${closeVal.toFixed(2)}</strong>
              </div>
              <div style="display:flex;justify-content:space-between;gap:16px;margin-bottom:3px;">
                <span style="color:#aaa;">今日涨跌:</span>
                <strong style="color:${color};">${sign}${changeVal.toFixed(2)} (${sign}${changePctVal.toFixed(2)}%)</strong>
              </div>
              <div style="display:flex;justify-content:space-between;gap:16px;margin-bottom:3px;font-size:11px;color:#888;">
                <span>开: ${openVal.toFixed(2)}</span>
                <span>高: ${highVal.toFixed(2)}</span>
                <span>低: ${lowVal.toFixed(2)}</span>
              </div>
            `;
          }
          if (volItem) {
            const volVal = volItem.value ? (typeof volItem.value === "object" ? volItem.value.value : volItem.value) : 0;
            html += `<div style="color:#3b82f6;margin-top:4px;font-size:11px;">成交量: ${(volVal / 10000).toFixed(2)} 万</div>`;
          }
          return html;
        },
      },
      axisPointer: {
        link: [{ xAxisIndex: [0, 1] }],
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
            color: "#ef4444",
            color0: "#22c55e",
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
  }, [data]);

  return (
    <div className="w-full">
      {/* 顶部 K 线实时涨跌概览看盘条 */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-2 px-3 py-2 rounded-xl bg-default-100/50 border border-divider/40 text-xs">
        <div className="flex items-center gap-3">
          <span className="text-default-400 font-medium">最新收盘:</span>
          <span className="font-bold text-sm tracking-tight">{latestItem.close.toFixed(2)}</span>
          <span className={`font-bold px-2 py-0.5 rounded ${latestIsUp ? "bg-rise text-rise" : "bg-fall text-fall"}`}>
            {latestIsUp ? "+" : ""}{latestChange.toFixed(2)} ({latestIsUp ? "+" : ""}{latestChangePct.toFixed(2)}%)
          </span>
        </div>
        <div className="flex items-center gap-3 text-default-400 font-mono text-[11px]">
          <span>开盘: <strong className="text-foreground">{latestItem.open.toFixed(2)}</strong></span>
          <span>最高: <strong className="text-foreground">{latestItem.high.toFixed(2)}</strong></span>
          <span>最低: <strong className="text-foreground">{latestItem.low.toFixed(2)}</strong></span>
          <span>成交量: <strong className="text-foreground">{(latestItem.volume / 10000).toFixed(1)}万</strong></span>
        </div>
      </div>
      <ReactECharts
        option={option}
        style={{ height, width: "100%" }}
        notMerge={false}
        lazyUpdate={true}
      />
    </div>
  );
});

