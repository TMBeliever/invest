"use client";

import React, { useEffect, useState } from "react";
import type { StockQuote } from "@investscope/data/schemas";
import {
  TrendingUp,
  TrendingDown,
  RefreshCw,
  WifiOff,
  AlertCircle,
} from "lucide-react";

export function isAshareTradingTime(date = new Date()): { isTrading: boolean; reason: string } {
  // 北京时间 (UTC+8)
  const utc = date.getTime() + date.getTimezoneOffset() * 60000;
  const beijingDate = new Date(utc + 3600000 * 8);

  const day = beijingDate.getDay(); // 0 是周日, 6 是周六
  if (day === 0 || day === 6) {
    return { isTrading: false, reason: "周末休市" };
  }

  const hours = beijingDate.getHours();
  const minutes = beijingDate.getMinutes();
  const timeInMinutes = hours * 60 + minutes;

  const morningStart = 9 * 60 + 15; // 09:15
  const morningEnd = 11 * 60 + 30;   // 11:30
  const afternoonStart = 13 * 60 + 0; // 13:00
  const afternoonEnd = 15 * 60 + 0;   // 15:00

  if (timeInMinutes >= morningStart && timeInMinutes <= morningEnd) {
    return { isTrading: true, reason: "早盘交易中" };
  }

  if (timeInMinutes >= afternoonStart && timeInMinutes <= afternoonEnd) {
    return { isTrading: true, reason: "午盘交易中" };
  }

  if (timeInMinutes < morningStart) {
    return { isTrading: false, reason: "盘前未开盘" };
  }
  if (timeInMinutes > morningEnd && timeInMinutes < afternoonStart) {
    return { isTrading: false, reason: "午间休市" };
  }
  return { isTrading: false, reason: "已收盘 (盘后)" };
}

interface StockQuoteCardProps {
  quote: StockQuote | null;
  loading?: boolean;
  flash?: "up" | "down" | null;
  wsConnected?: boolean;
  onManualRefresh: () => void;
}

export function StockQuoteCard({
  quote,
  loading = false,
  flash = null,
  wsConnected = true,
  onManualRefresh,
}: StockQuoteCardProps) {
  const [tradingStatus, setTradingStatus] = useState(isAshareTradingTime());

  // 实时更新交易时段状态
  useEffect(() => {
    const statusTimer = setInterval(() => {
      setTradingStatus(isAshareTradingTime());
    }, 10000);
    return () => clearInterval(statusTimer);
  }, []);

  const isMarketOpen = (quote?.isTrading ?? true) && tradingStatus.isTrading;


  if (!quote) {
    return (
      <div className="glass-panel p-6 mb-6 text-center text-xs text-default-400">
        <RefreshCw className="w-5 h-5 animate-spin inline mb-2 text-primary" />
        <p>正在连接交易所极速数据源拉取实时行情...</p>
      </div>
    );
  }

  const priceDiff =
    quote.change !== undefined && quote.change !== 0
      ? quote.change
      : quote.price && quote.prevClose
      ? quote.price - quote.prevClose
      : 0;

  const isUp = priceDiff > 0 || (quote.changePct ?? 0) > 0;
  const isDown = priceDiff < 0 || (quote.changePct ?? 0) < 0;

  // A股颜色标准：大红代表上涨 (text-rise)，大绿/翡翠绿代表下跌 (text-fall)
  const priceColorClass = isUp
    ? "text-red-500 text-rise"
    : isDown
    ? "text-emerald-500 text-fall"
    : "text-default-300";

  const badgeBgClass = isUp
    ? "bg-red-500/10 text-red-500 text-rise border-red-500/20"
    : isDown
    ? "bg-emerald-500/10 text-emerald-500 text-fall border-emerald-500/20"
    : "bg-default-100 text-default-400 border-default-200";


  const formatNumber = (num: number | null | undefined, digits = 2) => {
    if (num === null || num === undefined || isNaN(num)) return "--";
    return num.toFixed(digits);
  };

  const formatAmount = (amt: number | null | undefined) => {
    if (!amt) return "--";
    if (amt >= 1e8) return `${(amt / 1e8).toFixed(2)} 亿`;
    if (amt >= 1e4) return `${(amt / 1e4).toFixed(2)} 万`;
    return `${amt.toFixed(0)}`;
  };

  const formatVolume = (vol: number | null | undefined) => {
    if (!vol) return "--";
    const hands = vol / 100;
    if (hands >= 1e4) return `${(hands / 1e4).toFixed(2)} 万手`;
    return `${hands.toFixed(0)} 手`;
  };

  return (
    <div
      className={`
        glass-panel p-6 mb-6 transition-all duration-300 relative overflow-hidden
        ${flash === "up" ? "ring-2 ring-red-500/50 shadow-lg shadow-red-500/20" : ""}
        ${flash === "down" ? "ring-2 ring-emerald-500/50 shadow-lg shadow-emerald-500/20" : ""}
      `}
    >
      {/* 头部：名称、代码、交易状态 & 秒级看盘控制栏 */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-divider/60 mb-5">
        <div className="flex items-center gap-3">
          <div className="flex items-baseline gap-2">
            <h2 className="text-2xl font-bold tracking-tight">{quote.name}</h2>
            <span className="font-mono text-sm text-default-400">{quote.code}</span>
          </div>

          {/* 交易开盘状态呼吸灯 / 休市徽章 */}
          {isMarketOpen ? (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 text-xs border border-emerald-500/20 font-medium">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
              </span>
              <span>实时开盘中 ({tradingStatus.reason})</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-400 text-xs border border-amber-500/20 font-medium">
              <span className="h-2 w-2 rounded-full bg-amber-400" />
              <span>{tradingStatus.reason} (非交易时段)</span>
            </div>
          )}
        </div>

        {/* 右侧看盘轮询控制 */}
        <div className="flex items-center gap-3 text-xs">
          {/* WebSocket 断连提示（仅在异常时显示） */}
          {!wsConnected && (
            <div
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border font-medium bg-amber-500/10 border-amber-500/30 text-amber-400"
              title="实时行情连接已断开，正在自动重连"
            >
              <WifiOff className="w-3.5 h-3.5" /> 实时连接已断开，重连中...
            </div>
          )}

          {/* 手动刷新按键 (随时可用) */}
          <button
            onClick={onManualRefresh}
            disabled={loading}
            className="p-1.5 rounded-lg bg-default-100 hover:bg-default-200 text-default-400 hover:text-foreground transition-all disabled:opacity-50"
            title="立即手动刷新行情"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin text-primary" : ""}`} />
          </button>
        </div>
      </div>

      {/* 核心看盘主标牌区：主现价 + 涨跌幅 + 今日浮动极值 */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center mb-6">
        {/* 左侧超大实时行情牌 (7 列) */}
        <div className="lg:col-span-7 flex flex-wrap items-baseline gap-4">
          <div className="flex items-baseline gap-3">
            <span className={`text-5xl font-extrabold tracking-tight font-mono ${priceColorClass}`}>
              {formatNumber(quote.price)}
            </span>

            <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-sm font-bold font-mono ${badgeBgClass}`}>
              {isUp && <TrendingUp className="w-4 h-4" />}
              {isDown && <TrendingDown className="w-4 h-4" />}
              <span>
                {isUp ? "+" : ""}
                {formatNumber(quote.change)}
              </span>
              <span>
                ({isUp ? "+" : ""}
                {formatNumber(quote.changePct)}%)
              </span>
            </div>
          </div>

          <div className="flex items-center gap-4 text-xs text-default-400 font-mono">
            <span>
              最高 <strong className="text-red-400">{formatNumber(quote.high)}</strong>
            </span>
            <span>
              最低 <strong className="text-emerald-400">{formatNumber(quote.low)}</strong>
            </span>
            <span>
              更新于 <span className="text-default-300">{quote.timestamp.split(" ")[1] || quote.timestamp}</span>
            </span>
          </div>
        </div>

        {/* 右侧微型振幅与涨跌停辅助牌 (5 列) */}
        <div className="lg:col-span-5 flex items-center justify-end gap-3 text-xs">
          <div className="p-2.5 rounded-xl bg-default-50/50 border border-divider/40 text-center min-w-[90px]">
            <span className="text-[11px] text-default-400 block mb-0.5">振幅</span>
            <span className="font-mono font-bold text-foreground">
              {formatNumber(quote.amplitude)}%
            </span>
          </div>

          <div className="p-2.5 rounded-xl bg-red-500/5 border border-red-500/20 text-center min-w-[90px]">
            <span className="text-[11px] text-red-400/80 block mb-0.5">涨停价</span>
            <span className="font-mono font-bold text-red-400">
              {formatNumber(quote.limitUp)}
            </span>
          </div>

          <div className="p-2.5 rounded-xl bg-emerald-500/5 border border-emerald-500/20 text-center min-w-[90px]">
            <span className="text-[11px] text-emerald-400/80 block mb-0.5">跌停价</span>
            <span className="font-mono font-bold text-emerald-400">
              {formatNumber(quote.limitDown)}
            </span>
          </div>
        </div>
      </div>

      {/* 非交易时段友情提示 */}
      {!isMarketOpen && (
        <div className="mb-4 px-3.5 py-2 rounded-xl bg-amber-500/5 border border-amber-500/20 text-amber-400/90 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0 text-amber-400" />
          <span>A股开盘时间段（周一至周五 09:15-11:30, 13:00-15:00）行情将通过实时连接自动推送。当前处于非交易时段，您随时可以点击右上角刷新图标手动获取最新盘后收盘价格。</span>
        </div>
      )}

      {/* 12-格盘中行情精细看盘网格 */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3 pt-4 border-t border-divider/50">
        <div className="p-3 rounded-xl bg-default-100/40 hover:bg-default-100/60 transition-colors">
          <span className="text-[11px] text-default-400 block mb-1">今开</span>
          <span
            className={`text-sm font-mono font-semibold ${
              quote.open > quote.prevClose
                ? "text-red-400"
                : quote.open < quote.prevClose
                ? "text-emerald-400"
                : "text-foreground"
            }`}
          >
            {formatNumber(quote.open)}
          </span>
        </div>

        <div className="p-3 rounded-xl bg-default-100/40 hover:bg-default-100/60 transition-colors">
          <span className="text-[11px] text-default-400 block mb-1">昨收</span>
          <span className="text-sm font-mono font-semibold text-foreground">
            {formatNumber(quote.prevClose)}
          </span>
        </div>

        <div className="p-3 rounded-xl bg-default-100/40 hover:bg-default-100/60 transition-colors">
          <span className="text-[11px] text-default-400 block mb-1">成交量</span>
          <span className="text-sm font-mono font-semibold text-foreground">
            {formatVolume(quote.volume)}
          </span>
        </div>

        <div className="p-3 rounded-xl bg-default-100/40 hover:bg-default-100/60 transition-colors">
          <span className="text-[11px] text-default-400 block mb-1">成交额</span>
          <span className="text-sm font-mono font-semibold text-foreground">
            {formatAmount(quote.amount)}
          </span>
        </div>

        <div className="p-3 rounded-xl bg-default-100/40 hover:bg-default-100/60 transition-colors">
          <span className="text-[11px] text-default-400 block mb-1">换手率</span>
          <span className="text-sm font-mono font-semibold text-foreground">
            {formatNumber(quote.turnoverRate)}%
          </span>
        </div>

        <div className="p-3 rounded-xl bg-default-100/40 hover:bg-default-100/60 transition-colors">
          <span className="text-[11px] text-default-400 block mb-1">动态市盈率(PE)</span>
          <span className="text-sm font-mono font-semibold text-foreground">
            {formatNumber(quote.pe)}
          </span>
        </div>

        <div className="p-3 rounded-xl bg-default-100/40 hover:bg-default-100/60 transition-colors">
          <span className="text-[11px] text-default-400 block mb-1">市净率(PB)</span>
          <span className="text-sm font-mono font-semibold text-foreground">
            {formatNumber(quote.pb)}
          </span>
        </div>

        <div className="p-3 rounded-xl bg-default-100/40 hover:bg-default-100/60 transition-colors">
          <span className="text-[11px] text-default-400 block mb-1">股息率</span>
          <span className="text-sm font-mono font-semibold text-amber-400">
            {formatNumber(quote.dividendYield)}%
          </span>
        </div>

        <div className="p-3 rounded-xl bg-default-100/40 hover:bg-default-100/60 transition-colors">
          <span className="text-[11px] text-default-400 block mb-1">总市值</span>
          <span className="text-sm font-mono font-semibold text-foreground">
            {quote.totalMarketCap ? `${formatNumber(quote.totalMarketCap, 1)} 亿` : "--"}
          </span>
        </div>

        <div className="p-3 rounded-xl bg-default-100/40 hover:bg-default-100/60 transition-colors">
          <span className="text-[11px] text-default-400 block mb-1">流通市值</span>
          <span className="text-sm font-mono font-semibold text-foreground">
            {quote.circulatingMarketCap ? `${formatNumber(quote.circulatingMarketCap, 1)} 亿` : "--"}
          </span>
        </div>

        <div className="p-3 rounded-xl bg-default-100/40 hover:bg-default-100/60 transition-colors">
          <span className="text-[11px] text-default-400 block mb-1">最高价</span>
          <span className="text-sm font-mono font-semibold text-red-400">
            {formatNumber(quote.high)}
          </span>
        </div>

        <div className="p-3 rounded-xl bg-default-100/40 hover:bg-default-100/60 transition-colors">
          <span className="text-[11px] text-default-400 block mb-1">最低价</span>
          <span className="text-sm font-mono font-semibold text-emerald-400">
            {formatNumber(quote.low)}
          </span>
        </div>
      </div>
    </div>
  );
}
