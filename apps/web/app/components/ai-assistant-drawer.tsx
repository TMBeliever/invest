"use client";

import { useEffect, useRef, useState } from "react";
import { useAuthStore } from "@investscope/core";
import {
  Bot,
  X,
  Send,
  Sparkles,
  RefreshCw,
  Trash2,
  Copy,
  Check,
  Minimize2,
  Maximize2,
} from "lucide-react";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
}

const QUICK_PROMPTS = [
  "💡 一键诊断我的持仓结构与风险",
  "💰 我有 5 万元闲置资金结合持仓怎么配",
  "📈 分析当前大盘股债风险溢价",
  "🏦 到期定期存款收益如何最大化",
];

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

export function AIAssistantDrawer() {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "assistant",
      content:
        "👋 您好！我是 **InvestScope 智能 AI 投资顾问**。\n\n已自动为您实时锁定：\n- 您的真实持仓与预估年现金流收益\n- 10 年期国债收益率与跨市场 15 大指数\n\n您可以随时问我关于**持仓诊断**、**资金配置建议**或**市场风向分析**！",
    },
  ]);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    if (isOpen && !isMinimized) {
      scrollToBottom();
    }
  }, [messages, isOpen, isMinimized]);

  const handleSend = async (customText?: string) => {
    const textToSend = (customText || input).trim();
    if (!textToSend || loading) return;

    const userMsgId = `user-${Date.now()}`;
    const assistantMsgId = `assistant-${Date.now()}`;

    const newMessages: Message[] = [
      ...messages,
      { id: userMsgId, role: "user", content: textToSend },
    ];

    setMessages([
      ...newMessages,
      { id: assistantMsgId, role: "assistant", content: "" },
    ]);

    if (!customText) setInput("");
    setLoading(true);

    try {
      const token = useAuthStore.getState().token;
      const apiPayload = {
        messages: newMessages.map((m) => ({ role: m.role, content: m.content })),
      };

      const res = await fetch(`${API_BASE}/api/ai/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(apiPayload),
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      let assistantReply = "";

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunkStr = decoder.decode(value, { stream: true });
          const lines = chunkStr.split("\n\n");

          for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed.startsWith("data: ")) {
              const dataContent = trimmed.slice(6).trim();
              if (dataContent === "[DONE]") break;
              try {
                const parsed = JSON.parse(dataContent);
                if (parsed.content) {
                  assistantReply += parsed.content;
                  setMessages((prev) =>
                    prev.map((msg) =>
                      msg.id === assistantMsgId
                        ? { ...msg, content: assistantReply }
                        : msg
                    )
                  );
                }
              } catch {
                // Ignore chunk parse error
              }
            }
          }
        }
      }
    } catch (e: any) {
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === assistantMsgId
            ? { ...msg, content: `[网络异常]: 无法连接 AI 接口 (${e.message})` }
            : msg
        )
      );
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleClear = () => {
    setMessages([
      {
        id: "welcome",
        role: "assistant",
        content: "对话已重置。您可以随时向我提问！",
      },
    ]);
  };

  return (
    <>
      {/* 全站右下角悬浮球 */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 right-6 z-50 px-4 py-3 rounded-full bg-gradient-to-r from-primary via-blue-600 to-indigo-600 text-white font-medium text-xs shadow-xl shadow-primary/25 hover:shadow-primary/40 hover:scale-105 transition-all flex items-center gap-2 group animate-bounce-subtle"
        >
          <div className="relative">
            <Bot className="w-5 h-5" />
            <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
          </div>
          <span>InvestScope AI 顾问</span>
          <Sparkles className="w-3.5 h-3.5 text-amber-300 group-hover:rotate-12 transition-transform" />
        </button>
      )}

      {/* 展开的 AI 对话抽屉 */}
      {isOpen && (
        <div
          className={`fixed right-4 bottom-4 z-50 w-[92vw] sm:w-[420px] bg-[#121316] border border-primary/30 shadow-2xl rounded-2xl flex flex-col overflow-hidden transition-all duration-300 ${
            isMinimized ? "h-[60px]" : "h-[620px] max-h-[85vh]"
          }`}
        >
          {/* Header */}
          <div className="p-3.5 border-b border-white/10 flex items-center justify-between bg-[#1a1c22]">
            <div className="flex items-center gap-2.5">
              <div className="p-1.5 rounded-lg bg-primary/20 text-primary">
                <Bot className="w-4 h-4" />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-bold tracking-tight text-white">InvestScope AI 投资顾问</span>
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                </div>
                <span className="text-[10px] text-default-400">带入持仓上下文 · SSE 流式打字</span>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={handleClear}
                title="清空对话"
                className="p-1 rounded-md text-default-400 hover:text-foreground hover:bg-default-100 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setIsMinimized(!isMinimized)}
                title={isMinimized ? "展开窗口" : "最小化"}
                className="p-1 rounded-md text-default-400 hover:text-foreground hover:bg-default-100 transition-colors"
              >
                {isMinimized ? <Maximize2 className="w-3.5 h-3.5" /> : <Minimize2 className="w-3.5 h-3.5" />}
              </button>
              <button
                onClick={() => setIsOpen(false)}
                title="关闭"
                className="p-1 rounded-md text-default-400 hover:text-foreground hover:bg-default-100 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {!isMinimized && (
            <>
              {/* Message List */}
              <div className="flex-1 p-4 overflow-y-auto space-y-3.5 text-xs bg-[#121316]">
                {messages.map((msg, idx) => {
                  const isUser = msg.role === "user";
                  const isLastAssistant = !isUser && idx === messages.length - 1;

                  return (
                    <div
                      key={msg.id}
                      className={`flex gap-2.5 ${isUser ? "justify-end" : "justify-start"}`}
                    >
                      {!isUser && (
                        <div className="w-6 h-6 rounded-full bg-primary/20 text-primary flex items-center justify-center shrink-0 mt-0.5">
                          <Bot className="w-3.5 h-3.5" />
                        </div>
                      )}

                      <div className="group relative max-w-[85%]">
                        <div
                          className={`p-3 rounded-2xl leading-relaxed whitespace-pre-wrap ${
                            isUser
                              ? "bg-primary text-primary-foreground rounded-tr-xs shadow-md"
                              : "bg-[#1c1e24] text-gray-100 border border-white/10 rounded-tl-xs shadow-md"
                          }`}
                        >
                          {msg.content}
                          {isLastAssistant && loading && (
                            <span className="inline-block w-1.5 h-3.5 ml-1 bg-emerald-400 animate-pulse align-middle" />
                          )}
                        </div>

                        {!isUser && msg.content && (
                          <div className="opacity-0 group-hover:opacity-100 transition-opacity absolute -bottom-5 left-1 flex items-center gap-1 text-[10px] text-default-400">
                            <button
                              onClick={() => handleCopy(msg.id, msg.content)}
                              className="hover:text-primary transition-colors flex items-center gap-0.5"
                            >
                              {copiedId === msg.id ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                              {copiedId === msg.id ? "已复制" : "复制"}
                            </button>
                          </div>
                        )}
                      </div>

                      {isUser && (
                        <div className="w-6 h-6 rounded-full bg-default-200 text-default-600 flex items-center justify-center shrink-0 mt-0.5 text-[10px] font-bold">
                          ME
                        </div>
                      )}
                    </div>
                  );
                })}

                <div ref={messagesEndRef} />
              </div>

              {/* Quick Prompts */}
              {messages.length <= 2 && (
                <div className="px-3 py-2 border-t border-white/10 bg-[#16181e]">
                  <div className="text-[10px] text-default-400 mb-1.5 font-medium">推荐快捷提问:</div>
                  <div className="flex flex-wrap gap-1">
                    {QUICK_PROMPTS.map((qp, i) => (
                      <button
                        key={i}
                        onClick={() => handleSend(qp)}
                        disabled={loading}
                        className="text-[10px] px-2 py-1 rounded-lg bg-[#20222a] hover:bg-primary/20 hover:text-primary border border-white/10 text-gray-300 transition-all text-left"
                      >
                        {qp}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Input Area */}
              <div className="p-3 border-t border-white/10 bg-[#141519]">
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleSend();
                  }}
                  className="flex items-center gap-2"
                >
                  <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="问问 AI：诊断我的持仓 / 资金调仓建议..."
                    disabled={loading}
                    className="flex-1 px-3 py-2 rounded-xl bg-[#202229] text-xs text-white placeholder:text-gray-400 border border-white/10 focus:border-primary focus:outline-none"
                  />
                  <button
                    type="submit"
                    disabled={!input.trim() || loading}
                    className="p-2 rounded-xl bg-primary text-primary-foreground disabled:opacity-40 hover:scale-105 transition-all shrink-0"
                  >
                    {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  </button>
                </form>
              </div>
            </>
          )}
        </div>
      )}
    </>
  );
}
