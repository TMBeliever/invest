"use client";

import React, { useMemo, useState } from "react";
import {
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Briefcase,
  Layers,
  Check,
  ChevronRight,
  TrendingUp,
  RefreshCw,
  Edit,
  Trash2,
  ArrowRight,
  ShieldAlert,
} from "lucide-react";
import { useAssetStore, useAuthStore } from "@investscope/core";
import type { AssetItem } from "@investscope/data/schemas";

export interface InvestScopeAction {
  type: "IMPORT_ASSETS" | "UPDATE_ASSET" | "DELETE_ASSET" | "ADD_WATCHLIST" | "SET_ALERT" | string;
  title?: string;
  summary?: string;
  dangerLevel?: "low" | "medium" | "high";
  payload: {
    duplicateStrategy?: "SYNC_UPDATE" | "WEIGHTED_MERGE" | "CREATE_NEW";
    items?: Array<{
      category: "STOCK" | "FUND" | "DEPOSIT" | "WEALTH" | "OTHER";
      name: string;
      code?: string;
      shares?: number;
      costPrice?: number;
      amount?: number;
      profit?: number;
      annualRate?: number;
      depositType?: string;
      fundType?: string;
      notes?: string;
    }>;
    assetId?: number;
    code?: string;
    name?: string;
    shares?: number;
    costPrice?: number;
    amount?: number;
    updates?: Record<string, any>;
    codes?: string[];
    [key: string]: any;
  };
}

interface AIActionCardProps {
  action: InvestScopeAction;
  onSuccess?: (result: { message: string; logId?: number; rollbackIds?: number[] }) => void;
}

const CATEGORY_TAGS: Record<string, { label: string; bg: string; text: string }> = {
  STOCK: { label: "股票", bg: "bg-rose-500/15 border-rose-500/30", text: "text-rose-400" },
  FUND: { label: "基金", bg: "bg-emerald-500/15 border-emerald-500/30", text: "text-emerald-400" },
  DEPOSIT: { label: "存款/现金", bg: "bg-blue-500/15 border-blue-500/30", text: "text-blue-400" },
  WEALTH: { label: "理财", bg: "bg-amber-500/15 border-amber-500/30", text: "text-amber-400" },
  OTHER: { label: "其他", bg: "bg-purple-500/15 border-purple-500/30", text: "text-purple-400" },
};

function getActionFingerprint(action: InvestScopeAction): string {
  const items = action.payload?.items || [];
  const itemsSignature = items
    .map((it) => `${it.category}:${it.code || it.name}:${it.shares || it.amount || 0}:${it.costPrice || 0}`)
    .sort()
    .join("|");
  const payloadStr = itemsSignature || JSON.stringify(action.payload || {});
  return `${action.type}_${payloadStr}`;
}

function isActionExecutedLocally(fingerprint: string): boolean {
  if (typeof window === "undefined") return false;
  try {
    const raw = localStorage.getItem("investscope-executed-actions");
    if (!raw) return false;
    const list: string[] = JSON.parse(raw);
    return Array.isArray(list) && list.includes(fingerprint);
  } catch {
    return false;
  }
}

function markActionExecutedLocally(fingerprint: string) {
  if (typeof window === "undefined") return;
  try {
    const raw = localStorage.getItem("investscope-executed-actions");
    const list: string[] = raw ? JSON.parse(raw) : [];
    if (!list.includes(fingerprint)) {
      list.push(fingerprint);
      if (list.length > 300) list.shift();
      localStorage.setItem("investscope-executed-actions", JSON.stringify(list));
    }
  } catch {
    // ignore
  }
}

export function AIActionCard({ action, onSuccess }: AIActionCardProps) {
  const existingAssets: AssetItem[] = useAssetStore((s) => s.summary?.assets || []);
  const items = action.payload?.items || [];
  
  const [selectedIndices, setSelectedIndices] = useState<number[]>(() => items.map((_, i) => i));
  const [strategy, setStrategy] = useState<"SYNC_UPDATE" | "WEIGHTED_MERGE" | "CREATE_NEW">(
    action.payload?.duplicateStrategy || "SYNC_UPDATE"
  );

  const fingerprint = useMemo(() => getActionFingerprint(action), [action]);
  const [executing, setExecuting] = useState(false);
  const [executed, setExecuted] = useState(() => isActionExecutedLocally(fingerprint));
  const [error, setError] = useState<string | null>(null);

  const toggleSelect = (index: number) => {
    if (executed) return;
    setSelectedIndices((prev) =>
      prev.includes(index) ? prev.filter((i) => i !== index) : [...prev, index]
    );
  };

  const toggleSelectAll = () => {
    if (executed) return;
    if (selectedIndices.length === items.length) {
      setSelectedIndices([]);
    } else {
      setSelectedIndices(items.map((_, i) => i));
    }
  };

  const handleExecute = async () => {
    if (executing || executed) return;
    if (action.type === "IMPORT_ASSETS" && selectedIndices.length === 0) return;

    setExecuting(true);
    setError(null);

    const selectedItems = selectedIndices.map((i) => items[i]);

    try {
      const token = useAuthStore.getState().token;
      const apiBase = process.env.NEXT_PUBLIC_API_URL || "";
      const res = await fetch(`${apiBase}/api/actions/execute`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          type: action.type,
          title: action.title,
          summary: action.summary,
          payload: {
            ...action.payload,
            duplicateStrategy: strategy,
            items: selectedItems,
          },
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail || `执行失败 (HTTP ${res.status})`);
      }

      const result = await res.json();
      setExecuted(true);
      markActionExecutedLocally(fingerprint);
      
      // 刷新全局资产数据
      useAssetStore.getState().fetchSummary();

      if (onSuccess) {
        onSuccess({
          message: result.message || "操作已成功执行",
          rollbackIds: result.ids,
        });
      }
    } catch (e: any) {
      setError(e.message || "执行操作异常，请重试");
    } finally {
      setExecuting(false);
    }
  };

  // 1. 资产批量导入 / 加仓 / 识别卡片
  if (action.type === "IMPORT_ASSETS") {
    const selectedCount = selectedIndices.length;
    const totalEstValue = selectedIndices.reduce((acc, idx) => {
      const item = items[idx];
      if (item.amount) return acc + item.amount;
      if (item.shares && item.costPrice) return acc + item.shares * item.costPrice;
      return acc;
    }, 0);

    return (
      <div className="my-3 rounded-2xl bg-[#15171e] border border-primary/30 shadow-xl overflow-hidden text-xs text-foreground">
        {/* 卡片头部 */}
        <div className="px-3.5 py-2.5 bg-gradient-to-r from-primary/20 via-[#181b24] to-[#181b24] border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-primary/20 text-primary flex items-center justify-center shrink-0">
              <Briefcase className="w-3.5 h-3.5" />
            </div>
            <div>
              <div className="font-bold text-white text-[12px] flex items-center gap-1.5">
                <span>{action.title || "AI 识别持仓待入账确认"}</span>
                <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  可交互卡片
                </span>
              </div>
              <div className="text-[10px] text-default-400 mt-0.5">
                {action.summary || `共提取出 ${items.length} 笔标的，请核对后确认入库`}
              </div>
            </div>
          </div>
          {!executed && items.length > 1 && (
            <button
              type="button"
              onClick={toggleSelectAll}
              className="text-[10px] text-primary hover:underline"
            >
              {selectedIndices.length === items.length ? "取消全选" : "全选"}
            </button>
          )}
        </div>

        {/* 策略切换栏 */}
        {!executed && items.length > 0 && (
          <div className="px-3 py-1.5 bg-[#12141a] border-b border-white/5 flex items-center justify-between text-[10px] text-default-400">
            <span>遇到已有标的策略:</span>
            <div className="flex items-center gap-1 bg-[#1a1d26] p-0.5 rounded-lg border border-white/10">
              <button
                type="button"
                onClick={() => setStrategy("SYNC_UPDATE")}
                className={`px-2 py-0.5 rounded-md transition-colors ${
                  strategy === "SYNC_UPDATE"
                    ? "bg-primary text-white font-medium shadow-xs"
                    : "text-default-400 hover:text-white"
                }`}
                title="以最新截图数据覆盖旧记录"
              >
                🔄 覆盖同步
              </button>
              <button
                type="button"
                onClick={() => setStrategy("WEIGHTED_MERGE")}
                className={`px-2 py-0.5 rounded-md transition-colors ${
                  strategy === "WEIGHTED_MERGE"
                    ? "bg-primary text-white font-medium shadow-xs"
                    : "text-default-400 hover:text-white"
                }`}
                title="与已有持仓合并股数并计算加权平均成本"
              >
                ➕ 加仓合并
              </button>
              <button
                type="button"
                onClick={() => setStrategy("CREATE_NEW")}
                className={`px-2 py-0.5 rounded-md transition-colors ${
                  strategy === "CREATE_NEW"
                    ? "bg-primary text-white font-medium shadow-xs"
                    : "text-default-400 hover:text-white"
                }`}
                title="作为独立记录新增"
              >
                📦 独立新增
              </button>
            </div>
          </div>
        )}

        {/* 资产列表 */}
        <div className="p-2.5 space-y-1.5 max-h-64 overflow-y-auto">
          {items.map((item, idx) => {
            const isChecked = selectedIndices.includes(idx);
            const tag = CATEGORY_TAGS[item.category] || CATEGORY_TAGS.STOCK;
            const itemVal = item.amount || (item.shares && item.costPrice ? item.shares * item.costPrice : 0);

            // 查找已有持仓匹配
            const matchedExisting = existingAssets.find(
              (a: AssetItem) => (item.code && a.code === item.code) || (item.name && a.name === item.name)
            );

            return (
              <div
                key={idx}
                onClick={() => toggleSelect(idx)}
                className={`p-2 rounded-xl border transition-all flex items-center justify-between cursor-pointer ${
                  isChecked
                    ? "bg-[#1c1f2a] border-primary/40 shadow-xs"
                    : "bg-[#131418] border-white/5 opacity-50 hover:opacity-80"
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div
                    className={`w-4 h-4 rounded border flex items-center justify-center transition-colors shrink-0 ${
                      isChecked
                        ? "bg-primary border-primary text-white"
                        : "border-white/30 bg-black/20"
                    }`}
                  >
                    {isChecked && <Check className="w-3 h-3 stroke-[3]" />}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 truncate">
                      <span className="font-semibold text-white text-[11px] truncate">
                        {item.name}
                      </span>
                      {item.code && (
                        <span className="text-[10px] text-default-400 font-mono">
                          ({item.code})
                        </span>
                      )}
                      <span
                        className={`text-[9px] px-1 py-0.2 rounded border ${tag.bg} ${tag.text}`}
                      >
                        {tag.label}
                      </span>
                      {matchedExisting ? (
                        <span className="text-[9px] px-1 py-0.2 rounded bg-blue-500/15 text-blue-300 border border-blue-500/30">
                          {strategy === "SYNC_UPDATE"
                            ? "🔄 覆盖更新"
                            : strategy === "WEIGHTED_MERGE"
                            ? "➕ 加仓合并"
                            : "已有持仓"}
                        </span>
                      ) : (
                        <span className="text-[9px] px-1 py-0.2 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                          ✨ 新增标的
                        </span>
                      )}
                    </div>
                    <div className="text-[10px] text-default-400 mt-0.5 flex items-center gap-1.5 flex-wrap">
                      {item.shares != null && item.costPrice != null ? (
                        <span>
                          {item.shares.toLocaleString()}股 · 成本 ¥{item.costPrice.toFixed(3)}
                        </span>
                      ) : item.amount != null ? (
                        <span>本金 ¥{((item.amount || 0) - (item.profit || 0)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                      ) : null}
                      {item.profit != null ? (
                        <span className={`font-semibold ${item.profit >= 0 ? "text-rose-400" : "text-emerald-400"}`}>
                          · 浮盈 {item.profit >= 0 ? "+" : ""}¥{item.profit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      ) : null}
                      {item.notes ? <span className="text-default-500">({item.notes})</span> : null}
                    </div>
                  </div>
                </div>

                <div className="text-right shrink-0 pl-2">
                  <div className="font-medium text-white text-[11px]">
                    ¥{itemVal ? itemVal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "--"}
                  </div>
                  <div className="text-[9px] text-default-400">市值</div>
                </div>
              </div>
            );
          })}
        </div>

        {/* 错误提示 */}
        {error && (
          <div className="mx-2.5 mb-2 p-2 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 text-[10px] flex items-center gap-1">
            <AlertCircle className="w-3 h-3 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* 底部确认操作栏 */}
        <div className="px-3 py-2.5 bg-[#121317] border-t border-white/10 flex items-center justify-between">
          <div className="text-[10px] text-default-400">
            {executed ? (
              <span className="text-emerald-400 flex items-center gap-1 font-medium">
                <CheckCircle2 className="w-3.5 h-3.5" /> 已成功入账并同步
              </span>
            ) : (
              <span>
                已勾选 <strong className="text-white">{selectedCount}</strong> 项 · 预估总额{" "}
                <strong className="text-amber-300">
                  ¥{totalEstValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </strong>
              </span>
            )}
          </div>

          <div>
            {executed ? (
              <button
                type="button"
                disabled
                className="px-3 py-1.5 rounded-xl bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[11px] font-medium flex items-center gap-1 cursor-default"
              >
                <Check className="w-3.5 h-3.5" />
                <span>入账完成</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={handleExecute}
                disabled={executing || selectedCount === 0}
                className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-primary to-blue-600 hover:from-primary/90 hover:to-blue-500 text-white text-[11px] font-semibold shadow-md shadow-primary/20 disabled:opacity-40 transition-all flex items-center gap-1.5 cursor-pointer"
              >
                {executing ? (
                  <span>正在入库...</span>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                    <span>一键确认执行 ({selectedCount})</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // 2. 自然语言资产修改卡片 (UPDATE_ASSET)
  if (action.type === "UPDATE_ASSET") {
    const targetAsset = existingAssets.find(
      (a: AssetItem) => (action.payload?.code && a.code === action.payload.code) ||
             (action.payload?.name && a.name === action.payload.name) ||
             (action.payload?.assetId && a.id === action.payload.assetId)
    );
    const updates = action.payload?.updates || {};

    return (
      <div className="my-3 rounded-2xl bg-[#15171e] border border-amber-500/40 shadow-xl overflow-hidden text-xs text-foreground">
        <div className="px-3.5 py-2.5 bg-gradient-to-r from-amber-500/20 via-[#181b24] to-[#181b24] border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-amber-500/20 text-amber-300 flex items-center justify-center shrink-0">
              <Edit className="w-3.5 h-3.5" />
            </div>
            <div>
              <div className="font-bold text-white text-[12px] flex items-center gap-1.5">
                <span>{action.title || "修改持仓信息确认"}</span>
                <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  自然语言变更
                </span>
              </div>
              <div className="text-[10px] text-default-400 mt-0.5">
                {action.summary || `修改【${targetAsset?.name || action.payload?.name || "标的"}】的持仓参数`}
              </div>
            </div>
          </div>
        </div>

        {/* 变更 Diff 内容 */}
        <div className="p-3 bg-[#181a24] space-y-2">
          <div className="font-semibold text-white text-xs flex items-center gap-1.5">
            <span>{targetAsset?.name || action.payload?.name}</span>
            {targetAsset?.code && <span className="text-default-400 font-mono">({targetAsset.code})</span>}
          </div>

          <div className="p-2.5 rounded-xl bg-[#13141a] border border-white/10 space-y-1.5 text-[11px]">
            {Object.entries(updates).map(([k, v]) => {
              const oldVal = targetAsset ? (targetAsset as any)[k] || (targetAsset as any)[k === "costPrice" ? "cost_price" : k] : "--";
              const labelMap: Record<string, string> = {
                costPrice: "成本单价",
                shares: "持仓股数",
                amount: "本金金额",
                annualRate: "年化利率",
                notes: "备注",
              };
              return (
                <div key={k} className="flex items-center justify-between text-default-300">
                  <span>{labelMap[k] || k}:</span>
                  <div className="flex items-center gap-2 font-mono">
                    <span className="line-through text-default-500">¥{oldVal}</span>
                    <ArrowRight className="w-3 h-3 text-amber-400" />
                    <span className="font-bold text-amber-300">¥{String(v)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* 底部确认按钮 */}
        <div className="px-3 py-2 bg-[#121317] border-t border-white/10 flex items-center justify-between">
          <span className="text-[10px] text-default-400">
            {executed ? "已完成修改，支持时光机随时撤销" : "请核对修改项，点击确认生效"}
          </span>
          <button
            type="button"
            onClick={handleExecute}
            disabled={executing || executed}
            className="px-3.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black text-[11px] font-bold shadow-md shadow-amber-500/20 disabled:opacity-40 transition-all flex items-center gap-1 cursor-pointer"
          >
            {executed ? <Check className="w-3.5 h-3.5" /> : null}
            <span>{executed ? "修改已生效" : executing ? "正在修改..." : "确认修改"}</span>
          </button>
        </div>
      </div>
    );
  }

  // 3. 自然语言一键清空全部资产卡片 (CLEAR_ALL_ASSETS)
  if (
    action.type === "CLEAR_ALL_ASSETS" ||
    action.type === "CLEAR_ASSETS" ||
    action.type === "DELETE_ALL_ASSETS" ||
    action.type === "DELETE_ALL" ||
    (action.type === "DELETE_ASSET" && (action.payload?.code === "ALL" || action.payload?.name === "全部资产" || action.payload?.name === "所有资产"))
  ) {
    const totalCount = existingAssets.length;
    const totalValue = existingAssets.reduce((sum, a) => {
      const v = a.currentValue || (a.shares && a.costPrice ? a.shares * a.costPrice : a.amount) || 0;
      return sum + Number(v);
    }, 0);

    return (
      <div className="my-3 rounded-2xl bg-[#1c0f12] border border-rose-500/60 shadow-2xl overflow-hidden text-xs text-foreground animate-scale-in">
        <div className="px-3.5 py-2.5 bg-gradient-to-r from-rose-600/30 via-[#261015] to-[#261015] border-b border-rose-500/30 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-rose-500/20 text-rose-400 flex items-center justify-center shrink-0">
              <ShieldAlert className="w-4 h-4 text-rose-400 animate-pulse" />
            </div>
            <div>
              <div className="font-bold text-rose-300 text-[12px] flex items-center gap-1.5">
                <span>{action.title || "清空全部持仓资产确认"}</span>
                <span className="text-[10px] px-1.5 py-0.2 rounded bg-rose-500/30 text-rose-200 border border-rose-500/40 font-semibold">
                  ⚠️ 极高危操作
                </span>
              </div>
              <div className="text-[10px] text-rose-300/80 mt-0.5">
                {action.summary || `将清空当前账本中的全部资产 (共 ${totalCount} 笔标的)`}
              </div>
            </div>
          </div>
        </div>

        <div className="p-3.5 bg-[#180c0f] space-y-2.5">
          <div className="flex items-center justify-between p-2.5 rounded-xl bg-black/40 border border-rose-500/20 text-[11px]">
            <span className="text-default-400">待清空标的总数:</span>
            <span className="font-bold text-white font-mono">{totalCount} 笔</span>
          </div>

          {totalValue > 0 && (
            <div className="flex items-center justify-between p-2.5 rounded-xl bg-black/40 border border-rose-500/20 text-[11px]">
              <span className="text-default-400">待清空资产总估值:</span>
              <span className="font-bold text-rose-400 font-mono">
                ¥{totalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
          )}

          <p className="text-[11px] text-default-400 leading-relaxed">
            确认后将彻底清空当前个人账本中的全部持仓数据。系统将在执行前自动创建全量快照，如需撤销可随时前往「时光机审计」一键逆向还原！
          </p>

          {error && (
            <div className="p-2 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 text-[10px] flex items-center gap-1">
              <AlertCircle className="w-3 h-3 shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </div>

        <div className="px-3.5 py-2.5 bg-[#14080a] border-t border-rose-500/20 flex items-center justify-between">
          <span className="text-[10px] text-default-400">
            {executed ? "全部资产已清空" : "数据支持时光机全量回滚"}
          </span>
          <button
            type="button"
            onClick={handleExecute}
            disabled={executing || executed}
            className="px-4 py-1.5 rounded-xl bg-gradient-to-r from-rose-600 to-red-700 hover:from-rose-500 hover:to-red-600 text-white text-[11px] font-bold shadow-lg shadow-rose-600/30 disabled:opacity-40 transition-all flex items-center gap-1.5 cursor-pointer"
          >
            {executed ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-300" />
                <span>已成功清空</span>
              </>
            ) : (
              <>
                <Trash2 className="w-3.5 h-3.5" />
                <span>{executing ? "正在清空..." : `一键确认清空全部 (${totalCount}笔)`}</span>
              </>
            )}
          </button>
        </div>
      </div>
    );
  }

  // 4. 自然语言资产清仓/删除卡片 (DELETE_ASSET)
  if (action.type === "DELETE_ASSET") {
    const targetAsset = existingAssets.find(
      (a: AssetItem) => (action.payload?.code && a.code === action.payload.code) ||
             (action.payload?.name && a.name === action.payload.name) ||
             (action.payload?.assetId && a.id === action.payload.assetId)
    );

    return (
      <div className="my-3 rounded-2xl bg-[#1a1417] border border-rose-500/40 shadow-xl overflow-hidden text-xs text-foreground">
        <div className="px-3.5 py-2.5 bg-gradient-to-r from-rose-500/20 via-[#20151a] to-[#20151a] border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-rose-500/20 text-rose-400 flex items-center justify-center shrink-0">
              <ShieldAlert className="w-3.5 h-3.5" />
            </div>
            <div>
              <div className="font-bold text-rose-300 text-[12px] flex items-center gap-1.5">
                <span>{action.title || "清仓移除资产确认"}</span>
                <span className="text-[10px] px-1.5 py-0.2 rounded bg-rose-500/20 text-rose-300 border border-rose-500/30">
                  高危操作
                </span>
              </div>
              <div className="text-[10px] text-default-400 mt-0.5">
                {action.summary || `将【${targetAsset?.name || action.payload?.name || "标的"}】从持仓账本中彻底移除`}
              </div>
            </div>
          </div>
        </div>

        <div className="p-3 bg-[#1c1417] text-default-300 text-[11px]">
          <div className="font-semibold text-white text-xs mb-1">
            {targetAsset?.name || action.payload?.name}
            {targetAsset?.code && <span className="text-default-400 font-mono ml-1">({targetAsset.code})</span>}
          </div>
          <p className="text-default-400">
            确认清仓后，该标的将从持仓明细和总资产计算中移除（操作记录将完整保存至时光机，可随时一键还原）。
          </p>
        </div>

        <div className="px-3 py-2 bg-[#140e11] border-t border-white/10 flex items-center justify-between">
          <span className="text-[10px] text-default-400">
            {executed ? "已从账本移除" : "操作不可逆（但可通过时光机回滚）"}
          </span>
          <button
            type="button"
            onClick={handleExecute}
            disabled={executing || executed}
            className="px-3.5 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-[11px] font-bold shadow-md shadow-rose-600/20 disabled:opacity-40 transition-all flex items-center gap-1 cursor-pointer"
          >
            {executed ? <Check className="w-3.5 h-3.5" /> : <Trash2 className="w-3.5 h-3.5" />}
            <span>{executed ? "已清仓移除" : executing ? "正在移除..." : "确认清仓移除"}</span>
          </button>
        </div>
      </div>
    );
  }

  // 默认其它通用 Action 渲染
  return (
    <div className="my-2.5 p-3 rounded-xl bg-[#16181f] border border-primary/30 text-xs">
      <div className="font-semibold text-white mb-1">{action.title || "待执行操作"}</div>
      <div className="text-default-400 text-[11px]">{action.summary || "AI 提议的变更"}</div>
      <button
        onClick={handleExecute}
        disabled={executing || executed}
        className="mt-2.5 px-3 py-1.5 rounded-lg bg-primary text-white text-[11px] font-medium"
      >
        {executed ? "已完成" : executing ? "正在执行..." : "确认执行"}
      </button>
    </div>
  );
}
