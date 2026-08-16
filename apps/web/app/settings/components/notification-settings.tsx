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
  SendHorizontal,
} from "lucide-react";
import { useAuthStore } from "@investscope/core/stores/auth-store";

export function NotificationSettings() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testingChannel, setTestingChannel] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);

  const [form, setForm] = useState({
    enable_morning_radar: true,
    enable_closing_review: true,
    enable_sentinel_alert: true,

    morning_radar_time: "08:45",
    closing_review_time: "15:30",

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

          morning_radar_time: data.morning_radar_time || "08:45",
          closing_review_time: data.closing_review_time || "15:30",

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
        setToastMessage({ text: "✅ 研报时间与通知渠道配置已成功保存！", type: "success" });
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

  const handleTestPush = async (channel: "FEISHU" | "WECHAT" | "EMAIL" | "TELEGRAM") => {
    let reqBody: Record<string, any> = { channel, report_type: "MORNING_RADAR" };

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
        <span className="text-xs">加载订阅配置中...</span>
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
            智能情报 · 定时研报与风险哨兵配置中心
          </h2>
          <p className="text-xs text-default-400 mt-0.5">
            自由调整早晚研报触发时间与多通道推送，改动实时生效，无需重启发版。
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

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
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
        </div>
      </div>

      {/* 2. 触达渠道与 Webhook 配置 */}
      <div className="space-y-4 pt-4 border-t border-white/10">
        <div className="text-xs font-semibold text-gray-200">2. 外部推送渠道与 Webhook / Bot 配置</div>

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
