import { useEffect, useRef, useState, useCallback } from "react";
import type { StockQuote } from "@investscope/data/schemas";

function getWsUrl(): string {
  if (process.env.NEXT_PUBLIC_WS_URL) {
    return process.env.NEXT_PUBLIC_WS_URL;
  }
  if (typeof window !== "undefined") {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const host = window.location.hostname;
    // 映射规则：前端 3000(本地开发) -> 后端 8000; 前端 3006(生产部署) -> 后端 8006; 其余情况自适应
    const port = window.location.port === "3006" ? "8006" : (window.location.port === "3000" ? "8000" : (window.location.port || "8000"));
    return `${protocol}//${host}:${port}/ws/quotes`;
  }
  return "ws://127.0.0.1:8000/ws/quotes";
}



export interface UseQuoteWsReturn {
  quotes: Record<string, StockQuote>;
  connected: boolean;
  subscribe: (codes: string[]) => void;
  unsubscribe: (codes: string[]) => void;
}

/**
 * 全局 WebSocket 共享订阅 Hook (支持单股详情页、自选股列表、组合持仓批量订阅)
 */
export function useQuoteWs(initialCodes: string[] = []): UseQuoteWsReturn {
  const [quotes, setQuotes] = useState<Record<string, StockQuote>>({});
  const [connected, setConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const subscribedCodesRef = useRef<Set<string>>(new Set(initialCodes));
  const reconnectTimerRef = useRef<NodeJS.Timeout | null>(null);

  const sendSubscribe = useCallback((codes: string[]) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN && codes.length > 0) {
      wsRef.current.send(JSON.stringify({ action: "subscribe", codes }));
    }
  }, []);

  const sendUnsubscribe = useCallback((codes: string[]) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN && codes.length > 0) {
      wsRef.current.send(JSON.stringify({ action: "unsubscribe", codes }));
    }
  }, []);

  const subscribe = useCallback((codes: string[]) => {
    codes.forEach((c) => subscribedCodesRef.current.add(c));
    sendSubscribe(codes);
  }, [sendSubscribe]);

  const unsubscribe = useCallback((codes: string[]) => {
    codes.forEach((c) => subscribedCodesRef.current.delete(c));
    sendUnsubscribe(codes);
  }, [sendUnsubscribe]);

  useEffect(() => {
    let isMounted = true;

    function connect() {
      if (wsRef.current && (wsRef.current.readyState === WebSocket.OPEN || wsRef.current.readyState === WebSocket.CONNECTING)) {
        return;
      }

      try {
        const ws = new WebSocket(getWsUrl());
        wsRef.current = ws;

        ws.onopen = () => {
          if (!isMounted) return;
          setConnected(true);
          // 连上后立即恢复订阅
          const codes = Array.from(subscribedCodesRef.current);
          if (codes.length > 0) {
            ws.send(JSON.stringify({ action: "subscribe", codes }));
          }
        };

        ws.onmessage = (event) => {
          if (!isMounted) return;
          try {
            const msg = JSON.parse(event.data);
            if (msg.type === "quote_update" && msg.data) {
              setQuotes((prev) => ({
                ...prev,
                ...msg.data,
              }));
            }
          } catch (err) {
            console.warn("[WS] 消息解析异常:", err);
          }
        };

        ws.onclose = () => {
          if (!isMounted) return;
          setConnected(false);
          wsRef.current = null;
          // 自动重连 (3s 延时)
          reconnectTimerRef.current = setTimeout(() => {
            if (isMounted) connect();
          }, 3000);
        };

        ws.onerror = (err) => {
          console.warn("[WS] 错误:", err);
          ws.close();
        };
      } catch (err) {
        console.error("[WS] 创建连接失败:", err);
      }
    }

    connect();

    return () => {
      isMounted = false;
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, []);

  return { quotes, connected, subscribe, unsubscribe };
}
