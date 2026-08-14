"use client";

import { useEffect, useState } from "react";
import { apiClient } from "@investscope/core";
import type { AIDiagnose } from "@investscope/data/schemas";
import { Sparkles, ShieldCheck, TrendingUp, AlertTriangle, RefreshCw, Bot } from "lucide-react";

export function AIPortfolioCard({ onViewXRay }: { onViewXRay?: () => void }) {
  const [data, setData] = useState<AIDiagnose | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchDiagnose = async () => {
    setLoading(true);
    try {
      const res = await apiClient.get<AIDiagnose>("/api/ai/diagnose");
      setData(res);
    } catch {
      // ignore error
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDiagnose();
  }, []);

  if (!data && !loading) return null;

  return (
    <div className="glass-panel p-5 relative overflow-hidden border border-primary/20 bg-gradient-to-br from-primary/5 via-transparent to-emerald-500/5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-default-100/50">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-primary/15 text-primary">
            <Bot className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-sm tracking-tight">InvestScope AI 组合体检报告</h3>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                <Sparkles className="w-3 h-3" /> 健康度分值 {data?.score ?? "--"} 分 ({data?.scoreLabel ?? "良好"})
              </span>
            </div>
            <p className="text-[11px] text-default-400 mt-0.5">
              基于您当前真实持仓上下文 + 10年国债收益率 ({data?.bondYield10y ?? 1.71}%) + 盘中多市场实时行情自动生成
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 self-start sm:self-auto">
          {onViewXRay && (
            <button
              onClick={onViewXRay}
              className="px-3 py-1.5 rounded-xl bg-primary/20 hover:bg-primary/30 text-primary border border-primary/30 text-xs font-semibold transition-all flex items-center gap-1 cursor-pointer"
            >
              <span>🩻 展开全景 X 光透视 ➔</span>
            </button>
          )}
          <button
            onClick={fetchDiagnose}
            disabled={loading}
            className="text-xs text-default-400 hover:text-primary transition-colors flex items-center gap-1 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin text-primary" : ""}`} />
            <span>刷新</span>
          </button>
        </div>
      </div>

      <div className="mt-3.5 space-y-2.5">
        {data?.diagnosisText.map((text: string, idx: number) => (
          <div key={idx} className="flex items-start gap-2 text-xs text-default-300">
            {idx === 0 && <TrendingUp className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />}
            {idx === 1 && <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />}
            {idx === 2 && <ShieldCheck className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />}
            <span className="leading-relaxed">{text}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
