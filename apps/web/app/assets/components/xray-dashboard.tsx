"use client";

import React, { useEffect, useState } from "react";
import {
  Activity,
  Shield,
  AlertTriangle,
  CheckCircle2,
  TrendingUp,
  Sparkles,
  RefreshCw,
  Layers,
  Zap,
  Globe,
  Sliders,
  DollarSign,
  ArrowUpRight,
  ArrowDownRight,
  PieChart,
} from "lucide-react";
import { useAuthStore } from "@investscope/core";

export interface XRayData {
  totalValue: number;
  healthScore: number;
  healthLevel: string;
  cr3: number;
  hhi: number;
  concentrationRisk: "LOW" | "MEDIUM" | "HIGH";
  sectorBreakdown: Array<{
    sector: string;
    value: number;
    pct: number;
    color: string;
    isConcentrated: boolean;
  }>;
  factorRadar: {
    user: {
      highDividend: number;
      fixedIncome: number;
      globalGrowth: number;
      megaValue: number;
      cashSafety: number;
    };
    benchmark: {
      highDividend: number;
      fixedIncome: number;
      globalGrowth: number;
      megaValue: number;
      cashSafety: number;
    };
  };
  stressTesting: Array<{
    id: string;
    title: string;
    badge: string;
    badgeColor: string;
    description: string;
    impactValue: number;
    impactPct: number;
    resilienceScore: string;
    analysis: string;
  }>;
  diagnosis: {
    healthLevel: string;
    score: number;
    strengths: string[];
    risks: string[];
    suggestions: string[];
  };
}

interface XRayDashboardProps {
  onAskAI?: (prompt: string) => void;
}

// 绘制 SVG 五维因子雷达图组件
function FactorRadarSVG({
  user,
  benchmark,
}: {
  user: XRayData["factorRadar"]["user"];
  benchmark: XRayData["factorRadar"]["benchmark"];
}) {
  const size = 260;
  const center = size / 2;
  const radius = 90;

  const factors: Array<{ key: keyof typeof user; label: string }> = [
    { key: "highDividend", label: "高股息收息" },
    { key: "fixedIncome", label: "稳健固收" },
    { key: "globalGrowth", label: "科技海外" },
    { key: "megaValue", label: "大盘价值" },
    { key: "cashSafety", label: "流动现金" },
  ];

  const numAxes = factors.length;
  const angleStep = (Math.PI * 2) / numAxes;

  // 将百分比 (0~100) 映射为坐标
  const getCoordinates = (val: number, index: number, maxVal = 60) => {
    const clamped = Math.min(val, maxVal);
    const r = (clamped / maxVal) * radius;
    const angle = index * angleStep - Math.PI / 2;
    const x = center + r * Math.cos(angle);
    const y = center + r * Math.sin(angle);
    return { x, y };
  };

  // 生成多边形路径
  const getPolygonPoints = (data: typeof user) => {
    return factors
      .map((f, i) => {
        const { x, y } = getCoordinates(data[f.key] || 0, i);
        return `${x},${y}`;
      })
      .join(" ");
  };

  const userPoints = getPolygonPoints(user);
  const benchmarkPoints = getPolygonPoints(benchmark);

  // 背景同心五边形
  const levels = [0.25, 0.5, 0.75, 1.0];

  return (
    <div className="flex flex-col items-center">
      <svg width={size} height={size} className="overflow-visible">
        {/* 背景网格 */}
        {levels.map((lvl, lIdx) => {
          const pts = factors
            .map((_, i) => {
              const r = radius * lvl;
              const angle = i * angleStep - Math.PI / 2;
              return `${center + r * Math.cos(angle)},${center + r * Math.sin(angle)}`;
            })
            .join(" ");
          return (
            <polygon
              key={lIdx}
              points={pts}
              fill="none"
              stroke="#ffffff"
              strokeOpacity="0.07"
              strokeWidth="1"
            />
          );
        })}

        {/* 轴线 */}
        {factors.map((_, i) => {
          const angle = i * angleStep - Math.PI / 2;
          const x2 = center + radius * Math.cos(angle);
          const y2 = center + radius * Math.sin(angle);
          return (
            <line
              key={i}
              x1={center}
              y1={center}
              x2={x2}
              y2={y2}
              stroke="#ffffff"
              strokeOpacity="0.1"
              strokeWidth="1"
            />
          );
        })}

        {/* 基准全天候模型多边形 (绿色虚线) */}
        <polygon
          points={benchmarkPoints}
          fill="#10b981"
          fillOpacity="0.1"
          stroke="#10b981"
          strokeWidth="1.5"
          strokeDasharray="3 3"
        />

        {/* 用户真实资产多边形 (蓝色/主色实体) */}
        <polygon
          points={userPoints}
          fill="#3b82f6"
          fillOpacity="0.35"
          stroke="#3b82f6"
          strokeWidth="2.5"
        />

        {/* 顶点数据点 */}
        {factors.map((f, i) => {
          const { x, y } = getCoordinates(user[f.key] || 0, i);
          return (
            <circle
              key={i}
              cx={x}
              cy={y}
              r="3.5"
              fill="#60a5fa"
              stroke="#1e3a8a"
              strokeWidth="1.5"
            />
          );
        })}

        {/* 标签文本 */}
        {factors.map((f, i) => {
          const labelRadius = radius + 22;
          const angle = i * angleStep - Math.PI / 2;
          const x = center + labelRadius * Math.cos(angle);
          const y = center + labelRadius * Math.sin(angle);
          const val = user[f.key] || 0;
          return (
            <text
              key={i}
              x={x}
              y={y}
              textAnchor="middle"
              dominantBaseline="central"
              className="text-[10px] fill-default-400 font-medium select-none"
            >
              {f.label} {val.toFixed(0)}%
            </text>
          );
        })}
      </svg>

      {/* 图例 */}
      <div className="flex items-center gap-4 mt-2 text-[11px] text-default-400">
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-blue-500 inline-block shadow-xs shadow-blue-500/50" />
          <span className="text-white font-medium">我的真实组合</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full border border-emerald-400 border-dashed inline-block" />
          <span>全天候参考基准</span>
        </div>
      </div>
    </div>
  );
}

export function XRayDashboard({ onAskAI }: XRayDashboardProps) {
  const [data, setData] = useState<XRayData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchXRay = async () => {
    setLoading(true);
    try {
      const token = useAuthStore.getState().token;
      const apiBase = process.env.NEXT_PUBLIC_API_URL || "";
      const res = await fetch(`${apiBase}/api/assets/xray`, {
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchXRay();
  }, []);

  const handleAskAIReport = () => {
    const prompt = "请根据我当前的资产 X 光穿透与压力测试结果，做一份深度的组合健康体检与调仓建议报告。";
    if (onAskAI) {
      onAskAI(prompt);
    } else {
      // 触发全局自定义事件唤起 AI 抽屉
      window.dispatchEvent(new CustomEvent("open-ai-assistant", { detail: { prompt } }));
    }
  };

  if (loading) {
    return (
      <div className="p-16 text-center text-default-400 glass-panel rounded-2xl">
        <RefreshCw className="w-7 h-7 animate-spin mx-auto mb-3 text-primary opacity-80" />
        <p className="text-sm">正在深度穿透持仓底层资产并进行宏观压力测试测算...</p>
      </div>
    );
  }

  if (!data || data.totalValue <= 0) {
    return (
      <div className="p-12 text-center text-default-400 glass-panel rounded-2xl">
        <Activity className="w-10 h-10 mx-auto mb-3 text-default-500 opacity-60" />
        <h4 className="text-base font-semibold text-white mb-1">暂无资产体检数据</h4>
        <p className="text-xs text-default-400">请先在「资产明细账本」中录入持仓，系统将自动生成全景 X 光透视看板。</p>
      </div>
    );
  }

  const isHealthy = data.healthScore >= 80;

  return (
    <div className="space-y-6 animate-fade-in text-foreground">
      {/* 1. 顶部全景健康得分与 AI 呼叫栏 */}
      <div className="glass-panel p-6 rounded-2xl relative overflow-hidden bg-gradient-to-r from-[#181b26] via-[#151720] to-[#1a1824] border border-primary/25 shadow-xl">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          {/* 得分与健康度 */}
          <div className="flex items-center gap-5">
            <div className="relative flex items-center justify-center shrink-0">
              <div
                className={`w-20 h-20 rounded-2xl flex flex-col items-center justify-center border shadow-lg ${
                  data.healthScore >= 90
                    ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-400 shadow-emerald-500/10"
                    : data.healthScore >= 75
                    ? "bg-blue-500/15 border-blue-500/30 text-blue-400 shadow-blue-500/10"
                    : "bg-amber-500/15 border-amber-500/30 text-amber-400 shadow-amber-500/10"
                }`}
              >
                <span className="text-2xl font-black">{data.healthScore}</span>
                <span className="text-[10px] font-semibold tracking-wider uppercase opacity-80">
                  HEALTH
                </span>
              </div>
            </div>

            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold text-white tracking-tight">
                  组合全景健康度：{data.healthLevel}
                </h3>
                <span
                  className={`text-[10px] px-2 py-0.5 rounded-full border font-medium ${
                    data.concentrationRisk === "LOW"
                      ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30"
                      : data.concentrationRisk === "MEDIUM"
                      ? "bg-blue-500/20 text-blue-300 border-blue-500/30"
                      : "bg-rose-500/20 text-rose-300 border-rose-500/30"
                  }`}
                >
                  {data.concentrationRisk === "LOW"
                    ? "分散度优良"
                    : data.concentrationRisk === "MEDIUM"
                    ? "集中度适中"
                    : "行业高度集中预警"}
                </span>
              </div>
              <p className="text-xs text-default-400 mt-1 max-w-xl leading-relaxed">
                穿透总市值 <strong className="text-white font-medium">¥{data.totalValue.toLocaleString()}</strong> · 前三大风险行业暴露集中度 (CR3){" "}
                <strong className="text-white font-medium">{data.cr3}%</strong> · HHI 分散指数{" "}
                <strong className="text-white font-medium">{data.hhi}</strong>
              </p>
            </div>
          </div>

          {/* AI 一键呼叫按钮 */}
          <div className="shrink-0">
            <button
              type="button"
              onClick={handleAskAIReport}
              className="w-full sm:w-auto px-5 py-3 rounded-xl bg-gradient-to-r from-primary to-blue-600 hover:from-primary/90 hover:to-blue-500 text-white font-semibold text-xs shadow-lg shadow-primary/25 transition-all flex items-center justify-center gap-2 cursor-pointer group"
            >
              <Sparkles className="w-4 h-4 text-amber-300 group-hover:scale-110 transition-transform" />
              <span>呼叫 AI 深度解读当前 X 光体检 ➔</span>
            </button>
          </div>
        </div>
      </div>

      {/* 2. 核心量化透视 (左: 行业穿透条形图 / 右: 五维因子雷达图) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* 左: 行业底层穿透分布 */}
        <div className="lg:col-span-7 glass-panel p-5 rounded-2xl border border-white/10 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-primary/20 text-primary flex items-center justify-center">
                  <Layers className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white">底层行业穿透与集中度暴露</h4>
                  <p className="text-[11px] text-default-400">穿透股票与公募基金持仓底层，还原真实行业敞口</p>
                </div>
              </div>
              <span className="text-[10px] text-default-400">
                安全阈值 ≤ 28%
              </span>
            </div>

            {/* 条形图列表 */}
            <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
              {data.sectorBreakdown.map((sec, idx) => (
                <div key={idx} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: sec.color }} />
                      <span className="font-medium text-white truncate text-[11px]">{sec.sector}</span>
                      {sec.isConcentrated && (
                        <span className="text-[9px] px-1.5 py-0.2 rounded bg-rose-500/20 text-rose-300 border border-rose-500/30">
                          集中度过高
                        </span>
                      )}
                    </div>
                    <div className="text-right shrink-0">
                      <span className="font-semibold text-white text-[11px]">{sec.pct}%</span>
                      <span className="text-default-400 text-[10px] ml-1.5">
                        (¥{sec.value.toLocaleString()})
                      </span>
                    </div>
                  </div>
                  {/* 进度条 */}
                  <div className="w-full h-2 rounded-full bg-[#1e212b] overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${Math.min(100, sec.pct)}%`,
                        backgroundColor: sec.isConcentrated ? "#f43f5e" : sec.color,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-between text-[11px] text-default-400">
            <span>💡 提示：单一行业真实暴露建议不超过 25%~30%，以避免板块系统性下跌。</span>
          </div>
        </div>

        {/* 右: 五维因子雷达图 */}
        <div className="lg:col-span-5 glass-panel p-5 rounded-2xl border border-white/10 flex flex-col items-center justify-between">
          <div className="w-full flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                <Sliders className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-white">大类资产五维因子雷达</h4>
                <p className="text-[11px] text-default-400">攻守因子与全天候配置对比</p>
              </div>
            </div>
          </div>

          <FactorRadarSVG
            user={data.factorRadar.user}
            benchmark={data.factorRadar.benchmark}
          />
        </div>
      </div>

      {/* 3. 宏观极端情景压力测试模拟器 (Scenario Stress Testing) */}
      <div className="glass-panel p-6 rounded-2xl border border-white/10">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-amber-500/20 text-amber-300 flex items-center justify-center">
              <Zap className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-white">宏观极端情景压力测试 (Stress Testing)</h4>
              <p className="text-[11px] text-default-400">测算黑天鹅与市场极端波动下，您的投资组合真实抗跌力与弹性</p>
            </div>
          </div>
          <span className="text-[10px] text-default-400 hidden sm:inline">
            数据驱动敏感度测算
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {data.stressTesting.map((sc) => {
            const isPositive = sc.impactValue >= 0;
            return (
              <div
                key={sc.id}
                className="p-4 rounded-xl bg-[#171922] border border-white/5 hover:border-white/15 transition-all flex flex-col justify-between group"
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className={`text-[10px] px-2 py-0.5 rounded-full border font-medium ${sc.badgeColor}`}>
                      {sc.badge}
                    </span>
                    <span className="text-[10px] text-default-400 font-medium">
                      {sc.resilienceScore}
                    </span>
                  </div>

                  <h5 className="font-bold text-white text-xs mb-1.5 group-hover:text-primary transition-colors">
                    {sc.title}
                  </h5>

                  <p className="text-[11px] text-default-400 leading-relaxed mb-3">
                    {sc.description}
                  </p>
                </div>

                <div className="pt-3 border-t border-white/5">
                  <div className="flex items-baseline justify-between">
                    <span className="text-[10px] text-default-400">预估组合盈亏:</span>
                    <div className={`font-bold text-sm flex items-center gap-0.5 ${isPositive ? "text-rise" : "text-fall"}`}>
                      {isPositive ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
                      <span>{isPositive ? "+" : ""}{sc.impactPct}%</span>
                    </div>
                  </div>
                  <div className="text-[10px] text-right text-default-500 font-mono mt-0.5">
                    {isPositive ? "+" : ""}¥{sc.impactValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 4. 诊断书清单 (优势 / 隐患 / 建议) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* 核心优势 */}
        <div className="p-4 rounded-2xl glass-panel border border-emerald-500/20 bg-[#141d1a]/50">
          <div className="flex items-center gap-2 mb-3 text-emerald-400">
            <CheckCircle2 className="w-4 h-4" />
            <h5 className="font-bold text-xs">组合核心优势 ({data.diagnosis.strengths.length})</h5>
          </div>
          <ul className="space-y-2 text-[11px] text-gray-300">
            {data.diagnosis.strengths.map((s, i) => (
              <li key={i} className="flex items-start gap-1.5 leading-relaxed">
                <span className="text-emerald-400 font-bold">•</span>
                <span>{s}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* 潜在隐患 */}
        <div className="p-4 rounded-2xl glass-panel border border-amber-500/20 bg-[#201c14]/50">
          <div className="flex items-center gap-2 mb-3 text-amber-400">
            <AlertTriangle className="w-4 h-4" />
            <h5 className="font-bold text-xs">潜在风险排查 ({data.diagnosis.risks.length})</h5>
          </div>
          <ul className="space-y-2 text-[11px] text-gray-300">
            {data.diagnosis.risks.length === 0 ? (
              <li className="text-default-500">当前持仓结构均衡，未发现明显隐形风险。</li>
            ) : (
              data.diagnosis.risks.map((r, i) => (
                <li key={i} className="flex items-start gap-1.5 leading-relaxed">
                  <span className="text-amber-400 font-bold">•</span>
                  <span>{r}</span>
                </li>
              ))
            )}
          </ul>
        </div>

        {/* 优化调仓建议 */}
        <div className="p-4 rounded-2xl glass-panel border border-blue-500/20 bg-[#141824]/50">
          <div className="flex items-center gap-2 mb-3 text-blue-400">
            <TrendingUp className="w-4 h-4" />
            <h5 className="font-bold text-xs">优化行动建议 ({data.diagnosis.suggestions.length})</h5>
          </div>
          <ul className="space-y-2 text-[11px] text-gray-300">
            {data.diagnosis.suggestions.map((s, i) => (
              <li key={i} className="flex items-start gap-1.5 leading-relaxed">
                <span className="text-blue-400 font-bold">•</span>
                <span>{s}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
