"use client";

import { useEffect, useMemo, useState } from "react";
import { useAssetStore, apiClient } from "@investscope/core";
import { AssetAllocationChart, SegmentedTabs } from "@investscope/ui";
import type { AssetCategory, AssetItem, AssetPayload } from "@investscope/data/schemas";
import { AIPortfolioCard } from "../components/ai-portfolio-card";
import {
  Wallet,
  Plus,
  RefreshCw,
  Pencil,
  Trash2,
  X,
  AlertTriangle,
  History,
  Activity,
  ShieldAlert,
} from "lucide-react";
import { AuditLogsModal } from "../components/audit-logs-modal";
import { XRayDashboard } from "./components/xray-dashboard";
import { SentinelRadarDashboard } from "./components/sentinel-radar";

const CATEGORY_META: Record<AssetCategory, { label: string; color: string; icon: string }> = {
  DEPOSIT: { label: "存款", color: "text-blue-400", icon: "💰" },
  STOCK: { label: "股票", color: "text-red-400", icon: "📈" },
  FUND: { label: "基金", color: "text-emerald-400", icon: "📊" },
  WEALTH: { label: "理财", color: "text-amber-400", icon: "🏦" },
  OTHER: { label: "其他", color: "text-violet-400", icon: "📦" },
};

const CATEGORY_TABS: { key: AssetCategory | "ALL"; label: string }[] = [
  { key: "ALL", label: "全部" },
  { key: "DEPOSIT", label: "💰 存款" },
  { key: "STOCK", label: "📈 股票" },
  { key: "FUND", label: "📊 基金" },
  { key: "WEALTH", label: "🏦 理财" },
  { key: "OTHER", label: "📦 其他" },
];

const PAYOUT_LABELS: Record<string, string> = {
  MATURITY: "到期付息",
  MONTHLY: "按月派息",
  QUARTERLY: "按季结息",
  ANNUAL: "按年派息",
};

const EMPTY_FORM: AssetPayload = {
  category: "DEPOSIT",
  name: "",
  code: "",
  amount: undefined,
  shares: undefined,
  costPrice: undefined,
  annualRate: undefined,
  depositType: "DEMAND",
  startDate: "",
  maturityDate: "",
  payoutMethod: "MATURITY",
  fundType: "EXCHANGE",
  notes: "",
};

function formatMoney(n: number | null | undefined) {
  if (n === null || n === undefined || isNaN(n)) return "--";
  return `¥${n.toLocaleString("zh-CN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatPrice(n: number | null | undefined, isFundOrEtf = false) {
  if (n === null || n === undefined || isNaN(n)) return "--";
  // 基金/场内ETF 或单价小于 100 元的持仓单价，统一保留 4 位高精度单价（如 1.1500 / 1.1510 / 1.1128）
  const digits = isFundOrEtf || (n > 0 && n < 100) ? 4 : 2;
  return n.toLocaleString("zh-CN", { minimumFractionDigits: digits, maximumFractionDigits: 4 });
}

export default function AssetsPage() {
  const { summary, loading, fetchSummary, addAsset, updateAsset, deleteAsset } = useAssetStore();
  const [filterCategory, setFilterCategory] = useState<AssetCategory | "ALL">("ALL");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<AssetPayload>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [deleteConfirmAsset, setDeleteConfirmAsset] = useState<AssetItem | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [auditLogsOpen, setAuditLogsOpen] = useState(false);
  const [activeView, setActiveView] = useState<"LIST" | "XRAY" | "SENTINEL">("LIST");

  useEffect(() => {
    fetchSummary();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const assets = summary?.assets ?? [];
  const allocation = summary?.allocation ?? [];
  const s = summary?.summary;

  const filteredAssets = useMemo(
    () => (filterCategory === "ALL" ? assets : assets.filter((a) => a.category === filterCategory)),
    [assets, filterCategory]
  );

  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupInfo, setLookupInfo] = useState<{ name: string; currentPrice?: number; category?: string; found: boolean } | null>(null);

  const handleCodeChange = async (val: string) => {
    const code = val.trim().toUpperCase();
    setForm((f) => ({ ...f, code }));
    if (!code || code.length < 2) {
      setLookupInfo(null);
      return;
    }

    setLookupLoading(true);
    try {
      const res = await apiClient.get<{
        code: string;
        name: string;
        category: AssetCategory;
        fundType: "EXCHANGE" | "OTC" | null;
        currentPrice: number | null;
        dividendYield: number | null;
        found: boolean;
      }>(`/api/assets/lookup?code=${encodeURIComponent(code)}`);

      if (res.found && res.name) {
        setLookupInfo({
          name: res.name,
          currentPrice: res.currentPrice ?? undefined,
          category: res.category,
          found: true,
        });
        setForm((f) => ({
          ...f,
          name: res.name,
          category: res.category,
          fundType: res.fundType ?? f.fundType,
          // 仅当用户未填写成本价时，默认填入当前现价/净值作为建议
          costPrice: f.costPrice ?? (res.currentPrice ? Number(res.currentPrice.toFixed(4)) : undefined),
        }));
      } else {
        setLookupInfo(null);
      }
    } catch {
      setLookupInfo(null);
    } finally {
      setLookupLoading(false);
    }
  };

  const openAddModal = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setLookupInfo(null);
    setFormError(null);
    setModalOpen(true);
  };

  const applyQuickTerm = (years: number) => {
    const startStr = form.startDate || new Date().toISOString().split("T")[0];
    const dt = new Date(startStr);
    if (!isNaN(dt.getTime())) {
      dt.setFullYear(dt.getFullYear() + years);
      const maturityStr = dt.toISOString().split("T")[0];
      setForm((f) => ({
        ...f,
        startDate: startStr,
        maturityDate: maturityStr,
      }));
    }
  };

  const openEditModal = (asset: AssetItem) => {
    setEditingId(asset.id);
    setLookupInfo(null);
    setForm({
      category: asset.category,
      name: asset.name,
      code: asset.code || "",
      amount: asset.amount ?? undefined,
      shares: asset.shares ?? undefined,
      costPrice: asset.costPrice ?? undefined,
      annualRate: asset.annualRate ?? undefined,
      depositType: asset.depositType ?? "DEMAND",
      startDate: asset.startDate || "",
      maturityDate: asset.maturityDate || "",
      payoutMethod: asset.payoutMethod ?? "MATURITY",
      fundType: asset.fundType ?? "EXCHANGE",
      notes: asset.notes || "",
    });
    setFormError(null);
    setModalOpen(true);
  };

  const confirmDelete = async () => {
    if (!deleteConfirmAsset) return;
    setDeleting(true);
    try {
      await deleteAsset(deleteConfirmAsset.id);
      setDeleteConfirmAsset(null);
    } finally {
      setDeleting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!form.name.trim()) {
      setFormError("请填写资产名称");
      return;
    }
    if ((form.category === "STOCK" || form.category === "FUND") && !form.code?.trim()) {
      setFormError("股票/基金需要填写代码");
      return;
    }
    if (form.category === "FUND" && !form.fundType) {
      setFormError("请选择基金类型：场内 ETF 或场外基金");
      return;
    }

    setSubmitting(true);
    try {
      if (editingId !== null) {
        await updateAsset(editingId, form);
      } else {
        await addAsset(form);
      }
      setModalOpen(false);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "保存失败");
    } finally {
      setSubmitting(false);
    }
  };

  const isPositionCategory = form.category === "STOCK" || form.category === "FUND";
  const isRateCategory = form.category === "DEPOSIT" || form.category === "WEALTH";
  const isFundCategory = form.category === "FUND";

  return (
    <div className="p-6 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Wallet className="w-6 h-6 text-blue-500" />
            我的资产
          </h1>
          <p className="text-sm text-default-400 mt-1">存款 · 股票 · 基金 · 理财 · 其他 全品类统一管理</p>
        </div>
        <div className="flex items-center gap-3">
          {loading["summary"] && <RefreshCw className="w-4 h-4 animate-spin text-default-400" />}
          <button
            onClick={() => setAuditLogsOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-default-100 hover:bg-default-200 text-default-300 hover:text-white text-sm font-medium transition-colors border border-white/5 cursor-pointer"
            title="查看全量资产变更日志与时光机回滚"
          >
            <History className="w-4 h-4 text-primary" />
            <span className="hidden sm:inline">变更记录 & 时光机</span>
          </button>
          <button
            onClick={openAddModal}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-white text-sm font-medium hover:bg-primary/90 transition-colors shadow-lg shadow-primary/25 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            添加资产
          </button>
        </div>
      </div>

      {/* 顶部主视图切换器 */}
      <div className="flex items-center gap-1.5 bg-[#14161f] p-1.5 rounded-2xl border border-white/10 mb-6 max-w-fit shadow-md">
        <button
          type="button"
          onClick={() => setActiveView("LIST")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeView === "LIST"
              ? "bg-primary text-white shadow-md shadow-primary/25"
              : "text-default-400 hover:text-white hover:bg-white/5"
          }`}
        >
          <Wallet className="w-3.5 h-3.5" />
          <span>📋 资产明细账本</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveView("XRAY")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeView === "XRAY"
              ? "bg-gradient-to-r from-primary to-blue-600 text-white shadow-md shadow-primary/25"
              : "text-default-400 hover:text-white hover:bg-white/5"
          }`}
        >
          <Activity className="w-3.5 h-3.5" />
          <span>🩻 组合全景 X 光透视</span>
          <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
            PRO
          </span>
        </button>
        <button
          type="button"
          onClick={() => setActiveView("SENTINEL")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeView === "SENTINEL"
              ? "bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500 text-white shadow-md shadow-amber-500/25"
              : "text-default-400 hover:text-white hover:bg-white/5"
          }`}
        >
          <ShieldAlert className="w-3.5 h-3.5" />
          <span>🛡️ 智能哨兵与风控雷达</span>
          <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30">
            PRO
          </span>
        </button>
      </div>

      {activeView === "SENTINEL" ? (
        /* 智能哨兵雷达视图 */
        <SentinelRadarDashboard />
      ) : activeView === "XRAY" ? (
        /* X-Ray 全景透视看板 */
        <XRayDashboard
          onAskAI={(prompt) => {
            window.dispatchEvent(new CustomEvent("open-ai-assistant", { detail: { prompt } }));
          }}
        />
      ) : (
        /* 资产明细账本主视图 */
        <>
          {/* AI 组合体检卡片 */}
          <div className="mb-6">
            <AIPortfolioCard onViewXRay={() => setActiveView("XRAY")} />
          </div>

          {/* 汇总卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="glass-panel p-5 animate-fade-in">
          <span className="text-xs text-default-400">总资产净值</span>
          <div className="text-2xl font-bold mt-1">{formatMoney(s?.totalValue)}</div>
        </div>
        <div className="glass-panel p-5 animate-fade-in">
          <span className="text-xs text-default-400">持仓总浮盈 (资本利得)</span>
          <div className={`text-2xl font-bold mt-1 ${(s?.totalProfit ?? 0) >= 0 ? "text-rise" : "text-fall"}`}>
            {(s?.totalProfit ?? 0) >= 0 ? "+" : ""}{formatMoney(s?.totalProfit)}
          </div>
          <span className={`text-xs font-medium block mt-1 ${(s?.totalProfitPct ?? 0) >= 0 ? "text-rise" : "text-fall"}`}>
            {(s?.totalProfitPct ?? 0) >= 0 ? "+" : ""}{s?.totalProfitPct ?? 0}%
          </span>
        </div>
        <div className="glass-panel p-5 animate-fade-in relative group cursor-help">
          <span className="text-xs text-default-400 border-b border-dashed border-default-400/50">预估年收益 (现金流)</span>
          <div className="text-2xl font-bold text-emerald-400 mt-1">{formatMoney(s?.estimatedAnnualIncome)}/年</div>
          <p className="text-[10px] text-default-400 mt-1">包含存款利息、理财收益与股票预估年分红</p>
        </div>
        <div className="glass-panel p-5 animate-fade-in">
          <span className="text-xs text-default-400">资产项数</span>
          <div className="text-2xl font-bold mt-1">{s?.assetCount ?? 0} 项</div>
        </div>
      </div>

      {/* 配置饼图 */}
      <div className="glass-panel p-6 mb-6 animate-fade-in">
        <h3 className="text-sm font-semibold mb-2">资产配置分布</h3>
        <AssetAllocationChart data={allocation} height="260px" />
      </div>

      {/* 资产明细列表 */}
      <div className="glass-panel overflow-hidden animate-fade-in">
        <div className="p-5 border-b border-divider flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <h2 className="text-base font-semibold">资产明细</h2>
            <SegmentedTabs
              items={CATEGORY_TABS}
              value={filterCategory}
              onChange={(val) => setFilterCategory(val as AssetCategory | "ALL")}
              size="sm"
            />
          </div>
          <span className="text-xs text-default-400">共 {filteredAssets.length} 项</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-divider bg-default-50/30 text-xs text-default-400">
                <th className="text-left py-3 px-4 font-medium">资产名称</th>
                <th className="text-left py-3 px-4 font-medium">分类</th>
                <th className="text-right py-3 px-4 font-medium">数量/本金</th>
                <th className="text-right py-3 px-4 font-medium">成本/约定利率</th>
                <th className="text-right py-3 px-4 font-medium">现价/股息率</th>
                <th className="text-right py-3 px-4 font-medium">市值</th>
                <th className="text-right py-3 px-4 font-medium">持仓浮盈</th>
                <th className="text-right py-3 px-4 font-medium">预估年收益</th>
                <th className="text-right py-3 px-4 font-medium">操作</th>
              </tr>
            </thead>
            <tbody>
              {filteredAssets.length === 0 && (
                <tr>
                  <td colSpan={9} className="py-10 text-center text-xs text-default-400">
                    暂无该类别资产，点击右上角「添加资产」录入
                  </td>
                </tr>
              )}
              {filteredAssets.map((a) => {
                const meta = CATEGORY_META[a.category];
                const isPosition = a.category === "STOCK" || a.category === "FUND";
                const profit = a.profit ?? 0;
                const profitUp = profit >= 0;
                const isOtcFund = a.category === "FUND" && a.fundType === "OTC";

                return (
                  <tr key={a.id} className="border-b border-divider/50 hover:bg-default-50/50 transition-colors">
                    <td className="py-3.5 px-4">
                      <div className="font-medium flex items-center gap-1.5">
                        {a.name}
                        {isOtcFund ? (
                          <span
                            className="text-[9px] px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-400 font-medium"
                            title={`场外基金：净值为 T-1 日收盘披露数据，非盘中实时价格${a.navDate ? `（净值日期 ${a.navDate}）` : ""}`}
                          >
                            场外 · 非实时
                          </span>
                        ) : a.category === "FUND" ? (
                          <span
                            className="text-[9px] px-1.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 font-medium"
                            title="场内 ETF：交易所秒级实时行情"
                          >
                            场内 · 实时
                          </span>
                        ) : null}
                        {a.dataStale && (
                          <span title={isOtcFund ? "场外基金净值获取失败，暂按成本价估算" : "实时行情获取失败，暂按成本价估算"}>
                            <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                          </span>
                        )}
                      </div>
                      {a.code && <div className="text-[10px] text-default-400">{a.code}</div>}
                    </td>
                    <td className="py-3.5 px-4">
                      <span className={`text-xs font-medium ${meta.color}`}>{meta.icon} {meta.label}</span>
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono">
                      {isPosition ? (a.shares ?? 0).toLocaleString() : formatMoney(a.amount)}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono text-default-400">
                      {isPosition ? (
                        `¥${formatPrice(a.costPrice, a.category === "FUND")}`
                      ) : a.annualRate != null ? (
                        <div>
                          <span>{a.annualRate}%</span>
                          <div className="text-[10px] text-default-400 font-normal">
                            {PAYOUT_LABELS[a.payoutMethod || "MATURITY"] || "到期付息"}
                          </div>
                        </div>
                      ) : (
                        "--"
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono font-medium">
                      {isPosition ? (
                        `¥${formatPrice(a.currentPrice, a.category === "FUND")}`
                      ) : (
                        <div className="flex flex-col items-end text-[10px] leading-tight">
                          {a.startDate && <span className="text-blue-400 font-medium">起息 {a.startDate}</span>}
                          {a.maturityDate && <span className="text-amber-400 font-medium">到期 {a.maturityDate}</span>}
                          {!a.startDate && !a.maturityDate && <span className="text-default-400">--</span>}
                        </div>
                      )}
                      {a.category === "STOCK" && a.dividendYield != null && (
                        <div className="flex flex-col items-end text-[10px] leading-tight mt-0.5">
                          <span className="text-emerald-400 font-medium" title="最新盘中市场股息率">最新 {a.dividendYield}%</span>
                          {a.costDividendYield != null && (
                            <span className="text-blue-400 font-medium" title="你的实际买入成本股息率 (Yield on Cost)">成本 {a.costDividendYield}%</span>
                          )}
                        </div>
                      )}
                      {isOtcFund && a.navDate && (
                        <div className="text-[9px] text-default-400 font-normal">净值日 {a.navDate}</div>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono font-semibold">
                      {formatMoney(a.currentValue)}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono font-medium">
                      {isPosition ? (
                        <span className={profitUp ? "text-rise" : "text-fall"}>
                          {profitUp ? "+" : ""}{formatMoney(profit)} ({profitUp ? "+" : ""}{a.profitPct ?? 0}%)
                        </span>
                      ) : (
                        <span className="text-default-400">--</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono font-medium">
                      <span className="text-emerald-400 font-semibold">{formatMoney(a.annualIncome)}/年</span>
                      {a.category === "STOCK" && (
                        <div className="text-[10px] text-default-400 font-normal" title="现金股息基于持股数与派息锁定，不受盘中股价波动影响">派息现金流</div>
                      )}
                      {a.accruedInterest != null && (
                        <div className="text-[10px] text-blue-400 font-medium" title={`起息日 ${a.startDate}，现已存入 ${a.daysHeld} 天`}>
                          已存 {a.daysHeld}天 | 累计利息 +{formatMoney(a.accruedInterest)}
                        </div>
                      )}
                      {a.annualRate != null && a.accruedInterest == null && (
                        <div className="text-[10px] text-default-400 font-normal">年化 {a.annualRate}%</div>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => openEditModal(a)}
                          className="p-1.5 rounded-lg text-default-400 hover:text-primary hover:bg-primary/10 transition-all"
                          title="编辑"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setDeleteConfirmAsset(a)}
                          className="p-1.5 rounded-lg text-default-400 hover:text-red-400 hover:bg-red-500/10 transition-all"
                          title="删除"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* 添加/编辑弹窗 */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md bg-background border border-divider rounded-2xl shadow-2xl p-6 animate-fade-in text-foreground max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-base font-semibold text-foreground">{editingId !== null ? "编辑资产" : "添加资产"}</h3>
              <button onClick={() => setModalOpen(false)} className="text-default-400 hover:text-foreground">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-default-400 mb-1.5">资产类型</label>
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { key: "DEPOSIT", label: "存款", icon: "💰" },
                    { key: "STOCK_FUND", label: "股票/基金", icon: "📈" },
                    { key: "WEALTH", label: "理财", icon: "🏦" },
                    { key: "OTHER", label: "其他", icon: "📦" },
                  ].map((opt) => {
                    const isActive =
                      opt.key === "STOCK_FUND"
                        ? form.category === "STOCK" || form.category === "FUND"
                        : form.category === opt.key;

                    return (
                      <button
                        key={opt.key}
                        type="button"
                        onClick={() =>
                          setForm((f) => ({
                            ...f,
                            category: opt.key === "STOCK_FUND" ? (f.category === "FUND" ? "FUND" : "STOCK") : (opt.key as AssetCategory),
                          }))
                        }
                        className={`py-2 rounded-xl text-xs font-medium transition-all ${
                          isActive
                            ? "bg-primary/15 text-primary border border-primary/30 font-semibold shadow-sm"
                            : "bg-default-100 text-default-500 border border-transparent hover:text-foreground"
                        }`}
                      >
                        {opt.icon}
                        <div className="mt-0.5">{opt.label}</div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {isPositionCategory && (
                <div>
                  <label className="block text-xs font-medium text-default-400 mb-1.5">
                    股票/基金代码 <span className="text-emerald-400 text-[10px] font-normal">(输入代码自动识别名称/类别/盘中价)</span>
                  </label>
                  <input
                    type="text"
                    value={form.code || ""}
                    onChange={(e) => handleCodeChange(e.target.value)}
                    placeholder="输入代码 (如 600036, 510300, 110011, AAPL)"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-default-100 text-sm font-mono text-foreground placeholder:text-default-400 border border-transparent focus:border-primary focus:outline-none"
                  />
                  {lookupLoading && (
                    <div className="text-xs text-blue-400 flex items-center gap-1.5 mt-1.5 animate-pulse">
                      <RefreshCw className="w-3 h-3 animate-spin" />
                      正在智能匹配代码行情...
                    </div>
                  )}
                  {lookupInfo?.found && (
                    <div className="text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-3 py-2 mt-2 flex items-center justify-between animate-fade-in">
                      <span>✨ 已匹配：<strong>{lookupInfo.name}</strong> ({lookupInfo.category === "STOCK" ? "股票" : "基金"})</span>
                      {lookupInfo.currentPrice && <span>{lookupInfo.category === "FUND" ? "单位净值" : "盘中价"} <strong>¥{formatPrice(lookupInfo.currentPrice, lookupInfo.category === "FUND")}</strong></span>}
                    </div>
                  )}
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-default-400 mb-1.5">
                  {isPositionCategory ? "资产名称" : "资产名称"}
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  required
                  placeholder={isPositionCategory ? "输入代码后自动反填" : "如 招商银行活期存款"}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-default-100 text-sm text-foreground placeholder:text-default-400 border border-transparent focus:border-primary focus:outline-none"
                />
              </div>

              {isFundCategory && (
                <div>
                  <label className="block text-xs font-medium text-default-400 mb-1.5">基金类型</label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setForm((f) => ({ ...f, fundType: "EXCHANGE" }))}
                      className={`flex-1 py-2 rounded-lg text-xs font-medium transition-all ${
                        form.fundType === "EXCHANGE"
                          ? "bg-primary/15 text-primary border border-primary/30"
                          : "bg-default-100 text-default-500 border border-transparent hover:text-foreground"
                      }`}
                    >
                      场内 ETF
                      <div className="text-[10px] mt-0.5 opacity-70">交易所秒级实时行情</div>
                    </button>
                    <button
                      type="button"
                      onClick={() => setForm((f) => ({ ...f, fundType: "OTC" }))}
                      className={`flex-1 py-2 rounded-lg text-xs font-medium transition-all ${
                        form.fundType === "OTC"
                          ? "bg-primary/15 text-primary border border-primary/30"
                          : "bg-default-100 text-default-500 border border-transparent hover:text-foreground"
                      }`}
                    >
                      场外基金
                      <div className="text-[10px] mt-0.5 opacity-70">T-1 日收盘净值，非实时</div>
                    </button>
                  </div>
                </div>
              )}

              {isPositionCategory ? (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-default-400 mb-1.5">
                      {form.category === "STOCK" ? "持股数量" : "持有份额"}
                    </label>
                    <input
                      type="number"
                      step="any"
                      value={form.shares ?? ""}
                      onChange={(e) => setForm((f) => ({ ...f, shares: e.target.value ? Number(e.target.value) : undefined }))}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-default-100 text-sm text-foreground placeholder:text-default-400 border border-transparent focus:border-primary focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-default-400 mb-1.5">成本价</label>
                    <input
                      type="number"
                      step="any"
                      value={form.costPrice ?? ""}
                      onChange={(e) => setForm((f) => ({ ...f, costPrice: e.target.value ? Number(e.target.value) : undefined }))}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-default-100 text-sm text-foreground placeholder:text-default-400 border border-transparent focus:border-primary focus:outline-none"
                    />
                  </div>
                </div>
              ) : (
                <div>
                  <label className="block text-xs font-medium text-default-400 mb-1.5">金额</label>
                  <input
                    type="number"
                    step="any"
                    value={form.amount ?? ""}
                    onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value ? Number(e.target.value) : undefined }))}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-default-100 text-sm text-foreground placeholder:text-default-400 border border-transparent focus:border-primary focus:outline-none"
                  />
                </div>
              )}

              {isRateCategory && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-default-400 mb-1.5">年化利率 (%)</label>
                      <input
                        type="number"
                        step="any"
                        value={form.annualRate ?? ""}
                        onChange={(e) => setForm((f) => ({ ...f, annualRate: e.target.value ? Number(e.target.value) : undefined }))}
                        className="w-full px-3.5 py-2.5 rounded-xl bg-default-100 text-sm text-foreground placeholder:text-default-400 border border-transparent focus:border-primary focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-default-400 mb-1.5">存入/起息日 (可选)</label>
                      <input
                        type="date"
                        value={form.startDate || ""}
                        onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))}
                        className="w-full px-3.5 py-2.5 rounded-xl bg-default-100 text-sm text-foreground placeholder:text-default-400 border border-transparent focus:border-primary focus:outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="block text-xs font-medium text-default-400">到期日 (可选)</label>
                      <div className="flex gap-1.5">
                        {[1, 2, 3, 5].map((y) => (
                          <button
                            key={y}
                            type="button"
                            onClick={() => applyQuickTerm(y)}
                            className="px-2 py-0.5 rounded-md text-[10px] bg-primary/10 text-primary font-medium hover:bg-primary/20 transition-all border border-primary/20"
                            title={`自动从起息日推算 ${y} 年后到期`}
                          >
                            +{y}年
                          </button>
                        ))}
                      </div>
                    </div>
                    <input
                      type="date"
                      value={form.maturityDate || ""}
                      onChange={(e) => setForm((f) => ({ ...f, maturityDate: e.target.value }))}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-default-100 text-sm text-foreground placeholder:text-default-400 border border-transparent focus:border-primary focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-default-400 mb-1.5">派息/结息方式</label>
                    <div className="grid grid-cols-4 gap-1.5">
                      {[
                        { key: "MATURITY", label: "到期付息" },
                        { key: "MONTHLY", label: "按月派息" },
                        { key: "QUARTERLY", label: "按季结息" },
                        { key: "ANNUAL", label: "按年派息" },
                      ].map((p) => (
                        <button
                          key={p.key}
                          type="button"
                          onClick={() => setForm((f) => ({ ...f, payoutMethod: p.key as any }))}
                          className={`py-2 rounded-lg text-xs font-medium transition-all ${
                            (form.payoutMethod ?? "MATURITY") === p.key
                              ? "bg-primary/15 text-primary border border-primary/30 font-semibold"
                              : "bg-default-100 text-default-500 border border-transparent hover:text-foreground"
                          }`}
                        >
                          {p.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {form.category === "DEPOSIT" && (
                <div>
                  <label className="block text-xs font-medium text-default-400 mb-1.5">存款类型</label>
                  <div className="flex gap-2">
                    {(["DEMAND", "FIXED"] as const).map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setForm((f) => ({ ...f, depositType: t }))}
                        className={`flex-1 py-2 rounded-lg text-xs font-medium transition-all ${
                          form.depositType === t
                            ? "bg-primary/15 text-primary border border-primary/30"
                            : "bg-default-100 text-default-500 border border-transparent hover:text-foreground"
                        }`}
                      >
                        {t === "DEMAND" ? "活期" : "定期"}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-default-400 mb-1.5">备注 (可选)</label>
                <input
                  type="text"
                  value={form.notes || ""}
                  onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-default-100 text-sm text-foreground placeholder:text-default-400 border border-transparent focus:border-primary focus:outline-none"
                />
              </div>

              {formError && (
                <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                  {formError}
                </p>
              )}

              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="flex-1 py-2.5 rounded-xl bg-default-100 text-foreground text-sm font-medium hover:bg-default-200 transition-colors"
                >
                  取消
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 py-2.5 rounded-xl bg-primary text-white text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
                >
                  {editingId !== null ? "保存修改" : "确认添加"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 删除确认弹窗 */}
      {deleteConfirmAsset && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4 animate-fade-in">
          <div className="w-full max-w-sm bg-[#181a20] border border-white/10 rounded-2xl shadow-2xl p-6 text-foreground animate-scale-up">
            <div className="flex items-center gap-3 mb-4 text-rose-400">
              <div className="w-10 h-10 rounded-xl bg-rose-500/15 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-white">确认删除该资产？</h4>
                <p className="text-xs text-default-400 mt-0.5">删除后数据将无法恢复</p>
              </div>
            </div>
            <div className="bg-[#121316] border border-white/5 rounded-xl p-3 mb-5">
              <div className="text-xs font-medium text-gray-200 truncate">{deleteConfirmAsset.name}</div>
              <div className="text-[11px] text-default-400 mt-1">
                类别: {CATEGORY_META[deleteConfirmAsset.category]?.label || deleteConfirmAsset.category}
                {deleteConfirmAsset.code ? ` (${deleteConfirmAsset.code})` : ""}
              </div>
            </div>
            <div className="flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setDeleteConfirmAsset(null)}
                disabled={deleting}
                className="px-4 py-2 rounded-xl text-xs font-medium text-default-300 hover:text-white hover:bg-white/10 transition-colors"
              >
                取消
              </button>
              <button
                type="button"
                onClick={confirmDelete}
                disabled={deleting}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-white bg-rose-600 hover:bg-rose-500 disabled:opacity-50 transition-colors shadow-lg shadow-rose-600/20 flex items-center gap-1.5"
              >
                {deleting ? "正在删除..." : "确认删除"}
              </button>
            </div>
          </div>
        </div>
      )}
        </>
      )}

      {/* 资产审计流水与时光机弹窗 */}
      <AuditLogsModal isOpen={auditLogsOpen} onClose={() => setAuditLogsOpen(false)} />
    </div>
  );
}
