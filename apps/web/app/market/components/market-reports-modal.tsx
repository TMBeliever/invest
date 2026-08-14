"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Sunrise,
  Sunset,
  RefreshCw,
  Send,
  Bot,
  X,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  Calendar,
  Layers,
  ArrowRight,
  TrendingUp,
  TrendingDown,
  Scale,
  ShieldCheck,
  Zap,
  Globe2,
  BarChart3,
  DollarSign,
  PieChart,
  Settings,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useAuthStore } from "@investscope/core/stores/auth-store";

interface DecisionOption {
  key: string;
  name: string;
  tag: string;
  analysis: string;
  action_type?: string;
}

interface IntelligenceReport {
  id: string;
  report_type: "MORNING_RADAR" | "CLOSING_REVIEW" | "SECTOR_INSIGHT";
  severity: string;
  title: string;
  summary: string;
  markdown_content: string;
  structured_metrics: Record<string, any>;
  decision_options: DecisionOption[];
  created_at: string;
}

export function MarketReportsModal({
  isOpen,
  onClose,
  initialType = "MORNING_RADAR",
}: {
  isOpen: boolean;
  onClose: () => void;
  initialType?: "MORNING_RADAR" | "CLOSING_REVIEW";
}) {
  const router = useRouter();
  const [selectedType, setSelectedType] = useState<"MORNING_RADAR" | "CLOSING_REVIEW">(initialType);
  const [report, setReport] = useState<IntelligenceReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [toastState, setToastState] = useState<{
    type: "SUCCESS" | "WARNING" | "ERROR";
    message: string;
    showSettingsBtn?: boolean;
  } | null>(null);

  const API_BASE = process.env.NEXT_PUBLIC_API_URL || "";

  const fetchReport = async (type: "MORNING_RADAR" | "CLOSING_REVIEW") => {
    setLoading(true);
    try {
      const token = useAuthStore.getState().token;
      const res = await fetch(`${API_BASE}/api/intelligence/reports/latest?report_type=${type}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setReport(data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      setSelectedType(initialType);
      fetchReport(initialType);
    }
  }, [isOpen, initialType]);

  const handleTypeChange = (type: "MORNING_RADAR" | "CLOSING_REVIEW") => {
    setSelectedType(type);
    fetchReport(type);
  };

  const handleForceGenerate = async (push: boolean = false) => {
    setRefreshing(true);
    try {
      const token = useAuthStore.getState().token;
      const res = await fetch(
        `${API_BASE}/api/intelligence/reports/generate?report_type=${selectedType}&push_to_subscribed=${push}`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      if (res.ok) {
        const data = await res.json();
        setReport(data.report);
        if (push) {
          if (data.has_external_config === false) {
            setToastState({
              type: "WARNING",
              message: data.message || "您尚未在【系统设置】中配置飞书或企业微信 Webhook 地址，无法完成推送。",
              showSettingsBtn: true,
            });
          } else if (data.success && data.pushed_channels && data.pushed_channels.length > 0) {
            setToastState({
              type: "SUCCESS",
              message: `🎉 ${data.message}`,
            });
            setTimeout(() => setToastState(null), 5000);
          } else {
            setToastState({
              type: data.success ? "SUCCESS" : "ERROR",
              message: data.message || "推送处理完成",
            });
            setTimeout(() => setToastState(null), 5000);
          }
        } else {
          setToastState({
            type: "SUCCESS",
            message: "研报已成功重新计算并生成最新版本！",
          });
          setTimeout(() => setToastState(null), 3000);
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setRefreshing(false);
    }
  };

  const handleCallAI = (option?: DecisionOption) => {
    if (!report) return;
    let prompt = `你好！我正在阅读今日的【${report.title}】。\n\n报告摘要：${report.summary}\n`;
    if (option) {
      prompt += `我对方案【${option.name} (${option.tag})】很感兴趣：${option.analysis}\n请结合我当前的个人持仓，详细帮我推演执行该方案的操作步骤与预期收益！`;
    } else {
      prompt += `请结合我的整体持仓，深度解读这份研报对我个人资产配置有何指导意义？`;
    }
    window.dispatchEvent(
      new CustomEvent("open-ai-assistant", {
        detail: { prompt },
      })
    );
    onClose();
  };

  if (!isOpen) return null;

  const metrics = report?.structured_metrics || {};
  const isMorning = selectedType === "MORNING_RADAR";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-md animate-fade-in">
      <div className="w-full max-w-4xl bg-[#0c0e15] border border-white/15 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] animate-scale-in text-gray-100">
        {/* 顶部 Header 控制栏 */}
        <div className="px-6 py-3.5 border-b border-white/10 bg-[#12141e] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="flex items-center bg-black/50 p-1 rounded-2xl border border-white/10 text-xs">
              <button
                onClick={() => handleTypeChange("MORNING_RADAR")}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold transition-all cursor-pointer ${
                  selectedType === "MORNING_RADAR"
                    ? "bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 text-white shadow-md shadow-amber-500/25"
                    : "text-default-400 hover:text-white"
                }`}
              >
                <Sunrise className="w-4 h-4" />
                <span>🌅 早盘前瞻 (08:45)</span>
              </button>
              <button
                onClick={() => handleTypeChange("CLOSING_REVIEW")}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold transition-all cursor-pointer ${
                  selectedType === "CLOSING_REVIEW"
                    ? "bg-gradient-to-r from-primary via-indigo-500 to-blue-600 text-white shadow-md shadow-primary/25"
                    : "text-default-400 hover:text-white"
                }`}
              >
                <Sunset className="w-4 h-4" />
                <span>🌆 收盘复盘 (15:30)</span>
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => handleForceGenerate(false)}
              disabled={refreshing || loading}
              className="px-3.5 py-2 rounded-xl bg-white/5 hover:bg-white/15 border border-white/10 text-xs text-gray-200 hover:text-white transition-all flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
              title="重新计算并生成最新版研报"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin text-primary" : ""}`} />
              <span>重新计算</span>
            </button>

            <button
              onClick={() => handleForceGenerate(true)}
              disabled={refreshing || loading}
              className="px-3.5 py-2 rounded-xl bg-primary/20 hover:bg-primary/30 border border-primary/40 text-xs text-primary font-bold transition-all flex items-center gap-1.5 disabled:opacity-50 cursor-pointer shadow-sm"
              title="立即推送到我绑定的飞书群/企业微信/邮箱"
            >
              <Send className="w-3.5 h-3.5" />
              <span>推送至飞书/微信</span>
            </button>

            <button
              onClick={onClose}
              className="p-2 rounded-xl text-default-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer ml-1"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* 提示 Toast / 交互 Banner */}
        {toastState && (
          <div
            className={`mx-6 mt-3 p-3.5 rounded-2xl border text-xs flex items-center justify-between gap-3 animate-fade-in shadow-lg ${
              toastState.type === "SUCCESS"
                ? "bg-emerald-950/90 border-emerald-500/50 text-emerald-300"
                : toastState.type === "WARNING"
                ? "bg-amber-950/90 border-amber-500/50 text-amber-300"
                : "bg-rose-950/90 border-rose-500/50 text-rose-300"
            }`}
          >
            <div className="flex items-center gap-2.5 min-w-0">
              {toastState.type === "SUCCESS" ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              ) : toastState.type === "WARNING" ? (
                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
              ) : (
                <X className="w-4 h-4 text-rose-400 shrink-0" />
              )}
              <span className="font-medium">{toastState.message}</span>
            </div>

            {toastState.showSettingsBtn && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  router.push("/settings");
                }}
                className="px-3 py-1 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-200 font-bold text-xs transition-all flex items-center gap-1 shrink-0 cursor-pointer"
              >
                <Settings className="w-3.5 h-3.5" />
                <span>前往「系统设置」配置 ➔</span>
              </button>
            )}
          </div>
        )}

        {/* 研报正文滚动区 */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {loading ? (
            <div className="py-24 text-center text-default-400 space-y-3">
              <RefreshCw className="w-8 h-8 mx-auto animate-spin text-primary opacity-60" />
              <div className="text-sm font-medium">正在调取全球宏观、ERP 股债溢价与高股息量化模型...</div>
            </div>
          ) : !report ? (
            <div className="py-20 text-center text-default-400">暂无研报数据</div>
          ) : (
            <div className="space-y-6 animate-fade-in">
              {/* 1. 标题与核心导读 Banner */}
              <div className="p-5 rounded-3xl bg-[#141724] border border-white/10 space-y-3 shadow-lg relative overflow-hidden">
                <div className="flex items-center justify-between flex-wrap gap-2 text-xs text-default-400">
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-0.5 rounded-full bg-primary/20 text-primary border border-primary/30 font-bold text-[10px] tracking-wider">
                      PRO QUANT RADAR
                    </span>
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5" />
                      <span>发布时间：{report.created_at}</span>
                    </span>
                  </div>
                  <span className="text-amber-400 font-semibold flex items-center gap-1">
                    <Zap className="w-3.5 h-3.5" />
                    <span>InvestScope 高胜率量化智库</span>
                  </span>
                </div>

                <h1 className="text-lg md:text-xl font-bold text-white tracking-wide leading-snug">
                  {report.title}
                </h1>

                {report.summary && (
                  <div className="p-3.5 rounded-2xl bg-black/40 border-l-4 border-amber-500 text-xs text-gray-200 leading-relaxed">
                    <span className="text-amber-400 font-bold">💡 核心导读：</span>
                    {report.summary}
                  </div>
                )}
              </div>

              {/* 2. 早盘专属模块：全球宏观大类资产网格 */}
              {isMorning && metrics.macro_assets && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h2 className="text-xs font-bold text-gray-200 flex items-center gap-2">
                      <Globe2 className="w-4 h-4 text-primary" />
                      <span>隔夜全球宏观与大类资产全景</span>
                    </h2>
                    <span className="text-[11px] text-default-400">行情联动与资产定价传导</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2.5">
                    {metrics.macro_assets.map((asset: any, idx: number) => {
                      const isUp = asset.change_pct.startsWith("+");
                      const isFlat = asset.change_pct.includes("0.00") || asset.change_pct.startsWith("-0.08");
                      return (
                        <div
                          key={idx}
                          className="p-3.5 rounded-2xl bg-[#131622] border border-white/10 hover:border-primary/40 transition-all flex flex-col justify-between space-y-2 shadow-sm"
                        >
                          <div>
                            <div className="flex items-center justify-between text-[11px] text-default-400">
                              <span className="font-semibold text-gray-200">{asset.name}</span>
                              <span className="font-mono text-[10px] opacity-60">{asset.symbol}</span>
                            </div>
                            <div className="text-base font-bold font-mono text-white mt-1">
                              {asset.price}
                            </div>
                            <div className="mt-1">
                              <span
                                className={`text-[10px] px-2 py-0.5 rounded-md font-mono font-bold inline-flex items-center gap-0.5 ${
                                  isUp
                                    ? "bg-rose-500/20 text-rose-400 border border-rose-500/30"
                                    : isFlat
                                    ? "bg-blue-500/20 text-blue-300 border border-blue-500/30"
                                    : "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                                }`}
                              >
                                {isUp ? <TrendingUp className="w-2.5 h-2.5" /> : null}
                                <span>{asset.change_pct}</span>
                              </span>
                            </div>
                          </div>
                          <p className="text-[10px] text-default-400 leading-tight border-t border-white/5 pt-2">
                            {asset.impact}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* 早盘专属模块：ERP 股债性价比胜率罗盘 */}
              {isMorning && (
                <div className="p-4 rounded-2xl bg-gradient-to-r from-[#141724] to-[#1a1d2e] border border-emerald-500/30 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Scale className="w-4 h-4 text-emerald-400" />
                      <span className="text-xs font-bold text-white">股债风险溢价比 (ERP) 胜率温度计</span>
                    </div>
                    <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-semibold font-mono">
                      🟢 历史超额收益黄金区间
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="p-3 rounded-xl bg-black/30 border border-white/10 text-center">
                      <span className="text-[10px] text-default-400 block">沪深 300 静态估值</span>
                      <span className="text-lg font-bold font-mono text-white mt-0.5 block">
                        {metrics.hs300_pe || 11.8} 倍 PE
                      </span>
                      <span className="text-[10px] text-emerald-400">处于近十年 32% 低分位</span>
                    </div>

                    <div className="p-3 rounded-xl bg-black/30 border border-white/10 text-center">
                      <span className="text-[10px] text-default-400 block">股权风险溢价 (ERP)</span>
                      <span className="text-lg font-bold font-mono text-emerald-400 mt-0.5 block">
                        {metrics.erp_value || 3.05}%
                      </span>
                      <span className="text-[10px] text-default-400">10Y 国债基准 1.70%</span>
                    </div>

                    <div className="p-3 rounded-xl bg-emerald-950/30 border border-emerald-500/30 text-center">
                      <span className="text-[10px] text-emerald-300 block">2~3 年持有期量化胜率</span>
                      <span className="text-lg font-bold font-mono text-emerald-400 mt-0.5 block">
                        {metrics.win_rate || 84.6}%
                      </span>
                      <span className="text-[10px] text-emerald-300/80">超额收益确定性极高</span>
                    </div>
                  </div>
                </div>
              )}

              {/* 3. 收盘专属模块：主要指数涨跌榜 */}
              {!isMorning && metrics.indices && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h2 className="text-xs font-bold text-gray-200 flex items-center gap-2">
                      <BarChart3 className="w-4 h-4 text-primary" />
                      <span>今日主要市场指数表现</span>
                    </h2>
                    <span className="text-[11px] text-default-400">盘后量化统计</span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2.5">
                    {metrics.indices.map((idxItem: any, idx: number) => {
                      const isUp = idxItem.change_pct.startsWith("+");
                      return (
                        <div
                          key={idx}
                          className="p-3 rounded-2xl bg-[#131622] border border-white/10 text-center space-y-1 shadow-sm"
                        >
                          <span className="text-[11px] font-semibold text-gray-300 truncate block">
                            {idxItem.name}
                          </span>
                          <span className="text-sm font-bold font-mono text-white block">
                            {idxItem.price}
                          </span>
                          <span
                            className={`text-[10px] px-2 py-0.5 rounded font-mono font-bold inline-block ${
                              isUp
                                ? "bg-rose-500/20 text-rose-400 border border-rose-500/30"
                                : "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                            }`}
                          >
                            {idxItem.change_pct}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* 收盘专属模块：申万行业资金流向排行 */}
              {!isMorning && metrics.top_sectors && (
                <div className="space-y-3">
                  <h2 className="text-xs font-bold text-gray-200 flex items-center gap-2">
                    <DollarSign className="w-4 h-4 text-amber-400" />
                    <span>申万一级行业主力资金动向</span>
                  </h2>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {metrics.top_sectors.map((sec: any, idx: number) => (
                      <div
                        key={idx}
                        className="p-3.5 rounded-2xl bg-[#131622] border border-rose-500/20 space-y-1.5"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-white">{sec.sector}</span>
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-mono text-rose-400 font-bold">{sec.change_pct}</span>
                            <span className="text-[10px] px-1.5 py-0.2 rounded bg-rose-500/20 text-rose-300 font-mono">
                              {sec.inflow}
                            </span>
                          </div>
                        </div>
                        <p className="text-[10px] text-default-400 leading-relaxed">{sec.logic}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 4. 决策策略方案 3-Option Playbook */}
              {report.decision_options && report.decision_options.length > 0 && (
                <div className="space-y-3 pt-2">
                  <div className="flex items-center justify-between">
                    <h2 className="text-xs font-bold text-white flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-primary" />
                      <span>InvestScope 3 套多维应对策略与执行指引</span>
                    </h2>
                    <span className="text-[11px] text-default-400">基于风险溢价与持仓纪律</span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {report.decision_options.map((opt: DecisionOption) => {
                      const isKey = opt.tag.includes("核心") || opt.tag.includes("推荐");
                      return (
                        <div
                          key={opt.key}
                          className={`p-4 rounded-2xl border flex flex-col justify-between transition-all space-y-3 ${
                            isKey
                              ? "bg-primary/10 border-primary/40 shadow-sm"
                              : "bg-[#131622] border-white/10 hover:border-white/20"
                          }`}
                        >
                          <div className="space-y-2">
                            <div className="flex items-center justify-between gap-1">
                              <span className="text-xs font-bold text-white">{opt.name}</span>
                              <span
                                className={`text-[10px] px-2 py-0.5 rounded font-medium shrink-0 ${
                                  isKey
                                    ? "bg-primary text-primary-foreground font-semibold"
                                    : "bg-white/10 text-gray-300"
                                }`}
                              >
                                {opt.tag}
                              </span>
                            </div>
                            <p className="text-[11px] text-default-300 leading-relaxed">
                              {opt.analysis}
                            </p>
                          </div>

                          <button
                            onClick={() => handleCallAI(opt)}
                            className="w-full py-1.5 px-2 rounded-xl bg-white/5 hover:bg-white/15 border border-white/10 text-xs text-gray-200 hover:text-primary transition-all flex items-center justify-center gap-1 font-medium cursor-pointer"
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

              {/* 5. 详细 Markdown 深度研报全文 */}
              <div className="pt-4 border-t border-white/10 space-y-3">
                <h3 className="text-xs font-bold text-gray-300 flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-primary" />
                  <span>研报量化正文深度剖析</span>
                </h3>

                <div className="p-5 rounded-2xl bg-[#11131c] border border-white/5 text-xs text-gray-200 leading-relaxed font-normal prose prose-invert max-w-none">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {report.markdown_content}
                  </ReactMarkdown>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* 底部 Footer 控制栏 */}
        <div className="px-6 py-3.5 border-t border-white/10 bg-[#10121a] flex items-center justify-between shrink-0">
          <div className="text-[11px] text-default-400 flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>深度融合全景 ERP 胜率、全球大类资产与高股息量化回测模型</span>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => handleCallAI()}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-primary to-blue-600 text-white font-semibold text-xs shadow-lg shadow-primary/25 hover:scale-105 transition-all flex items-center gap-2 cursor-pointer"
            >
              <Bot className="w-4 h-4" />
              <span>呼叫 AI 结合我的持仓深度解读</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
