"use client";

import React, { useEffect, useState } from "react";
import {
  History,
  X,
  RotateCcw,
  Sparkles,
  User,
  Trash2,
  Edit,
  PlusCircle,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
} from "lucide-react";
import { useAssetStore, useAuthStore } from "@investscope/core";

export interface AuditLogItem {
  id: number;
  user_id: string;
  asset_id?: number;
  action: "CREATE" | "UPDATE" | "DELETE" | "BATCH_IMPORT" | "ROLLBACK" | string;
  source: "MANUAL" | "AI_OCR" | "AI_CHAT" | "ROLLBACK" | string;
  description?: string;
  before_data?: string;
  after_data?: string;
  created_at: string;
}

interface AuditLogsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const ACTION_CONFIG: Record<string, { label: string; bg: string; text: string; icon: React.ReactNode }> = {
  CREATE: { label: "新增", bg: "bg-emerald-500/15 border-emerald-500/30", text: "text-emerald-400", icon: <PlusCircle className="w-3.5 h-3.5" /> },
  BATCH_IMPORT: { label: "AI 批量入账", bg: "bg-purple-500/15 border-purple-500/30", text: "text-purple-400", icon: <Sparkles className="w-3.5 h-3.5" /> },
  UPDATE: { label: "修改", bg: "bg-amber-500/15 border-amber-500/30", text: "text-amber-400", icon: <Edit className="w-3.5 h-3.5" /> },
  DELETE: { label: "删除", bg: "bg-rose-500/15 border-rose-500/30", text: "text-rose-400", icon: <Trash2 className="w-3.5 h-3.5" /> },
  ROLLBACK: { label: "时光机回滚", bg: "bg-blue-500/15 border-blue-500/30", text: "text-blue-400", icon: <RotateCcw className="w-3.5 h-3.5" /> },
};

export function AuditLogsModal({ isOpen, onClose }: AuditLogsModalProps) {
  const [logs, setLogs] = useState<AuditLogItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [rollingBackId, setRollingBackId] = useState<number | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const token = useAuthStore.getState().token;
      const apiBase = process.env.NEXT_PUBLIC_API_URL || "";
      const res = await fetch(`${apiBase}/api/actions/audit-logs?limit=40`, {
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
      if (res.ok) {
        const data = await res.json();
        setLogs(data || []);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchLogs();
    }
  }, [isOpen]);

  const handleRollback = async (logId: number) => {
    if (rollingBackId !== null) return;
    setRollingBackId(logId);
    try {
      const token = useAuthStore.getState().token;
      const apiBase = process.env.NEXT_PUBLIC_API_URL || "";
      const res = await fetch(`${apiBase}/api/actions/rollback/${logId}`, {
        method: "POST",
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });

      if (res.ok) {
        setToastMsg("时光机回滚成功，已恢复到修改前状态！");
        setTimeout(() => setToastMsg(null), 3000);
        // 刷新列表与全局资产
        fetchLogs();
        useAssetStore.getState().fetchSummary();
      } else {
        const err = await res.json().catch(() => ({}));
        alert(`回滚失败: ${err.detail || "操作异常"}`);
      }
    } catch (e: any) {
      alert(`回滚异常: ${e.message}`);
    } finally {
      setRollingBackId(null);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4 animate-fade-in">
      <div className="w-full max-w-2xl bg-[#14161d] border border-white/10 rounded-2xl shadow-2xl flex flex-col max-h-[85vh] overflow-hidden text-xs text-foreground animate-scale-up">
        {/* Header */}
        <div className="p-4 border-b border-white/10 flex items-center justify-between bg-[#191b24]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-primary/20 text-primary flex items-center justify-center">
              <History className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <span>资产变更审计日志 & 全局时光机</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/20 text-primary border border-primary/30">
                  可逆追溯
                </span>
              </h3>
              <p className="text-[11px] text-default-400 mt-0.5">
                记录每一次 AI 识图录入与手动修改，支持随时一键逆向回滚还原
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={fetchLogs}
              disabled={loading}
              className="p-1.5 rounded-lg text-default-400 hover:text-white hover:bg-white/10 transition-colors"
              title="刷新日志"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-default-400 hover:text-white hover:bg-white/10 transition-colors"
              title="关闭"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Toast 提示条 */}
        {toastMsg && (
          <div className="bg-emerald-500/20 border-b border-emerald-500/30 text-emerald-300 px-4 py-2 text-xs flex items-center gap-1.5 animate-fade-in">
            <CheckCircle2 className="w-4 h-4" />
            <span>{toastMsg}</span>
          </div>
        )}

        {/* 日志流水列表 */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
          {loading && logs.length === 0 ? (
            <div className="py-16 text-center text-default-400">
              <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 opacity-50" />
              正在加载历史变更流水...
            </div>
          ) : logs.length === 0 ? (
            <div className="py-16 text-center text-default-500">
              暂无任何资产变更审计记录
            </div>
          ) : (
            logs.map((log) => {
              const cfg = ACTION_CONFIG[log.action] || ACTION_CONFIG.CREATE;
              const isRollback = log.action === "ROLLBACK";

              return (
                <div
                  key={log.id}
                  className={`p-3 rounded-xl border transition-all flex items-center justify-between ${
                    isRollback
                      ? "bg-[#161a24] border-blue-500/20"
                      : "bg-[#181a22] border-white/5 hover:border-white/15"
                  }`}
                >
                  <div className="flex items-start gap-3 min-w-0 pr-3">
                    <div
                      className={`p-2 rounded-xl border shrink-0 mt-0.5 ${cfg.bg} ${cfg.text}`}
                    >
                      {cfg.icon}
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={`text-[10px] px-1.5 py-0.2 rounded border font-medium ${cfg.bg} ${cfg.text}`}>
                          {cfg.label}
                        </span>
                        <span className="font-semibold text-white text-xs truncate">
                          {log.description || "资产操作"}
                        </span>
                        <span className="text-[10px] text-default-500">
                          {log.created_at?.slice(0, 19)}
                        </span>
                      </div>

                      <div className="text-[11px] text-default-400 mt-1 flex items-center gap-2">
                        <span>
                          来源:{" "}
                          <strong className="text-gray-300 font-normal">
                            {log.source === "AI_OCR"
                              ? "🤖 AI 截图识别"
                              : log.source === "AI_CHAT"
                              ? "💬 AI 对话操作"
                              : log.source === "ROLLBACK"
                              ? "↩️ 时光机还原"
                              : "👤 手动操作"}
                          </strong>
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* 回滚按钮 */}
                  {!isRollback && (
                    <button
                      type="button"
                      onClick={() => handleRollback(log.id)}
                      disabled={rollingBackId === log.id}
                      className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-rose-500/20 text-default-300 hover:text-rose-400 border border-white/10 hover:border-rose-500/30 transition-all shrink-0 flex items-center gap-1.5 text-[11px] font-medium cursor-pointer"
                      title="时光机回滚：撤销此次操作并恢复至操作前"
                    >
                      <RotateCcw className={`w-3.5 h-3.5 ${rollingBackId === log.id ? "animate-spin" : ""}`} />
                      <span>{rollingBackId === log.id ? "正在回滚..." : "回滚此操作"}</span>
                    </button>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="p-3 bg-[#121318] border-t border-white/10 flex items-center justify-between text-[11px] text-default-500">
          <span>💡 提示：点击「回滚此操作」可将数据库状态还原到该动作执行前。</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-medium transition-colors"
          >
            关闭
          </button>
        </div>
      </div>
    </div>
  );
}
