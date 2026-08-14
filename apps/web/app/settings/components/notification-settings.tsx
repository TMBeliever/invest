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
  Layers,
  HelpCircle,
  SendHorizontal,
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
        setToastMessage({ text: "✅ 推送与订阅偏好配置已成功保存！", type: "success" });
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
    let reqBody: Record<string, any> = { channel, report_type: "SENTINEL_ALERT" };

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
        // 自动将测试成功的渠道勾选并持久化保存，使后台双向对话立即生效
        const updatedChannels = form.channel_types.includes(channel)
          ? form.channel_types
          : [...form.channel_types, channel];
        const updatedForm = { ...form, channel_types: updatedChannels };
        setForm(updatedForm);

        // 自动保存
        fetch(`${API_BASE}/api/intelligence/subscription`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(updatedForm),
        });

        setToastMessage({ text: `🎉 成功向 ${channel} 发送测试消息并已自动保存配置！Bot 双向交互已实时激活。`, type: "success" });
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
    if (ch === "IN_APP") return; // 站内信必选
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
            智能决策推送与多渠道通知中台
          </h2>
          <p className="text-xs text-default-400 mt-0.5">
            配置每日研报定时分发与持仓风险哨兵即时推送渠道 (支持 Telegram / 飞书 / 企业微信 / 邮件)。
          </p>
        </div>

        <button
          onClick={handleSave}
          disabled={saving}
          className="px-4 py-2 rounded-xl bg-primary text-primary-foreground font-semibold text-xs shadow-md shadow-primary/25 hover:scale-105 transition-all flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
        >
          {saving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
          <span>保存配置</span>
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

      {/* 1. 订阅内容开关 */}
      <div className="space-y-3">
        <div className="text-xs font-semibold text-gray-200 flex items-center gap-1">
          <span>1. 订阅内容选择</span>
          <HelpTooltip
            title="推送内容频率说明"
            content={
              <div className="space-y-1">
                <div>• <b>早盘前瞻</b>：每个工作日 08:45 定时推送全球宏观、外盘、国债 ERP 与开盘策略。</div>
                <div>• <b>收盘复盘</b>：每个工作日 15:30 定时推送大盘涨跌榜、申万行业资金流与红利专题。</div>
                <div>• <b>持仓哨兵</b>：盘中 10:00 / 14:00 及盘后 15:35 自动巡检，发现隐形行业超标或股息利差收窄时即时推送。</div>
              </div>
            }
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {/* 早盘前瞻 */}
          <div
            onClick={() => setForm((f) => ({ ...f, enable_morning_radar: !f.enable_morning_radar }))}
            className={`p-4 rounded-2xl border cursor-pointer transition-all flex items-start justify-between ${
              form.enable_morning_radar
                ? "bg-amber-500/10 border-amber-500/40 shadow-sm"
                : "bg-black/20 border-white/5 opacity-60 hover:opacity-100"
            }`}
          >
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Sunrise className="w-4 h-4 text-amber-400" />
                <span className="text-xs font-bold text-white">🌅 每日早盘前瞻</span>
              </div>
              <p className="text-[11px] text-default-400 leading-relaxed">
                每天 08:45 自动汇总隔夜外盘、黄金大宗、国债 ERP 风险溢价与开盘策略。
              </p>
            </div>
            <input
              type="checkbox"
              checked={form.enable_morning_radar}
              onChange={() => {}}
              className="accent-primary w-4 h-4 rounded mt-1 shrink-0"
            />
          </div>

          {/* 收盘复盘 */}
          <div
            onClick={() => setForm((f) => ({ ...f, enable_closing_review: !f.enable_closing_review }))}
            className={`p-4 rounded-2xl border cursor-pointer transition-all flex items-start justify-between ${
              form.enable_closing_review
                ? "bg-primary/10 border-primary/40 shadow-sm"
                : "bg-black/20 border-white/5 opacity-60 hover:opacity-100"
            }`}
          >
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Sunset className="w-4 h-4 text-primary" />
                <span className="text-xs font-bold text-white">🌆 每日收盘复盘</span>
              </div>
              <p className="text-[11px] text-default-400 leading-relaxed">
                每天 15:30 自动生成主要指数涨跌榜、申万 31 行业资金流向与高股息表现。
              </p>
            </div>
            <input
              type="checkbox"
              checked={form.enable_closing_review}
              onChange={() => {}}
              className="accent-primary w-4 h-4 rounded mt-1 shrink-0"
            />
          </div>

          {/* 风险哨兵 */}
          <div
            onClick={() => setForm((f) => ({ ...f, enable_sentinel_alert: !f.enable_sentinel_alert }))}
            className={`p-4 rounded-2xl border cursor-pointer transition-all flex items-start justify-between ${
              form.enable_sentinel_alert
                ? "bg-rose-500/10 border-rose-500/40 shadow-sm"
                : "bg-black/20 border-white/5 opacity-60 hover:opacity-100"
            }`}
          >
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-rose-400" />
                <span className="text-xs font-bold text-white">🛡️ 持仓风险哨兵</span>
              </div>
              <p className="text-[11px] text-default-400 leading-relaxed">
                实时扫描行业穿透集中度、股息利差收窄与财报排雷，附带 3 套调仓方案。
              </p>
            </div>
            <input
              type="checkbox"
              checked={form.enable_sentinel_alert}
              onChange={() => {}}
              className="accent-primary w-4 h-4 rounded mt-1 shrink-0"
            />
          </div>
        </div>
      </div>

      {/* 2. 触达渠道配置 */}
      <div className="space-y-4 pt-4 border-t border-white/10">
        <div className="text-xs font-semibold text-gray-200">2. 触达渠道与 Webhook / Bot 配置</div>

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
                  className="accent-sky-400 w-4 h-4 rounded"
                />
                <label htmlFor="ch-tg" className="text-xs font-bold text-white cursor-pointer flex items-center gap-1.5">
                  <SendHorizontal className="w-3.5 h-3.5 text-sky-400" />
                  <span>✈️ Telegram 机器人 (HTML 研报 & 双向 Agent 对话)</span>
                  <span className="text-[10px] px-1.5 py-0.2 rounded bg-sky-500/20 text-sky-300 border border-sky-500/30 font-semibold">
                    ⚡ 支持双向对话
                  </span>
                </label>
                <HelpTooltip
                  title="✈️ Telegram 机器人极速配置与双向对话"
                  content={
                    <div className="space-y-1.5">
                      <div><b>第 1 步：创建机器人</b><br />在 TG 搜索 <code>@BotFather</code> 发送 <code>/newbot</code>，获取您的专属 <b>Bot Token</b>。</div>
                      <div><b>第 2 步：激活私聊 (必做)</b><br />在 TG 搜索您刚创建的 Bot 名称，点击底部的 <b>「Start」</b> 授权接收消息。</div>
                      <div><b>第 3 步：获取 Chat ID</b><br />在 TG 搜索 <code>@userinfobot</code> 发送任意文字，回复中的 <code>Id: xxx</code> 即为 <b>Chat ID</b>。</div>
                      <div className="pt-1 border-t border-white/10 text-sky-300 font-semibold">
                        💡 配置后即可直接向 Bot 发送 /summary, /xray, /alerts, /morning 或任意投资问题！
                      </div>
                    </div>
                  }
                />
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
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[11px] text-default-400 flex items-center">
                    <span>Bot Token (发件人密钥)</span>
                    <HelpTooltip
                      title="Bot Token 说明"
                      content="机器人的身份认证密钥，由 @BotFather 生成，格式如：5849382910:AAHkxxxx_xxxxxxxx"
                    />
                  </label>
                </div>
                <input
                  type="text"
                  value={form.telegram_bot_token}
                  onChange={(e) => setForm({ ...form, telegram_bot_token: e.target.value })}
                  placeholder="5849382910:AAH_xxxxxxxxxxxxxxxx"
                  className="w-full px-3.5 py-2 rounded-xl bg-[#1a1d27] border border-white/10 text-xs text-gray-100 placeholder:text-gray-500 focus:outline-none focus:border-sky-400 font-mono"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[11px] text-default-400 flex items-center">
                    <span>Chat ID (收件人数字 ID)</span>
                    <HelpTooltip
                      title="Chat ID 说明"
                      content="接收私聊的个人账号纯数字 ID（如 123456789），或群组/频道 ID（如 -1001234567890），可在 @userinfobot 发消息获取"
                    />
                  </label>
                </div>
                <input
                  type="text"
                  value={form.telegram_chat_id}
                  onChange={(e) => setForm({ ...form, telegram_chat_id: e.target.value })}
                  placeholder="-1001234567890 或 12345678"
                  className="w-full px-3.5 py-2 rounded-xl bg-[#1a1d27] border border-white/10 text-xs text-gray-100 placeholder:text-gray-500 focus:outline-none focus:border-sky-400 font-mono"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-[11px] text-default-400 flex items-center">
                  <span>API 反代地址 (选填)</span>
                  <HelpTooltip
                    title="Telegram API 反代地址"
                    content="如果您的服务器部署在国内无法直连 api.telegram.org，可填入您搭建的 Cloudflare Worker 或反代域名；在本地/海外直接保持默认即可"
                  />
                </label>
              </div>
              <input
                type="text"
                value={form.telegram_api_host}
                onChange={(e) => setForm({ ...form, telegram_api_host: e.target.value })}
                placeholder="https://api.telegram.org"
                className="w-full px-3.5 py-1.5 rounded-xl bg-[#1a1d27] border border-white/10 text-xs text-gray-300 placeholder:text-gray-500 focus:outline-none focus:border-sky-400 font-mono text-[11px]"
              />
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
                  className="accent-primary w-4 h-4 rounded"
                />
                <label htmlFor="ch-feishu" className="text-xs font-bold text-white cursor-pointer flex items-center">
                  <span>💬 飞书自定义机器人 (富文本互动卡片)</span>
                </label>
                <HelpTooltip
                  title="💬 飞书机器人配置方法"
                  content="在飞书群右上角点击「设置」➔「群机器人」➔「添加自定义机器人」➔ 复制生成的 Webhook 地址粘贴在此即可。"
                />
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
                  className="accent-primary w-4 h-4 rounded"
                />
                <label htmlFor="ch-wechat" className="text-xs font-bold text-white cursor-pointer flex items-center">
                  <span>🏢 企业微信群机器人 (Markdown 消息)</span>
                </label>
                <HelpTooltip
                  title="🏢 企业微信机器人配置方法"
                  content="在企业微信群右上角点击「添加群机器人」➔「新创机器人」➔ 复制 Webhook 地址粘贴在此即可。"
                />
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
                  className="accent-primary w-4 h-4 rounded"
                />
                <label htmlFor="ch-email" className="text-xs font-bold text-white cursor-pointer flex items-center">
                  <span>📬 电子邮箱通知 (深色模式排版 HTML 研报)</span>
                </label>
                <HelpTooltip
                  title="📬 电子邮箱订阅说明"
                  content="填入常用邮箱（如 QQ邮箱 / 163邮箱 / Gmail），研报与风险哨兵将以自适应深色 HTML 排版直达您的收件箱。"
                />
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
