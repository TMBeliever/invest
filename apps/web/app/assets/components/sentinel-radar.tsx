"use client";

import React, { useState, useEffect } from "react";
import {
  ShieldAlert,
  ShieldCheck,
  AlertTriangle,
  Sparkles,
  Info,
  Flame,
  CheckCircle2,
  X,
  Bot,
  RefreshCw,
  TrendingUp,
  ArrowRight,
  SlidersHorizontal,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { useAuthStore } from "@investscope/core/stores/auth-store";

interface DecisionOption {
  key: string;
  name: string;
  tag: string;
  analysis: string;
  action_type?: string;
}

interface SentinelAlert {
  id: string;
  rule_code: string;
  category: string;
  severity: "INFO" | "OPPORTUNITY" | "WARNING" | "CRITICAL";
  symbol?: string;
  symbol_name?: string;
  title: string;
  summary: string;
  markdown_content: string;
  structured_metrics: Record<string, any>;
  decision_options: DecisionOption[];
  status: "UNREAD" | "ACKNOWLEDGED" | "AUTO_RESOLVED" | "DISMISSED";
  created_at: string;
}

export function SentinelRadarDashboard() {
  const [alerts, setAlerts] = useState<SentinelAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"ALL" | "ACTIVE" | "OPPORTUNITY" | "WARNING">("ACTIVE");
  const [expandedAlerts, setExpandedAlerts] = useState<Record<string, boolean>>({});

  const API_BASE = process.env.NEXT_PUBLIC_API_URL || "";

  const fetchAlerts = async () => {
    setLoading(true);
    try {
      const token = useAuthStore.getState().token;
      if (!token) return;
      const res = await fetch(`${API_BASE}/api/intelligence/sentinel-alerts`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setAlerts(data.alerts || []);
        // 默认展开所有活跃告警
        const initialExpanded: Record<string, boolean> = {};
        (data.alerts || []).forEach((a: SentinelAlert) => {
          initialExpanded[a.id] = true;
        });
        setExpandedAlerts(initialExpanded);
      }
    } catch (e) {
      console.error("Failed to fetch sentinel alerts:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAlerts();
  }, []);

  const handleAcknowledge = async (id: string) => {
    try {
      const token = useAuthStore.getState().token;
      await fetch(`${API_BASE}/api/intelligence/sentinel-alerts/${id}/acknowledge`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      setAlerts((prev) =>
        prev.map((a) => (a.id === id ? { ...a, status: "ACKNOWLEDGED" } : a))
      );
    } catch (e) {
      console.error(e);
    }
  };

  const handleDismiss = async (id: string) => {
    try {
      const token = useAuthStore.getState().token;
      await fetch(`${API_BASE}/api/intelligence/sentinel-alerts/${id}/dismiss`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      setAlerts((prev) =>
        prev.map((a) => (a.id === id ? { ...a, status: "DISMISSED" } : a))
      );
    } catch (e) {
      console.error(e);
    }
  };

  const handleCallAI = (alert: SentinelAlert, option?: DecisionOption) => {
    let prompt = `你好！我正在查看智能哨兵预警：【${alert.title}】\n\n问题摘要：${alert.summary}\n`;
    if (option) {
      prompt += `我对方案【${option.name} (${option.tag})】很感兴趣：${option.analysis}\n请结合我的全景持仓和行情，详细帮我推演执行该方案的步骤、预期收益变化以及潜在风险！`;
    } else {
      prompt += `请结合我的整体持仓结构，深入分析此风险并给出最适合我的调仓落地建议。`;
    }

    window.dispatchEvent(
      new CustomEvent("open-ai-assistant", {
        detail: { prompt },
      })
    );
  };

  const toggleExpand = (id: string) => {
    setExpandedAlerts((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const activeAlerts = alerts.filter((a) => a.status === "UNREAD" || a.status === "ACKNOWLEDGED");
  const filteredAlerts = alerts.filter((a) => {
    if (filter === "ACTIVE") return a.status === "UNREAD" || a.status === "ACKNOWLEDGED";
    if (filter === "OPPORTUNITY") return a.severity === "OPPORTUNITY";
    if (filter === "WARNING") return a.severity === "WARNING" || a.severity === "CRITICAL";
    return true;
  });

  const getSeverityStyle = (severity: string) => {
    switch (severity) {
      case "CRITICAL":
        return {
          border: "border-rose-500/40 hover:border-rose-500/60",
          bg: "bg-rose-950/15",
          badge: "bg-rose-500/20 text-rose-400 border-rose-500/30",
          icon: <Flame className="w-4 h-4 text-rose-400" />,
          label: "重大风险",
        };
      case "WARNING":
        return {
          border: "border-amber-500/30 hover:border-amber-500/50",
          bg: "bg-amber-950/15",
          badge: "bg-amber-500/20 text-amber-300 border-amber-500/30",
          icon: <AlertTriangle className="w-4 h-4 text-amber-400" />,
          label: "结构预警",
        };
      case "OPPORTUNITY":
        return {
          border: "border-emerald-500/30 hover:border-emerald-500/50",
          bg: "bg-emerald-950/15",
          badge: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
          icon: <Sparkles className="w-4 h-4 text-emerald-400" />,
          label: "配置机会",
        };
      default:
        return {
          border: "border-blue-500/30 hover:border-blue-500/50",
          bg: "bg-blue-950/15",
          badge: "bg-blue-500/20 text-blue-300 border-blue-500/30",
          icon: <Info className="w-4 h-4 text-blue-400" />,
          label: "关注提示",
        };
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* 顶部控制栏 */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-2xl bg-[#14161f]/80 border border-white/10 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500/20 to-primary/20 text-primary flex items-center justify-center border border-primary/30 shadow-inner">
            <ShieldAlert className="w-5 h-5 text-amber-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-white tracking-wide">
                组合智能哨兵与风控雷达
              </h2>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/20 text-primary border border-primary/30 font-semibold font-mono">
                PRO ACTIVE
              </span>
            </div>
            <p className="text-xs text-default-400 mt-0.5">
              全天候扫描隐形行业超标、股息利差收窄与大类配置失衡，为您提供专属 3 套应对决策方案。
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* 筛选 Tabs */}
          <div className="flex items-center bg-black/40 p-1 rounded-xl border border-white/10 text-xs">
            <button
              onClick={() => setFilter("ACTIVE")}
              className={`px-3 py-1.5 rounded-lg transition-all font-medium flex items-center gap-1.5 ${
                filter === "ACTIVE"
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-default-400 hover:text-white"
              }`}
            >
              <span>待处理</span>
              {activeAlerts.length > 0 && (
                <span className="w-4 h-4 rounded-full bg-rose-500 text-white text-[10px] flex items-center justify-center font-bold">
                  {activeAlerts.length}
                </span>
              )}
            </button>
            <button
              onClick={() => setFilter("WARNING")}
              className={`px-3 py-1.5 rounded-lg transition-all font-medium ${
                filter === "WARNING"
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-default-400 hover:text-white"
              }`}
            >
              ⚠️ 预警
            </button>
            <button
              onClick={() => setFilter("OPPORTUNITY")}
              className={`px-3 py-1.5 rounded-lg transition-all font-medium ${
                filter === "OPPORTUNITY"
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-default-400 hover:text-white"
              }`}
            >
              💡 机会
            </button>
            <button
              onClick={() => setFilter("ALL")}
              className={`px-3 py-1.5 rounded-lg transition-all font-medium ${
                filter === "ALL"
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-default-400 hover:text-white"
              }`}
            >
              全部历史
            </button>
          </div>

          <button
            onClick={fetchAlerts}
            disabled={loading}
            className="p-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-default-300 hover:text-white transition-all disabled:opacity-50 cursor-pointer"
            title="重新扫描持仓"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin text-primary" : ""}`} />
          </button>
        </div>
      </div>

      {/* 告警列表卡片流 */}
      {loading && alerts.length === 0 ? (
        <div className="py-20 text-center text-default-400 space-y-3">
          <RefreshCw className="w-8 h-8 mx-auto animate-spin text-primary opacity-60" />
          <div className="text-sm font-medium">正在使用四维风控算法扫描您的全景资产与利差...</div>
        </div>
      ) : filteredAlerts.length === 0 ? (
        <div className="p-12 rounded-3xl bg-[#14161f]/40 border border-white/10 text-center space-y-3">
          <div className="w-14 h-14 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center justify-center mx-auto shadow-inner">
            <ShieldCheck className="w-7 h-7" />
          </div>
          <div className="text-base font-bold text-white">当前持仓结构极其稳健！</div>
          <p className="text-xs text-default-400 max-w-md mx-auto leading-relaxed">
            未检测到隐形行业过度集中（均在 28% 安全线内），无股息利差倒挂或防御垫击穿。系统将持续为您全天候护航。
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredAlerts.map((alert) => {
            const style = getSeverityStyle(alert.severity);
            const isExpanded = expandedAlerts[alert.id] !== false;
            const isDismissed = alert.status === "DISMISSED";

            return (
              <div
                key={alert.id}
                className={`p-5 rounded-2xl border transition-all ${style.border} ${style.bg} ${
                  isDismissed ? "opacity-40 grayscale-50" : ""
                } backdrop-blur-md shadow-lg shadow-black/30 space-y-4`}
              >
                {/* 头部标题区 */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="mt-0.5 shrink-0">{style.icon}</div>
                    <div className="min-w-0 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-[10px] px-2 py-0.5 rounded-md border font-semibold ${style.badge}`}>
                          {style.label}
                        </span>
                        {alert.status === "ACKNOWLEDGED" && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/10 text-gray-300">
                            已阅知
                          </span>
                        )}
                        <h3 className="text-sm font-bold text-white tracking-wide">
                          {alert.title}
                        </h3>
                      </div>
                      <p className="text-xs text-default-300 leading-relaxed">
                        {alert.summary}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {alert.status === "UNREAD" && (
                      <button
                        onClick={() => handleAcknowledge(alert.id)}
                        className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/15 border border-white/10 text-default-300 hover:text-white text-[11px] font-medium transition-all flex items-center gap-1 cursor-pointer"
                        title="标记为已知晓"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                        <span>已知晓</span>
                      </button>
                    )}
                    <button
                      onClick={() => handleCallAI(alert)}
                      className="px-3 py-1 rounded-lg bg-primary/20 hover:bg-primary/30 border border-primary/40 text-primary text-[11px] font-medium transition-all flex items-center gap-1 cursor-pointer"
                    >
                      <Bot className="w-3.5 h-3.5" />
                      <span>呼叫 AI 解读</span>
                    </button>
                    <button
                      onClick={() => toggleExpand(alert.id)}
                      className="p-1 rounded-lg hover:bg-white/10 text-default-400 hover:text-white transition-colors cursor-pointer"
                    >
                      {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                    <button
                      onClick={() => handleDismiss(alert.id)}
                      className="p-1 rounded-lg hover:bg-white/10 text-default-400 hover:text-rose-400 transition-colors cursor-pointer"
                      title="忽略此告警"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* 展开的 3 套深度应对方案 */}
                {isExpanded && alert.decision_options && alert.decision_options.length > 0 && (
                  <div className="pt-3 border-t border-white/10 space-y-3">
                    <div className="text-xs font-semibold text-gray-200 flex items-center gap-1.5">
                      <SlidersHorizontal className="w-3.5 h-3.5 text-primary" />
                      <span>InvestScope 3 套多维决策方案对比与推演：</span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      {alert.decision_options.map((opt) => {
                        const isRecommended = opt.tag.includes("推荐") || opt.tag.includes("优化");
                        return (
                          <div
                            key={opt.key}
                            className={`p-3.5 rounded-xl border flex flex-col justify-between transition-all ${
                              isRecommended
                                ? "bg-primary/10 border-primary/40 shadow-sm"
                                : "bg-black/30 border-white/10 hover:border-white/20"
                            }`}
                          >
                            <div className="space-y-1.5">
                              <div className="flex items-center justify-between gap-1">
                                <span className="text-xs font-bold text-white truncate">
                                  {opt.name}
                                </span>
                                <span
                                  className={`text-[10px] px-1.5 py-0.5 rounded font-medium shrink-0 ${
                                    isRecommended
                                      ? "bg-primary text-primary-foreground font-semibold"
                                      : "bg-white/10 text-gray-300"
                                  }`}
                                >
                                  {opt.tag}
                                </span>
                              </div>
                              <p className="text-[11px] text-default-300 leading-relaxed line-clamp-4">
                                {opt.analysis}
                              </p>
                            </div>

                            <button
                              onClick={() => handleCallAI(alert, opt)}
                              className="mt-3 w-full py-1.5 px-2 rounded-lg bg-white/5 hover:bg-white/15 border border-white/10 hover:border-primary/30 text-xs text-gray-200 hover:text-primary transition-all flex items-center justify-center gap-1 font-medium cursor-pointer"
                            >
                              <span>AI 深入推演此方案</span>
                              <ArrowRight className="w-3 h-3" />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
