"use client";

import React, { useState, useEffect } from "react";
import {
  Bell,
  Send,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Sparkles,
  ShieldAlert,
  Sunrise,
  Sunset,
  Clock,
  Sliders,
  SendHorizontal,
  SlidersHorizontal,
  TrendingUp,
  Landmark,
  Layers,
} from "lucide-react";
import { useAuthStore } from "@investscope/core/stores/auth-store";

function HelpTooltip({ title, content }: { title?: string; content: React.ReactNode }) {
  return (
    <div className="relative inline-flex items-center group">
      <span
        tabIndex={0}
        className="w-4 h-4 rounded-full bg-white/10 hover:bg-primary/20 text-default-400 hover:text-primary border border-white/10 hover:border-primary/40 flex items-center justify-center text-[10px] font-bold transition-all cursor-help ml-1.5 shrink-0"
        aria-label="查看配置说明"
      >
        ?
      </span>
      <div className="absolute left-0 sm:left-1/2 sm:-translate-x-1/2 bottom-full mb-2 hidden group-hover:block group-focus:block z-50 w-72 sm:w-80 p-3.5 rounded-2xl bg-[#1c1f2e] border border-white/20 text-xs text-gray-200 shadow-2xl shadow-black/90 backdrop-blur-md animate-fade-in pointer-events-none">
        {title && (
          <div className="font-bold text-white mb-2 pb-1.5 border-b border-white/10 flex items-center gap-1.5 text-xs">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>{title}</span>
          </div>
        )}
        <div className="text-[11px] leading-relaxed text-gray-300 space-y-1.5">{content}</div>
        <div className="hidden sm:block absolute left-1/2 -translate-x-1/2 top-full w-0 h-0 border-x-6 border-x-transparent border-t-6 border-t-[#1c1f2e]" />
      </div>
    </div>
  );
}

export function NotificationSettings() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testingChannel, setTestingChannel] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);

  const [form, setForm] = useState({
    enable_morning_radar: true,
    enable_closing_review: true,
    enable_sentinel_alert: true,
    enable_opportunity_patrol: true,

    morning_radar_time: "08:45",
    closing_review_time: "15:30",
    patrol_scan_frequency: "INTERVAL_30MIN",

    min_dividend_yield: 5.5,
    max_pb_ratio: 0.85,
    min_market_cap_billion: 100.0,
    min_daily_volume_million: 25.0,
    confidence_score_threshold: 80,

    enable_csi_dividend: true,
    enable_large_cap_bluechip: true,
    enable_core_etf: true,
    enable_hk_dividend: true,
    enable_deposit_maturity: true,
    enable_macro_erp: true,

    channel_types: ["IN_APP"],
    feishu_webhook_url: "",
    wechat_webhook_url: "",
    email_address: "",
    telegram_bot_token: "",
    telegram_chat_id: "",
    telegram_api_host: "https://api.telegram.org",
  });

  const API_BASE = process.env.NEXT_PUBLIC_API_URL || "";

  const fetchSubscription = async () => {
    setLoading(true);
    try {
      const token = useAuthStore.getState().token;
      if (!token) return;
      const res = await fetch(`${API_BASE}/api/intelligence/subscription`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setForm({
          enable_morning_radar: data.enable_morning_radar ?? true,
          enable_closing_review: data.enable_closing_review ?? true,
          enable_sentinel_alert: data.enable_sentinel_alert ?? true,
          enable_opportunity_patrol: data.enable_opportunity_patrol ?? true,

          morning_radar_time: data.morning_radar_time || "08:45",
          closing_review_time: data.closing_review_time || "15:30",
          patrol_scan_frequency: data.patrol_scan_frequency || "INTERVAL_30MIN",

          min_dividend_yield: data.min_dividend_yield ?? 5.5,
          max_pb_ratio: data.max_pb_ratio ?? 0.85,
          min_market_cap_billion: data.min_market_cap_billion ?? 100.0,
          min_daily_volume_million: data.min_daily_volume_million ?? 25.0,
          confidence_score_threshold: data.confidence_score_threshold ?? 80,

          enable_csi_dividend: data.enable_csi_dividend ?? true,
          enable_large_cap_bluechip: data.enable_large_cap_bluechip ?? true,
          enable_core_etf: data.enable_core_etf ?? true,
          enable_hk_dividend: data.enable_hk_dividend ?? true,
          enable_deposit_maturity: data.enable_deposit_maturity ?? true,
          enable_macro_erp: data.enable_macro_erp ?? true,

          channel_types: data.channel_types || ["IN_APP"],
          feishu_webhook_url: data.feishu_webhook_url || "",
          wechat_webhook_url: data.wechat_webhook_url || "",
          email_address: data.email_address || "",
          telegram_bot_token: data.telegram_bot_token || "",
          telegram_chat_id: data.telegram_chat_id || "",
          telegram_api_host: data.telegram_api_host || "https://api.telegram.org",
        });
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSubscription();
  }, []);

  const handleSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setSaving(true);
    try {
      const token = useAuthStore.getState().token;
      const res = await fetch(`${API_BASE}/api/intelligence/subscription`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(form),
      });
      if (res.ok) {
        setToastMessage({ text: "✅ 策略参数与动态时间配置已成功保存！", type: "success" });
        setTimeout(() => setToastMessage(null), 3000);
      } else {
        setToastMessage({ text: "保存失败，请检查网络", type: "error" });
      }
    } catch (e) {
      setToastMessage({ text: "保存异常", type: "error" });
    } finally {
      setSaving(false);
    }
  };

  const applyPreset = (type: "CONSERVATIVE" | "DEFENSIVE" | "BALANCED") => {
    if (type === "CONSERVATIVE") {
      setForm((f) => ({
        ...f,
        min_dividend_yield: 6.5,
        max_pb_ratio: 0.7,
        min_market_cap_billion: 150.0,
        confidence_score_threshold: 85,
      }));
      setToastMessage({ text: "已载入【极致防守高息】预设参数", type: "success" });
    } else if (type === "DEFENSIVE") {
      setForm((f) => ({
        ...f,
        min_dividend_yield: 5.5,
        max_pb_ratio: 0.85,
        min_market_cap_billion: 100.0,
        confidence_score_threshold: 80,
      }));
      setToastMessage({ text: "已载入【稳健核心收息】预设参数", type: "success" });
    } else {
      setForm((f) => ({
        ...f,
        min_dividend_yield: 4.5,
        max_pb_ratio: 1.0,
        min_market_cap_billion: 50.0,
        confidence_score_threshold: 75,
      }));
      setToastMessage({ text: "已载入【积极进取捡漏】预设参数", type: "success" });
    }
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleTestPush = async (channel: "FEISHU" | "WECHAT" | "EMAIL" | "TELEGRAM") => {
    let reqBody: Record<string, any> = { channel, report_type: "OPPORTUNITY_PATROL" };

    if (channel === "FEISHU") {
      if (!form.feishu_webhook_url.trim()) {
        setToastMessage({ text: "请先填写飞书 Webhook 地址！", type: "error" });
        setTimeout(() => setToastMessage(null), 3000);
        return;
      }
      reqBody.target_url_or_email = form.feishu_webhook_url.trim();
    } else if (channel === "WECHAT") {
      if (!form.wechat_webhook_url.trim()) {
        setToastMessage({ text: "请先填写企业微信 Webhook 地址！", type: "error" });
        setTimeout(() => setToastMessage(null), 3000);
        return;
      }
      reqBody.target_url_or_email = form.wechat_webhook_url.trim();
    } else if (channel === "EMAIL") {
      if (!form.email_address.trim()) {
        setToastMessage({ text: "请先填写通知接收邮箱！", type: "error" });
        setTimeout(() => setToastMessage(null), 3000);
        return;
      }
      reqBody.target_url_or_email = form.email_address.trim();
    } else if (channel === "TELEGRAM") {
      if (!form.telegram_bot_token.trim() || !form.telegram_chat_id.trim()) {
        setToastMessage({ text: "请先填写 Telegram Bot Token 与 Chat ID！", type: "error" });
        setTimeout(() => setToastMessage(null), 3000);
        return;
      }
      reqBody.telegram_bot_token = form.telegram_bot_token.trim();
      reqBody.telegram_chat_id = form.telegram_chat_id.trim();
      reqBody.telegram_api_host = form.telegram_api_host.trim() || "https://api.telegram.org";
    }

    setTestingChannel(channel);
    try {
      const token = useAuthStore.getState().token;
      const res = await fetch(`${API_BASE}/api/intelligence/test-push`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(reqBody),
      });

      if (res.ok) {
        const updatedChannels = form.channel_types.includes(channel)
          ? form.channel_types
          : [...form.channel_types, channel];
        const updatedForm = { ...form, channel_types: updatedChannels };
        setForm(updatedForm);

        fetch(`${API_BASE}/api/intelligence/subscription`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(updatedForm),
        });

        setToastMessage({ text: `🎉 成功向 ${channel} 发送测试消息并已自动保存配置！`, type: "success" });
        setTimeout(() => setToastMessage(null), 5000);
      } else {
        const err = await res.json().catch(() => ({ detail: `HTTP ${res.status} 服务异常` }));
        setToastMessage({ text: `❌ 发送失败: ${err.detail || "接口异常"}`, type: "error" });
        setTimeout(() => setToastMessage(null), 6000);
      }
    } catch (e: any) {
      setToastMessage({ text: `测试异常: ${e.message || e}`, type: "error" });
    } finally {
      setTestingChannel(null);
    }
  };

  const toggleChannel = (ch: string) => {
    if (ch === "IN_APP") return;
    setForm((prev) => {
      const exists = prev.channel_types.includes(ch);
      const updated = exists
        ? prev.channel_types.filter((c) => c !== ch)
        : [...prev.channel_types, ch];
      return { ...prev, channel_types: updated };
    });
  };

  if (loading) {
    return (
      <div className="glass-panel p-6 animate-fade-in text-center text-default-400 py-10">
        <RefreshCw className="w-6 h-6 animate-spin mx-auto text-primary mb-2" />
        <span className="text-xs">加载策略与订阅配置中...</span>
      </div>
    );
  }

  return (
    <div className="glass-panel p-6 animate-fade-in space-y-6">
      {/* 模块标题 */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-white flex items-center gap-2">
            <Bell className="w-5 h-5 text-amber-400" />
            机会巡视雷达 · 策略参数与动态时间配置中心
          </h2>
          <p className="text-xs text-default-400 mt-0.5">
            自由调整量化机会门槛、触发时间与多通道推送，改动实时生效，无需重启发版。
          </p>
        </div>

        <button
          onClick={handleSave}
          disabled={saving}
          className="px-4 py-2 rounded-xl bg-primary text-primary-foreground font-semibold text-xs shadow-md shadow-primary/25 hover:scale-105 transition-all flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
        >
          {saving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
          <span>保存全部配置</span>
        </button>
      </div>

      {/* Toast 提示条 */}
      {toastMessage && (
        <div
          className={`p-3 rounded-xl border text-xs flex items-center gap-2 animate-fade-in ${
            toastMessage.type === "success"
              ? "bg-emerald-950/80 border-emerald-500/40 text-emerald-300"
              : "bg-rose-950/80 border-rose-500/40 text-rose-300"
          }`}
        >
          {toastMessage.type === "success" ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
          )}
          <span>{toastMessage.text}</span>
        </div>
      )}

      {/* 1. 任务开关与动态触发时间 */}
      <div className="space-y-4">
        <div className="text-xs font-semibold text-gray-200 flex items-center justify-between">
          <span className="flex items-center gap-1.5">
            <Clock className="w-4 h-4 text-primary" />
            1. 订阅任务与动态触发时间
          </span>
          <span className="text-[11px] text-default-400 font-normal">支持分钟级精准定制</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* 早盘前瞻 */}
          <div className={`p-4 rounded-2xl border transition-all space-y-3 ${
            form.enable_morning_radar ? "bg-amber-500/10 border-amber-500/30" : "bg-black/20 border-white/5 opacity-60"
          }`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sunrise className="w-4 h-4 text-amber-400" />
                <span className="text-xs font-bold text-white">🌅 早盘前瞻</span>
              </div>
              <input
                type="checkbox"
                checked={form.enable_morning_radar}
                onChange={() => setForm((f) => ({ ...f, enable_morning_radar: !f.enable_morning_radar }))}
                className="accent-primary w-4 h-4 rounded cursor-pointer"
              />
            </div>
            <p className="text-[11px] text-default-400">宏观事件、隔夜外盘与 ERP 风险溢价</p>
            <div className="pt-2 border-t border-white/10 flex items-center justify-between">
              <span className="text-[10px] text-default-400">触发时刻</span>
              <select
                value={form.morning_radar_time}
                disabled={!form.enable_morning_radar}
                onChange={(e) => setForm({ ...form, morning_radar_time: e.target.value })}
                className="px-2 py-1 rounded bg-[#1a1d27] border border-white/10 text-xs text-amber-300 font-mono focus:outline-none"
              >
                <option value="08:00">08:00 (通勤早读)</option>
                <option value="08:15">08:15</option>
                <option value="08:30">08:30 (推荐)</option>
                <option value="08:45">08:45 (标准)</option>
                <option value="09:00">09:00 (临开盘)</option>
                <option value="09:15">09:15</option>
              </select>
            </div>
          </div>

          {/* 收盘复盘 */}
          <div className={`p-4 rounded-2xl border transition-all space-y-3 ${
            form.enable_closing_review ? "bg-primary/10 border-primary/30" : "bg-black/20 border-white/5 opacity-60"
          }`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sunset className="w-4 h-4 text-primary" />
                <span className="text-xs font-bold text-white">🌆 收盘复盘</span>
              </div>
              <input
                type="checkbox"
                checked={form.enable_closing_review}
                onChange={() => setForm((f) => ({ ...f, enable_closing_review: !f.enable_closing_review }))}
                className="accent-primary w-4 h-4 rounded cursor-pointer"
              />
            </div>
            <p className="text-[11px] text-default-400">大盘行情、申万行业与红利复盘</p>
            <div className="pt-2 border-t border-white/10 flex items-center justify-between">
              <span className="text-[10px] text-default-400">触发时刻</span>
              <select
                value={form.closing_review_time}
                disabled={!form.enable_closing_review}
                onChange={(e) => setForm({ ...form, closing_review_time: e.target.value })}
                className="px-2 py-1 rounded bg-[#1a1d27] border border-white/10 text-xs text-primary font-mono focus:outline-none"
              >
                <option value="15:10">15:10 (盘后即刻)</option>
                <option value="15:30">15:30 (标准)</option>
                <option value="16:00">16:00</option>
                <option value="18:00">18:00 (下班阅读)</option>
                <option value="20:30">20:30 (晚间深度)</option>
              </select>
            </div>
          </div>

          {/* 持仓风险哨兵 */}
          <div className={`p-4 rounded-2xl border transition-all space-y-3 ${
            form.enable_sentinel_alert ? "bg-rose-500/10 border-rose-500/30" : "bg-black/20 border-white/5 opacity-60"
          }`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-rose-400" />
                <span className="text-xs font-bold text-white">🛡️ 风险哨兵</span>
              </div>
              <input
                type="checkbox"
                checked={form.enable_sentinel_alert}
                onChange={() => setForm((f) => ({ ...f, enable_sentinel_alert: !f.enable_sentinel_alert }))}
                className="accent-primary w-4 h-4 rounded cursor-pointer"
              />
            </div>
            <p className="text-[11px] text-default-400">行业集中度超标、财报排雷与利差收窄</p>
            <div className="pt-2 border-t border-white/10 flex items-center justify-between">
              <span className="text-[10px] text-default-400">巡视频次</span>
              <span className="text-[10px] text-rose-300 font-medium">异常即时推送</span>
            </div>
          </div>

          {/* 机会巡视雷达 */}
          <div className={`p-4 rounded-2xl border transition-all space-y-3 ${
            form.enable_opportunity_patrol ? "bg-emerald-500/10 border-emerald-500/30" : "bg-black/20 border-white/5 opacity-60"
          }`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-emerald-400" />
                <span className="text-xs font-bold text-white">🎯 机会巡视</span>
              </div>
              <input
                type="checkbox"
                checked={form.enable_opportunity_patrol}
                onChange={() => setForm((f) => ({ ...f, enable_opportunity_patrol: !f.enable_opportunity_patrol }))}
                className="accent-primary w-4 h-4 rounded cursor-pointer"
              />
            </div>
            <p className="text-[11px] text-default-400">超跌破净、极值高息与 ETF 黄金底</p>
            <div className="pt-2 border-t border-white/10 flex items-center justify-between">
              <span className="text-[10px] text-default-400">巡视频次</span>
              <select
                value={form.patrol_scan_frequency}
                disabled={!form.enable_opportunity_patrol}
                onChange={(e) => setForm({ ...form, patrol_scan_frequency: e.target.value })}
                className="px-2 py-1 rounded bg-[#1a1d27] border border-white/10 text-xs text-emerald-300 font-mono focus:outline-none text-[11px]"
              >
                <option value="INTERVAL_30MIN">盘中每30分钟</option>
                <option value="INTERVAL_60MIN">盘中每小时整点</option>
                <option value="TIMES_1030_1430">每日两次(10:30/14:30)</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* 2. 机会巡视量化策略参数与滑块 */}
      <div className="space-y-4 pt-4 border-t border-white/10">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="text-xs font-semibold text-gray-200 flex items-center gap-1.5">
            <SlidersHorizontal className="w-4 h-4 text-emerald-400" />
            <span>2. 机会巡视量化门槛与策略参数</span>
            <HelpTooltip
              title="量化门槛与防误报说明"
              content="调整触发机会的最低要求。门槛越高，筛选出来的标的确定性越高、抗风险越强；系统已自动内置财务排雷与 5 分钟均价确认。"
            />
          </div>

          {/* 快捷预设 */}
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-default-400">专家预设:</span>
            <button
              type="button"
              onClick={() => applyPreset("DEFENSIVE")}
              className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-emerald-500/20 border border-white/10 hover:border-emerald-500/40 text-[11px] text-emerald-300 transition-all cursor-pointer"
            >
              🛡️ 稳健收息
            </button>
            <button
              type="button"
              onClick={() => applyPreset("CONSERVATIVE")}
              className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-sky-500/20 border border-white/10 hover:border-sky-500/40 text-[11px] text-sky-300 transition-all cursor-pointer"
            >
              💎 极致防守
            </button>
            <button
              type="button"
              onClick={() => applyPreset("BALANCED")}
              className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-amber-500/20 border border-white/10 hover:border-amber-500/40 text-[11px] text-amber-300 transition-all cursor-pointer"
            >
              🚀 积极进取
            </button>
          </div>
        </div>

        {/* 4 个核心量化滑块 */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 p-4 rounded-2xl bg-black/20 border border-white/10">
          {/* 最低股息率 */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-default-400">最低股息率 (DY)</span>
              <span className="font-bold font-mono text-emerald-400">{form.min_dividend_yield.toFixed(1)}%</span>
            </div>
            <input
              type="range"
              min={3.5}
              max={8.0}
              step={0.1}
              value={form.min_dividend_yield}
              onChange={(e) => setForm({ ...form, min_dividend_yield: parseFloat(e.target.value) })}
              className="w-full accent-emerald-400 cursor-pointer h-1.5 bg-default-100 rounded-lg"
            />
            <div className="flex justify-between text-[9px] text-default-500">
              <span>3.5%</span>
              <span>5.5% (推荐)</span>
              <span>8.0%</span>
            </div>
          </div>

          {/* 市净率破净门槛 */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-default-400">破净市净率 (PB)</span>
              <span className="font-bold font-mono text-amber-400">≤ {form.max_pb_ratio.toFixed(2)}</span>
            </div>
            <input
              type="range"
              min={0.5}
              max={1.2}
              step={0.05}
              value={form.max_pb_ratio}
              onChange={(e) => setForm({ ...form, max_pb_ratio: parseFloat(e.target.value) })}
              className="w-full accent-amber-400 cursor-pointer h-1.5 bg-default-100 rounded-lg"
            />
            <div className="flex justify-between text-[9px] text-default-500">
              <span>0.50 (深度破净)</span>
              <span>0.85</span>
              <span>1.20</span>
            </div>
          </div>

          {/* 最低总市值 */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-default-400">最低总市值</span>
              <span className="font-bold font-mono text-sky-400">≥ {form.min_market_cap_billion} 亿元</span>
            </div>
            <input
              type="range"
              min={30}
              max={300}
              step={10}
              value={form.min_market_cap_billion}
              onChange={(e) => setForm({ ...form, min_market_cap_billion: parseFloat(e.target.value) })}
              className="w-full accent-sky-400 cursor-pointer h-1.5 bg-default-100 rounded-lg"
            />
            <div className="flex justify-between text-[9px] text-default-500">
              <span>30亿 (中盘)</span>
              <span>100亿 (蓝筹)</span>
              <span>300亿 (巨头)</span>
            </div>
          </div>

          {/* 置信度评分门槛 */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-default-400">推送置信度门槛</span>
              <span className="font-bold font-mono text-violet-400">≥ {form.confidence_score_threshold} 分</span>
            </div>
            <input
              type="range"
              min={60}
              max={95}
              step={5}
              value={form.confidence_score_threshold}
              onChange={(e) => setForm({ ...form, confidence_score_threshold: parseInt(e.target.value) })}
              className="w-full accent-violet-400 cursor-pointer h-1.5 bg-default-100 rounded-lg"
            />
            <div className="flex justify-between text-[9px] text-default-500">
              <span>60分</span>
              <span>80分 (黄金级)</span>
              <span>95分 (极严苛)</span>
            </div>
          </div>
        </div>

        {/* 标的池与策略开关 Checkbox */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
          <label className="flex items-center gap-2 p-2.5 rounded-xl bg-black/20 border border-white/5 text-xs text-gray-300 cursor-pointer hover:bg-black/30">
            <input
              type="checkbox"
              checked={form.enable_csi_dividend}
              onChange={(e) => setForm({ ...form, enable_csi_dividend: e.target.checked })}
              className="accent-primary w-3.5 h-3.5 rounded"
            />
            <span>中证红利成份</span>
          </label>

          <label className="flex items-center gap-2 p-2.5 rounded-xl bg-black/20 border border-white/5 text-xs text-gray-300 cursor-pointer hover:bg-black/30">
            <input
              type="checkbox"
              checked={form.enable_large_cap_bluechip}
              onChange={(e) => setForm({ ...form, enable_large_cap_bluechip: e.target.checked })}
              className="accent-primary w-3.5 h-3.5 rounded"
            />
            <span>沪深大盘蓝筹</span>
          </label>

          <label className="flex items-center gap-2 p-2.5 rounded-xl bg-black/20 border border-white/5 text-xs text-gray-300 cursor-pointer hover:bg-black/30">
            <input
              type="checkbox"
              checked={form.enable_core_etf}
              onChange={(e) => setForm({ ...form, enable_core_etf: e.target.checked })}
              className="accent-primary w-3.5 h-3.5 rounded"
            />
            <span>核心/海外 ETF</span>
          </label>

          <label className="flex items-center gap-2 p-2.5 rounded-xl bg-black/20 border border-white/5 text-xs text-gray-300 cursor-pointer hover:bg-black/30">
            <input
              type="checkbox"
              checked={form.enable_hk_dividend}
              onChange={(e) => setForm({ ...form, enable_hk_dividend: e.target.checked })}
              className="accent-primary w-3.5 h-3.5 rounded"
            />
            <span>港股通高息央企</span>
          </label>

          <label className="flex items-center gap-2 p-2.5 rounded-xl bg-black/20 border border-white/5 text-xs text-gray-300 cursor-pointer hover:bg-black/30">
            <input
              type="checkbox"
              checked={form.enable_deposit_maturity}
              onChange={(e) => setForm({ ...form, enable_deposit_maturity: e.target.checked })}
              className="accent-primary w-3.5 h-3.5 rounded"
            />
            <span>定存到期置换</span>
          </label>

          <label className="flex items-center gap-2 p-2.5 rounded-xl bg-black/20 border border-white/5 text-xs text-gray-300 cursor-pointer hover:bg-black/30">
            <input
              type="checkbox"
              checked={form.enable_macro_erp}
              onChange={(e) => setForm({ ...form, enable_macro_erp: e.target.checked })}
              className="accent-primary w-3.5 h-3.5 rounded"
            />
            <span>股债利差大底</span>
          </label>
        </div>
      </div>

      {/* 3. 触达渠道与 Webhook 配置 */}
      <div className="space-y-4 pt-4 border-t border-white/10">
        <div className="text-xs font-semibold text-gray-200">3. 外部推送渠道与 Webhook / Bot 配置</div>

        <div className="space-y-4">
          {/* Telegram 机器人 */}
          <div className="p-4 rounded-2xl bg-black/30 border border-sky-500/20 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="ch-tg"
                  checked={form.channel_types.includes("TELEGRAM")}
                  onChange={() => toggleChannel("TELEGRAM")}
                  className="accent-sky-400 w-4 h-4 rounded cursor-pointer"
                />
                <label htmlFor="ch-tg" className="text-xs font-bold text-white cursor-pointer flex items-center gap-1.5">
                  <SendHorizontal className="w-3.5 h-3.5 text-sky-400" />
                  <span>✈️ Telegram 机器人 (HTML 研报 & 双向 Agent 对话)</span>
                  <span className="text-[10px] px-1.5 py-0.2 rounded bg-sky-500/20 text-sky-300 border border-sky-500/30 font-semibold">
                    ⚡ 支持双向对话
                  </span>
                </label>
              </div>

              <button
                type="button"
                onClick={() => handleTestPush("TELEGRAM")}
                disabled={testingChannel === "TELEGRAM" || !form.telegram_bot_token || !form.telegram_chat_id}
                className="px-3 py-1 rounded-lg bg-white/5 hover:bg-white/15 border border-white/10 text-xs text-gray-300 hover:text-white transition-all flex items-center gap-1 disabled:opacity-40 cursor-pointer"
              >
                <Sparkles className={`w-3 h-3 ${testingChannel === "TELEGRAM" ? "animate-spin text-sky-400" : "text-sky-400"}`} />
                <span>一键发送测试消息</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] text-default-400 block mb-1">Bot Token (发件人密钥)</label>
                <input
                  type="text"
                  value={form.telegram_bot_token}
                  onChange={(e) => setForm({ ...form, telegram_bot_token: e.target.value })}
                  placeholder="5849382910:AAH_xxxxxxxxxxxxxxxx"
                  className="w-full px-3.5 py-2 rounded-xl bg-[#1a1d27] border border-white/10 text-xs text-gray-100 placeholder:text-gray-500 focus:outline-none focus:border-sky-400 font-mono"
                />
              </div>

              <div>
                <label className="text-[11px] text-default-400 block mb-1">Chat ID (收件人数字 ID)</label>
                <input
                  type="text"
                  value={form.telegram_chat_id}
                  onChange={(e) => setForm({ ...form, telegram_chat_id: e.target.value })}
                  placeholder="-1001234567890 或 12345678"
                  className="w-full px-3.5 py-2 rounded-xl bg-[#1a1d27] border border-white/10 text-xs text-gray-100 placeholder:text-gray-500 focus:outline-none focus:border-sky-400 font-mono"
                />
              </div>
            </div>
          </div>

          {/* 飞书 Webhook */}
          <div className="p-4 rounded-2xl bg-black/30 border border-white/10 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="ch-feishu"
                  checked={form.channel_types.includes("FEISHU")}
                  onChange={() => toggleChannel("FEISHU")}
                  className="accent-primary w-4 h-4 rounded cursor-pointer"
                />
                <label htmlFor="ch-feishu" className="text-xs font-bold text-white cursor-pointer flex items-center">
                  <span>💬 飞书自定义机器人 (富文本互动卡片)</span>
                </label>
              </div>

              <button
                type="button"
                onClick={() => handleTestPush("FEISHU")}
                disabled={testingChannel === "FEISHU" || !form.feishu_webhook_url}
                className="px-3 py-1 rounded-lg bg-white/5 hover:bg-white/15 border border-white/10 text-xs text-gray-300 hover:text-white transition-all flex items-center gap-1 disabled:opacity-40 cursor-pointer"
              >
                <Sparkles className={`w-3 h-3 ${testingChannel === "FEISHU" ? "animate-spin text-primary" : "text-amber-400"}`} />
                <span>一键发送测试卡片</span>
              </button>
            </div>

            <input
              type="text"
              value={form.feishu_webhook_url}
              onChange={(e) => setForm({ ...form, feishu_webhook_url: e.target.value })}
              placeholder="https://open.feishu.cn/open-apis/bot/v2/hook/xxxxxxxx-xxxx-xxxx"
              className="w-full px-3.5 py-2 rounded-xl bg-[#1a1d27] border border-white/10 text-xs text-gray-100 placeholder:text-gray-500 focus:outline-none focus:border-primary font-mono"
            />
          </div>

          {/* 企业微信 Webhook */}
          <div className="p-4 rounded-2xl bg-black/30 border border-white/10 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="ch-wechat"
                  checked={form.channel_types.includes("WECHAT")}
                  onChange={() => toggleChannel("WECHAT")}
                  className="accent-primary w-4 h-4 rounded cursor-pointer"
                />
                <label htmlFor="ch-wechat" className="text-xs font-bold text-white cursor-pointer flex items-center">
                  <span>🏢 企业微信群机器人 (Markdown 消息)</span>
                </label>
              </div>

              <button
                type="button"
                onClick={() => handleTestPush("WECHAT")}
                disabled={testingChannel === "WECHAT" || !form.wechat_webhook_url}
                className="px-3 py-1 rounded-lg bg-white/5 hover:bg-white/15 border border-white/10 text-xs text-gray-300 hover:text-white transition-all flex items-center gap-1 disabled:opacity-40 cursor-pointer"
              >
                <Sparkles className={`w-3 h-3 ${testingChannel === "WECHAT" ? "animate-spin text-primary" : "text-amber-400"}`} />
                <span>一键发送测试卡片</span>
              </button>
            </div>

            <input
              type="text"
              value={form.wechat_webhook_url}
              onChange={(e) => setForm({ ...form, wechat_webhook_url: e.target.value })}
              placeholder="https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=xxxxxxxx"
              className="w-full px-3.5 py-2 rounded-xl bg-[#1a1d27] border border-white/10 text-xs text-gray-100 placeholder:text-gray-500 focus:outline-none focus:border-primary font-mono"
            />
          </div>

          {/* 邮箱订阅 */}
          <div className="p-4 rounded-2xl bg-black/30 border border-white/10 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="ch-email"
                  checked={form.channel_types.includes("EMAIL")}
                  onChange={() => toggleChannel("EMAIL")}
                  className="accent-primary w-4 h-4 rounded cursor-pointer"
                />
                <label htmlFor="ch-email" className="text-xs font-bold text-white cursor-pointer flex items-center">
                  <span>📬 电子邮箱通知 (自适应深色排版 HTML 研报)</span>
                </label>
              </div>

              <button
                type="button"
                onClick={() => handleTestPush("EMAIL")}
                disabled={testingChannel === "EMAIL" || !form.email_address}
                className="px-3 py-1 rounded-lg bg-white/5 hover:bg-white/15 border border-white/10 text-xs text-gray-300 hover:text-white transition-all flex items-center gap-1 disabled:opacity-40 cursor-pointer"
              >
                <Sparkles className={`w-3 h-3 ${testingChannel === "EMAIL" ? "animate-spin text-primary" : "text-amber-400"}`} />
                <span>一键发送测试邮件</span>
              </button>
            </div>

            <input
              type="email"
              value={form.email_address}
              onChange={(e) => setForm({ ...form, email_address: e.target.value })}
              placeholder="investor@example.com"
              className="w-full px-3.5 py-2 rounded-xl bg-[#1a1d27] border border-white/10 text-xs text-gray-100 placeholder:text-gray-500 focus:outline-none focus:border-primary font-mono"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
