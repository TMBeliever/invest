"use client";

import React, { useMemo } from "react";
import ReactECharts from "echarts-for-react";

export interface AssetAllocationSlice {
  label: string;
  value: number;
  pct: number;
}

interface AssetAllocationChartProps {
  data: AssetAllocationSlice[];
  height?: string;
}

const SLICE_COLORS = ["#3b82f6", "#ef4444", "#22c55e", "#f59e0b", "#8b5cf6"];

export const AssetAllocationChart = React.memo(function AssetAllocationChart({
  data,
  height = "280px",
}: AssetAllocationChartProps) {
  if (!data || data.length === 0) {
    return <div className="flex items-center justify-center h-48 text-xs text-default-400">暂无资产数据</div>;
  }

  const option = useMemo(() => ({
    animation: false,
    tooltip: {
      trigger: "item",
      backgroundColor: "rgba(17, 17, 17, 0.95)",
      borderColor: "rgba(255, 255, 255, 0.15)",
      textStyle: { color: "#fff", fontSize: 12 },
      formatter: (params: any) => `${params.name}: ¥${Number(params.value).toLocaleString("zh-CN")} (${params.percent}%)`,
    },
    legend: {
      orient: "vertical",
      right: 8,
      top: "middle",
      textStyle: { color: "#999", fontSize: 12 },
      itemWidth: 10,
      itemHeight: 10,
    },
    series: [
      {
        name: "资产配置",
        type: "pie",
        radius: ["45%", "72%"],
        center: ["38%", "50%"],
        avoidLabelOverlap: true,
        itemStyle: {
          borderRadius: 6,
          borderColor: "rgba(0,0,0,0.15)",
          borderWidth: 2,
        },
        label: { show: false },
        labelLine: { show: false },
        data: data.map((d, i) => ({
          name: d.label,
          value: d.value,
          itemStyle: { color: SLICE_COLORS[i % SLICE_COLORS.length] },
        })),
      },
    ],
  }), [data]);

  return (
    <ReactECharts
      option={option}
      style={{ height, width: "100%" }}
      notMerge={false}
      lazyUpdate={true}
    />
  );
});
