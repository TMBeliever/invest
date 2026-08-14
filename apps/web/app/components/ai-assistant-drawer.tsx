"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { useAuthStore, useStockDetailStore } from "@investscope/core";
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
  History,
  Plus,
  MessageSquare,
  GripHorizontal,
  Cpu,
  ChevronDown,
  Zap,
} from "lucide-react";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
}

interface ChatSession {
  id: string;
  title: string;
  summary?: string;
  created_at: string;
  updated_at: string;
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "";

export const AVAILABLE_MODELS = [
  { id: "gemini-flash-lite-latest", name: "Gemini Flash Lite", tag: "极速低延时" },
  { id: "gemini-2.5-flash", name: "Gemini 2.5 Flash", tag: "经典稳定" },
  { id: "gemini-3.5-flash", name: "Gemini 3.5 Flash", tag: "综合主力" },
  { id: "gemini-3.6-flash", name: "Gemini 3.6 Flash", tag: "平衡升级" },
  { id: "gemini-3.7-flash", name: "Gemini 3.7 Flash", tag: "前沿旗舰" },
];

function FormattedMarkdown({ content }: { content: string }) {
  if (!content) return null;

  const lines = content.split("\n");
  const elements: React.ReactNode[] = [];

  let inTable = false;
  let tableHeader: string[] = [];
  let tableRows: string[][] = [];

  const parseInline = (text: string): React.ReactNode => {
    if (!text) return "";
    const parts = text.split(/(\*\*.*?\*\*|`.*?`)/g);
    return parts.map((part, idx) => {
      if (part.startsWith("**") && part.endsWith("**") && part.length >= 4) {
        return (
          <strong key={idx} className="font-semibold text-primary">
            {part.slice(2, -2)}
          </strong>
        );
      }
      if (part.startsWith("`") && part.endsWith("`") && part.length >= 2) {
        return (
          <code key={idx} className="px-1 py-0.5 rounded bg-primary/20 text-primary font-mono text-[10px]">
            {part.slice(1, -1)}
          </code>
        );
      }
      return part;
    });
  };

  const flushTable = (keyPrefix: string) => {
    if (tableRows.length > 0 || tableHeader.length > 0) {
      elements.push(
        <div key={`${keyPrefix}-table`} className="my-2 overflow-x-auto rounded-lg border border-white/15 bg-[#16171d]">
          <table className="w-full text-left text-[11px] border-collapse">
            {tableHeader.length > 0 && (
              <thead>
                <tr className="bg-primary/15 border-b border-white/10 text-primary font-bold">
                  {tableHeader.map((th, i) => (
                    <th key={i} className="px-2.5 py-1.5 whitespace-nowrap">
                      {parseInline(th)}
                    </th>
                  ))}
                </tr>
              </thead>
            )}
            <tbody>
              {tableRows.map((row, ri) => (
                <tr key={ri} className="border-b border-white/5 hover:bg-white/5">
                  {row.map((cell, ci) => (
                    <td key={ci} className="px-2.5 py-1.5 text-gray-200">
                      {parseInline(cell)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }
    inTable = false;
    tableHeader = [];
    tableRows = [];
  };

  for (let index = 0; index < lines.length; index++) {
    const line = lines[index];
    const trimmed = line.trim();

    if (trimmed.startsWith("|") && trimmed.endsWith("|")) {
      const cells = trimmed
        .split("|")
        .slice(1, -1)
        .map((c) => c.trim());

      if (cells.every((c) => /^:?-+:?$/.test(c))) {
        continue;
      }

      if (!inTable) {
        inTable = true;
        tableHeader = cells;
      } else {
        tableRows.push(cells);
      }
      continue;
    } else if (inTable) {
      flushTable(`tb-${index}`);
    }

    if (!trimmed) {
      elements.push(<div key={`sp-${index}`} className="h-1" />);
      continue;
    }

    if (trimmed === "---" || trimmed === "***") {
      elements.push(<hr key={`hr-${index}`} className="my-2 border-white/15" />);
      continue;
    }

    const headingMatch = trimmed.match(/^(#{1,6})\s+(.*)$/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      const text = headingMatch[2];
      const textSizeClass =
        level === 1
          ? "text-base font-extrabold text-primary mt-3 mb-1"
          : level === 2
          ? "text-sm font-bold text-primary mt-2.5 mb-1"
          : level === 3
          ? "text-xs font-bold text-primary mt-2 mb-1 flex items-center gap-1"
          : "text-xs font-semibold text-emerald-400 mt-2 mb-1 flex items-center gap-1";

      elements.push(
        <div key={`h-${index}`} className={textSizeClass}>
          {parseInline(text)}
        </div>
      );
      continue;
    }

    if (trimmed.startsWith("> ")) {
      elements.push(
        <div key={`bq-${index}`} className="pl-2.5 py-1 border-l-2 border-primary/70 bg-primary/10 text-gray-200 rounded-r my-1 text-[11px] leading-relaxed">
          {parseInline(trimmed.slice(2))}
        </div>
      );
      continue;
    }

    if (/^[-*]\s/.test(trimmed)) {
      elements.push(
        <div key={`li-${index}`} className="flex items-start gap-1.5 ml-1 my-0.5 text-xs text-gray-200">
          <span className="text-primary font-bold">•</span>
          <span className="flex-1 leading-relaxed">{parseInline(trimmed.slice(2))}</span>
        </div>
      );
      continue;
    }

    if (/^\d+\.\s/.test(trimmed)) {
      const match = trimmed.match(/^(\d+)\.\s(.*)$/);
      if (match) {
        elements.push(
          <div key={`nli-${index}`} className="flex items-start gap-1.5 ml-1 my-0.5 text-xs text-gray-200">
            <span className="text-primary font-semibold text-[11px]">{match[1]}.</span>
            <span className="flex-1 leading-relaxed">{parseInline(match[2])}</span>
          </div>
        );
        continue;
      }
    }

    elements.push(
      <p key={`p-${index}`} className="leading-relaxed text-xs text-gray-200">
        {parseInline(line)}
      </p>
    );
  }

  if (inTable) {
    flushTable("end");
  }

  return <div className="space-y-1">{elements}</div>;
}

export function AIAssistantDrawer() {
  const pathname = usePathname();
  const { quote, financialAnalysis } = useStockDetailStore();

  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // 窗口尺寸与定位 (拖拽 + 8方向拉伸)
  const [size, setSize] = useState({ width: 440, height: 640 });
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);

  const dragStartRef = useRef<{ x: number; y: number } | null>(null);
  const resizeRef = useRef<{
    dir: string;
    startX: number;
    startY: number;
    startW: number;
    startH: number;
    startPosX: number;
    startPosY: number;
  } | null>(null);

  // 会话与消息状态
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [selectedModel, setSelectedModel] = useState<string>("gemini-flash-lite-latest");

  // 初始化与持久化保存模型偏好
  useEffect(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("investscope-ai-model");
      if (saved && AVAILABLE_MODELS.some((m) => m.id === saved)) {
        setSelectedModel(saved);
      }
    }
  }, []);

  const handleModelChange = (modelId: string) => {
    setSelectedModel(modelId);
    if (typeof window !== "undefined") {
      localStorage.setItem("investscope-ai-model", modelId);
    }
  };

  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "assistant",
      content:
        "👋 您好！我是 **InvestScope 智能 AI 投资顾问**。\n\n已自动为您实时锁定：\n- 您的真实持仓与预估年现金流收益\n- 10 年期国债收益率与跨市场 15 大指数\n\n您可以随时问我关于**持仓诊断**、**资金配置建议**或**市场风向分析**！",
    },
  ]);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // 动态构建全页面上下文感知的 Smart Prompt Chips
  const getContextSmartPrompts = () => {
    if (pathname.startsWith("/dividend/") && pathname !== "/dividend") {
      const urlCode = pathname.split("/")[2] || "";
      const decodedName = decodeURIComponent(urlCode);
      const stockName = quote?.name || financialAnalysis?.name || decodedName;

      return {
        contextTag: `📌 当前【${stockName}】专属分析:`,
        prompts: [
          `📊 帮我解读【${stockName}】的最新财报与排雷体检`,
          `📈 分析【${stockName}】今日盘中表现与变动原因`,
          `💰 计算买入【${stockName}】的建仓股息率与现金流`,
          `🔮 查看【${stockName}】的卖方分析师一致预期`,
        ],
      };
    }

    if (pathname === "/dividend") {
      return {
        contextTag: "📌 红利选股大厅专属分析:",
        prompts: [
          "🔥 分析当前红利板块的估值温度与水温",
          "🏆 帮我推荐 3 只稳定分红 10 年的高股息龙头",
          "⚖️ 破净高股息 vs 高 ROE 策略怎么选",
          "🛡️ 防守型高股息组合如何配置",
        ],
      };
    }

    if (pathname === "/market") {
      return {
        contextTag: "📌 宏观大盘专属分析:",
        prompts: [
          "📈 评估当前股债风险溢价比 (ERP) 胜率",
          "🌐 中证红利 (000922) 当前适合按月定投吗",
          "💵 10 年期国债收益率 1.7% 下怎么做资产配置",
          "🏦 利率下行周期高股息资产怎么配",
        ],
      };
    }

    return {
      contextTag: "📌 资产配置与账户诊断提示词:",
      prompts: [
        "💡 一键诊断我的持仓结构与收益风险",
        "🛡️ 检查我的现金避险仓与防守比例",
        "💰 我有 5 万元闲置资金结合持仓怎么配",
        "🏦 到期定期存款收益如何最大化",
      ],
    };
  };

  const currentContextPrompts = getContextSmartPrompts();

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  // 加载会话列表
  const fetchSessions = async () => {
    try {
      const token = useAuthStore.getState().token;
      if (!token) return;
      const res = await fetch(`${API_BASE}/api/ai/sessions`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setSessions(data);
      }
    } catch {
      // ignore
    }
  };

  // 切换会话
  const loadSession = async (sessionId: string) => {
    setLoading(true);
    setCurrentSessionId(sessionId);
    setShowHistory(false);
    try {
      const token = useAuthStore.getState().token;
      const res = await fetch(`${API_BASE}/api/ai/sessions/${sessionId}/messages`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const dbMsgs = await res.json();
        setMessages(
          dbMsgs.map((m: any) => ({
            id: m.id,
            role: m.role,
            content: m.content,
          }))
        );
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  // 创建新会话
  const handleNewSession = async () => {
    try {
      const token = useAuthStore.getState().token;
      const res = await fetch(`${API_BASE}/api/ai/sessions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ title: "新对话" }),
      });
      if (res.ok) {
        const data = await res.json();
        setCurrentSessionId(data.sessionId);
        setMessages([
          {
            id: "welcome",
            role: "assistant",
            content: "✨ 已开启全新对话！随时向我提问。",
          },
        ]);
        fetchSessions();
      }
    } catch {
      // ignore
    }
  };

  // 删除会话
  const handleDeleteSession = async (sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const token = useAuthStore.getState().token;
      await fetch(`${API_BASE}/api/ai/sessions/${sessionId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (currentSessionId === sessionId) {
        setCurrentSessionId(null);
        setMessages([]);
      }
      fetchSessions();
    } catch {
      // ignore
    }
  };

  // 当窗口第一次打开时，自动计算屏幕右下角绝对像素位置 (x, y)
  useEffect(() => {
    if (isOpen && position.x === 0 && position.y === 0) {
      const initX = Math.max(16, window.innerWidth - size.width - 24);
      const initY = Math.max(16, window.innerHeight - size.height - 24);
      setPosition({ x: initX, y: initY });
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && !isMinimized && !showHistory) {
      scrollToBottom();
    }
  }, [messages, isOpen, isMinimized, showHistory]);

  // 拖拽与 8 方向独立拉伸处理
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging && dragStartRef.current) {
        const newX = Math.max(0, Math.min(window.innerWidth - size.width, e.clientX - dragStartRef.current.x));
        const newY = Math.max(0, Math.min(window.innerHeight - (isMinimized ? 60 : size.height), e.clientY - dragStartRef.current.y));
        setPosition({ x: newX, y: newY });
      }

      if (isResizing && resizeRef.current) {
        const { dir, startX, startY, startW, startH, startPosX, startPosY } = resizeRef.current;
        const dx = e.clientX - startX;
        const dy = e.clientY - startY;

        let newW = startW;
        let newH = startH;
        let newX = startPosX;
        let newY = startPosY;

        // 右边拉伸 (Top-Left 保持不动)
        if (dir.includes("e")) {
          newW = Math.max(360, Math.min(window.innerWidth - startPosX - 10, startW + dx));
        }

        // 左边拉伸 (右边框保持不动，只改变 width 和 left)
        if (dir.includes("w")) {
          const maxW = startW + startPosX;
          const potentialW = Math.max(360, Math.min(maxW, startW - dx));
          newX = startPosX + (startW - potentialW);
          newW = potentialW;
        }

        // 下边拉伸 (Top-Left 保持不动)
        if (dir.includes("s")) {
          newH = Math.max(420, Math.min(window.innerHeight - startPosY - 10, startH + dy));
        }

        // 上边拉伸 (下边框保持不动，只改变 height 和 top)
        if (dir.includes("n")) {
          const maxH = startH + startPosY;
          const potentialH = Math.max(420, Math.min(maxH, startH - dy));
          newY = startPosY + (startH - potentialH);
          newH = potentialH;
        }

        setSize({ width: newW, height: newH });
        setPosition({ x: newX, y: newY });
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      setIsResizing(false);
    };

    if (isDragging || isResizing) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
    }
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging, isResizing, size.width, size.height, isMinimized]);

  const handleHeaderMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest("button")) return;
    setIsDragging(true);
    dragStartRef.current = {
      x: e.clientX - position.x,
      y: e.clientY - position.y,
    };
  };

  const handleResizeMouseDown = (dir: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsResizing(true);
    resizeRef.current = {
      dir,
      startX: e.clientX,
      startY: e.clientY,
      startW: size.width,
      startH: size.height,
      startPosX: position.x,
      startPosY: position.y,
    };
  };

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
        sessionId: currentSessionId,
        messages: newMessages.map((m) => ({ role: m.role, content: m.content })),
        model: selectedModel,
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
      let buffer = "";

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          // 将末尾可能不完整的一行留存到下一次 chunk 到达时拼接
          buffer = lines.pop() || "";

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed.startsWith("data: ")) continue;
            const dataContent = trimmed.slice(6).trim();
            if (dataContent === "[DONE]") break;
            try {
              const parsed = JSON.parse(dataContent);
              if (parsed.sessionId && !currentSessionId) {
                setCurrentSessionId(parsed.sessionId);
              }
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
              // ignore
            }
          }
        }
      }
      fetchSessions();
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

      {/* 展开的可拖拽拉伸 AI 对话抽屉 */}
      {isOpen && (
        <div
          style={{
            left: `${position.x}px`,
            top: `${position.y}px`,
            width: `${size.width}px`,
            height: isMinimized ? "60px" : `${size.height}px`,
          }}
          className="fixed z-50 bg-[#121316] border border-primary/30 shadow-2xl rounded-2xl flex flex-col overflow-hidden transition-shadow duration-300 select-none"
        >
          {/* 8 方向拉伸 Edge Handles */}
          {!isMinimized && (
            <>
              <div onMouseDown={(e) => handleResizeMouseDown("nw", e)} className="absolute top-0 left-0 w-3.5 h-3.5 cursor-nwse-resize z-20 hover:bg-primary/30 rounded-tl" />
              <div onMouseDown={(e) => handleResizeMouseDown("ne", e)} className="absolute top-0 right-0 w-3.5 h-3.5 cursor-nesw-resize z-20 hover:bg-primary/30 rounded-tr" />
              <div onMouseDown={(e) => handleResizeMouseDown("sw", e)} className="absolute bottom-0 left-0 w-3.5 h-3.5 cursor-nesw-resize z-20 hover:bg-primary/30 rounded-bl" />
              <div onMouseDown={(e) => handleResizeMouseDown("se", e)} className="absolute bottom-0 right-0 w-3.5 h-3.5 cursor-nwse-resize z-20 hover:bg-primary/30 rounded-br" />
              <div onMouseDown={(e) => handleResizeMouseDown("n", e)} className="absolute top-0 left-4 right-4 h-1.5 cursor-ns-resize z-10 hover:bg-primary/30" />
              <div onMouseDown={(e) => handleResizeMouseDown("s", e)} className="absolute bottom-0 left-4 right-4 h-1.5 cursor-ns-resize z-10 hover:bg-primary/30" />
              <div onMouseDown={(e) => handleResizeMouseDown("w", e)} className="absolute left-0 top-4 bottom-4 w-1.5 cursor-ew-resize z-10 hover:bg-primary/30" />
              <div onMouseDown={(e) => handleResizeMouseDown("e", e)} className="absolute right-0 top-4 bottom-4 w-1.5 cursor-ew-resize z-10 hover:bg-primary/30" />
            </>
          )}

          {/* Header 拖拽抓手栏 */}
          <div
            onMouseDown={handleHeaderMouseDown}
            className="p-3.5 border-b border-white/10 flex items-center justify-between bg-[#1a1c22] cursor-grab active:cursor-grabbing"
          >
            <div className="flex items-center gap-2.5">
              <GripHorizontal className="w-4 h-4 text-default-500 opacity-60" />
              <div className="p-1 rounded-lg bg-primary/20 text-primary">
                <Bot className="w-4 h-4" />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-bold tracking-tight text-white">InvestScope AI 投资顾问</span>
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                </div>
                <span className="text-[10px] text-default-400">时间+持仓死锁 · 智能上下文压缩</span>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={handleNewSession}
                title="新建对话"
                className="p-1.5 rounded-md text-default-400 hover:text-foreground hover:bg-white/10 transition-colors flex items-center gap-1 text-[11px]"
              >
                <Plus className="w-3.5 h-3.5 text-primary" />
                <span className="hidden sm:inline">新对话</span>
              </button>
              <button
                onClick={() => setShowHistory(!showHistory)}
                title="历史对话"
                className={`p-1.5 rounded-md transition-colors ${
                  showHistory ? "bg-primary/20 text-primary" : "text-default-400 hover:text-foreground hover:bg-white/10"
                }`}
              >
                <History className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setIsMinimized(!isMinimized)}
                title={isMinimized ? "展开窗口" : "最小化"}
                className="p-1 rounded-md text-default-400 hover:text-foreground hover:bg-white/10 transition-colors"
              >
                {isMinimized ? <Maximize2 className="w-3.5 h-3.5" /> : <Minimize2 className="w-3.5 h-3.5" />}
              </button>
              <button
                onClick={() => setIsOpen(false)}
                title="关闭"
                className="p-1 rounded-md text-default-400 hover:text-foreground hover:bg-white/10 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {!isMinimized && (
            <>
              {/* 模型选择器栏 */}
              <div className="px-3.5 py-2 bg-[#16181f] border-b border-white/5 flex items-center justify-between text-xs">
                <div className="flex items-center gap-1.5 text-default-400 text-[11px]">
                  <Cpu className="w-3.5 h-3.5 text-primary" />
                  <span>AI 模型:</span>
                </div>
                <div className="relative">
                  <select
                    value={selectedModel}
                    onChange={(e) => handleModelChange(e.target.value)}
                    className="bg-[#20222a] text-white text-[11px] font-medium rounded-lg px-2.5 py-1 pr-6 border border-white/10 focus:border-primary focus:outline-none appearance-none cursor-pointer hover:border-primary/50 transition-colors"
                  >
                    {AVAILABLE_MODELS.map((m) => (
                      <option key={m.id} value={m.id} className="bg-[#1a1c22] text-white">
                        {m.name} ({m.tag})
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="w-3 h-3 text-default-400 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </div>
              {/* 历史对话列表侧栏视图 */}
              {showHistory ? (
                <div className="flex-1 p-3 overflow-y-auto bg-[#141519] space-y-2 text-xs">
                  <div className="flex items-center justify-between pb-2 border-b border-white/10 text-default-400 text-[11px]">
                    <span>📜 历史对话记录 ({sessions.length})</span>
                    <button onClick={handleNewSession} className="text-primary hover:underline flex items-center gap-1 font-medium">
                      <Plus className="w-3 h-3" /> 新建对话
                    </button>
                  </div>
                  {sessions.length === 0 ? (
                    <div className="p-8 text-center text-default-500 text-xs">暂无历史对话记录</div>
                  ) : (
                    sessions.map((s) => (
                      <div
                        key={s.id}
                        onClick={() => loadSession(s.id)}
                        className={`p-2.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between group ${
                          currentSessionId === s.id
                            ? "bg-primary/15 border-primary/40 text-primary font-medium"
                            : "bg-[#1c1e24] border-white/5 text-gray-300 hover:bg-white/10"
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0 pr-2">
                          <MessageSquare className="w-3.5 h-3.5 shrink-0 opacity-70" />
                          <span className="truncate text-xs">{s.title || "新对话"}</span>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-[10px] text-default-500">{s.updated_at?.slice(5, 16)}</span>
                          <button
                            onClick={(e) => handleDeleteSession(s.id, e)}
                            className="opacity-0 group-hover:opacity-100 p-1 hover:text-rose-400 transition-opacity"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              ) : (
                <>
                  {/* 消息列表视图 */}
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
                              className={`p-3 rounded-2xl leading-relaxed ${
                                isUser
                                  ? "bg-primary text-primary-foreground rounded-tr-xs shadow-md whitespace-pre-wrap"
                                  : "bg-[#1c1e24] text-gray-100 border border-white/10 rounded-tl-xs shadow-md"
                              }`}
                            >
                              {isUser ? (
                                msg.content
                              ) : (
                                <FormattedMarkdown content={msg.content} />
                              )}
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

                  {/* 上下文感知的 Smart Prompt Chips 推荐提问 */}
                  {messages.length <= 2 && (
                    <div className="px-3 py-2 border-t border-white/10 bg-[#16181e]">
                      <div className="text-[10px] text-primary mb-1.5 font-medium flex items-center gap-1">
                        <span>{currentContextPrompts.contextTag}</span>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {currentContextPrompts.prompts.map((qp, i) => (
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

                  {/* 输入框区域 */}
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
                        placeholder="问问 AI：诊断持仓 / 股票排雷 / 资金建议..."
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
            </>
          )}
        </div>
      )}
    </>
  );
}
