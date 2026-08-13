"use client";

import { useEffect, useMemo, useState } from "react";
import { useAssetStore } from "@investscope/core";
import { AssetAllocationChart, SegmentedTabs } from "@investscope/ui";
import type { AssetCategory, AssetItem, AssetPayload } from "@investscope/data/schemas";
import {
  Wallet,
  Plus,
  RefreshCw,
  Pencil,
  Trash2,
  X,
  AlertTriangle,
} from "lucide-react";

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

const EMPTY_FORM: AssetPayload = {
  category: "DEPOSIT",
  name: "",
  code: "",
  amount: undefined,
  shares: undefined,
  costPrice: undefined,
  annualRate: undefined,
  depositType: "DEMAND",
  maturityDate: "",
  notes: "",
};

function formatMoney(n: number | null | undefined) {
  if (n === null || n === undefined || isNaN(n)) return "--";
  return `¥${n.toLocaleString("zh-CN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function AssetsPage() {
  const { summary, loading, fetchSummary, addAsset, updateAsset, deleteAsset } = useAssetStore();
  const [filterCategory, setFilterCategory] = useState<AssetCategory | "ALL">("ALL");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<AssetPayload>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

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

  const openAddModal = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setFormError(null);
    setModalOpen(true);
  };

  const openEditModal = (asset: AssetItem) => {
    setEditingId(asset.id);
    setForm({
      category: asset.category,
      name: asset.name,
      code: asset.code || "",
      amount: asset.amount ?? undefined,
      shares: asset.shares ?? undefined,
      costPrice: asset.costPrice ?? undefined,
      annualRate: asset.annualRate ?? undefined,
      depositType: asset.depositType ?? "DEMAND",
      maturityDate: asset.maturityDate || "",
      notes: asset.notes || "",
    });
    setFormError(null);
    setModalOpen(true);
  };

  const handleDelete = async (id: number) => {
    if (!confirm("确认删除该资产吗？")) return;
    await deleteAsset(id);
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
            onClick={openAddModal}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-white text-sm font-medium hover:bg-primary/90 transition-colors shadow-lg shadow-primary/25"
          >
            <Plus className="w-4 h-4" />
            添加资产
          </button>
        </div>
      </div>

      {/* 汇总卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="glass-panel p-5 animate-fade-in">
          <span className="text-xs text-default-400">总资产净值</span>
          <div className="text-2xl font-bold mt-1">{formatMoney(s?.totalValue)}</div>
        </div>
        <div className="glass-panel p-5 animate-fade-in">
          <span className="text-xs text-default-400">持仓总浮盈</span>
          <div className={`text-2xl font-bold mt-1 ${(s?.totalProfit ?? 0) >= 0 ? "text-rise" : "text-fall"}`}>
            {(s?.totalProfit ?? 0) >= 0 ? "+" : ""}{formatMoney(s?.totalProfit)}
          </div>
          <span className={`text-xs font-medium block mt-1 ${(s?.totalProfitPct ?? 0) >= 0 ? "text-rise" : "text-fall"}`}>
            {(s?.totalProfitPct ?? 0) >= 0 ? "+" : ""}{s?.totalProfitPct ?? 0}%
          </span>
        </div>
        <div className="glass-panel p-5 animate-fade-in">
          <span className="text-xs text-default-400">预估年收益</span>
          <div className="text-2xl font-bold text-emerald-400 mt-1">{formatMoney(s?.estimatedAnnualIncome)}/年</div>
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
                <th className="text-right py-3 px-4 font-medium">成本/利率</th>
                <th className="text-right py-3 px-4 font-medium">现价</th>
                <th className="text-right py-3 px-4 font-medium">市值</th>
                <th className="text-right py-3 px-4 font-medium">浮盈/预估年收益</th>
                <th className="text-right py-3 px-4 font-medium">操作</th>
              </tr>
            </thead>
            <tbody>
              {filteredAssets.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-10 text-center text-xs text-default-400">
                    暂无该类别资产，点击右上角「添加资产」录入
                  </td>
                </tr>
              )}
              {filteredAssets.map((a) => {
                const meta = CATEGORY_META[a.category];
                const isPosition = a.category === "STOCK" || a.category === "FUND";
                const profit = a.profit ?? 0;
                const profitUp = profit >= 0;

                return (
                  <tr key={a.id} className="border-b border-divider/50 hover:bg-default-50/50 transition-colors">
                    <td className="py-3.5 px-4">
                      <div className="font-medium flex items-center gap-1.5">
                        {a.name}
                        {a.dataStale && (
                          <span title="实时行情获取失败，暂按成本价估算">
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
                      {isPosition ? `¥${a.costPrice ?? "--"}` : a.annualRate != null ? `${a.annualRate}%` : "--"}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono font-medium">
                      {isPosition ? `¥${a.currentPrice ?? "--"}` : "--"}
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
                        <span className="text-emerald-400">{formatMoney(a.annualIncome)}/年</span>
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
                          onClick={() => handleDelete(a.id)}
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md glass-panel p-6 animate-fade-in">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-base font-semibold">{editingId !== null ? "编辑资产" : "添加资产"}</h3>
              <button onClick={() => setModalOpen(false)} className="text-default-400 hover:text-foreground">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-default-400 mb-1.5">资产类型</label>
                <div className="grid grid-cols-5 gap-1.5">
                  {(Object.keys(CATEGORY_META) as AssetCategory[]).map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setForm((f) => ({ ...f, category: cat }))}
                      className={`py-2 rounded-lg text-xs font-medium transition-all ${
                        form.category === cat
                          ? "bg-primary/15 text-primary border border-primary/30"
                          : "bg-default-100 text-default-400 border border-transparent hover:text-foreground"
                      }`}
                    >
                      {CATEGORY_META[cat].icon}
                      <div className="mt-0.5">{CATEGORY_META[cat].label}</div>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-default-400 mb-1.5">
                  {isPositionCategory ? "股票/基金代码及名称" : "资产名称"}
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  required
                  className="w-full px-3.5 py-2.5 rounded-xl bg-default-100 text-sm border border-transparent focus:border-primary focus:outline-none"
                />
              </div>

              {isPositionCategory && (
                <div>
                  <label className="block text-xs font-medium text-default-400 mb-1.5">代码</label>
                  <input
                    type="text"
                    value={form.code || ""}
                    onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
                    placeholder="如 600036"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-default-100 text-sm border border-transparent focus:border-primary focus:outline-none"
                  />
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
                      className="w-full px-3.5 py-2.5 rounded-xl bg-default-100 text-sm border border-transparent focus:border-primary focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-default-400 mb-1.5">成本价</label>
                    <input
                      type="number"
                      step="any"
                      value={form.costPrice ?? ""}
                      onChange={(e) => setForm((f) => ({ ...f, costPrice: e.target.value ? Number(e.target.value) : undefined }))}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-default-100 text-sm border border-transparent focus:border-primary focus:outline-none"
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
                    className="w-full px-3.5 py-2.5 rounded-xl bg-default-100 text-sm border border-transparent focus:border-primary focus:outline-none"
                  />
                </div>
              )}

              {isRateCategory && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-default-400 mb-1.5">年化利率 (%)</label>
                    <input
                      type="number"
                      step="any"
                      value={form.annualRate ?? ""}
                      onChange={(e) => setForm((f) => ({ ...f, annualRate: e.target.value ? Number(e.target.value) : undefined }))}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-default-100 text-sm border border-transparent focus:border-primary focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-default-400 mb-1.5">到期日 (可选)</label>
                    <input
                      type="date"
                      value={form.maturityDate || ""}
                      onChange={(e) => setForm((f) => ({ ...f, maturityDate: e.target.value }))}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-default-100 text-sm border border-transparent focus:border-primary focus:outline-none"
                    />
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
                            : "bg-default-100 text-default-400 border border-transparent"
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
                  className="w-full px-3.5 py-2.5 rounded-xl bg-default-100 text-sm border border-transparent focus:border-primary focus:outline-none"
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
                  className="flex-1 py-2.5 rounded-xl bg-default-100 text-sm font-medium hover:bg-default-200 transition-colors"
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
    </div>
  );
}
