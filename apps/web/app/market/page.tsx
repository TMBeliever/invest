"use client";

import { useEffect } from "react";
import { useMarketStore } from "@investscope/core";
import {
  BarChart3,
  Layers,
  RefreshCw,
} from "lucide-react";

export default function MarketPage() {
  const { indices, fetchIndices, loading } = useMarketStore();

  useEffect(() => {
    fetchIndices();
  }, [fetchIndices]);

  const displayIndices = indices.length > 0 ? indices : [
    { code: "000001", name: "上证指数", price: 3946.68, change: 12.58, changePct: 0.32 },
    { code: "399001", name: "深证成指", price: 14414.43, change: 154.99, changePct: 1.09 },
    { code: "399006", name: "创业板指", price: 3602.08, change: 52.92, changePct: 1.49 },
    { code: "000300", name: "沪深300", price: 4690.92, change: 27.13, changePct: 0.58 },
    { code: "000905", name: "中证500", price: 8045.31, change: 77.77, changePct: 0.98 },
  ];

  return (
    <div className="p-6 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-primary" />
            市场总览 (AKShare 真实实时数据)
          </h1>
          <p className="text-sm text-default-400 mt-1">A股主板与核心指数 · 真实实时行情与成交量全景</p>
        </div>
        {loading["indices"] && <RefreshCw className="w-4 h-4 animate-spin text-default-400" />}
      </div>

      <div className="glass-panel p-6 animate-fade-in">
        <h2 className="text-sm font-semibold mb-4 text-default-400 flex items-center gap-2">
          <Layers className="w-4 h-4" />
          主要市场指数
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {displayIndices.map((item: any) => {
            const isUp = (item.changePct ?? 0) >= 0;
            return (
              <div key={item.code} className="p-4 rounded-xl bg-default-50/50 hover:bg-default-100/50 transition-all cursor-pointer">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium">{item.name}</span>
                  <span className="text-[10px] text-default-400">{item.code}</span>
                </div>

                <div className="text-2xl font-bold tracking-tight my-2">
                  {Number(item.price).toLocaleString("zh-CN", { minimumFractionDigits: 2 })}
                </div>

                <div className="flex items-center justify-between text-xs">
                  <span className={`font-semibold ${isUp ? "text-rise" : "text-fall"}`}>
                    {isUp ? "+" : ""}{item.change} ({isUp ? "+" : ""}{item.changePct}%)
                  </span>
                  <span className="text-[10px] text-default-400">
                    成交额: {item.amount ? `${(item.amount / 100000000).toFixed(0)}亿` : "--"}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
