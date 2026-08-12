import { useState, useEffect, useCallback, useRef } from "react";

interface UseFetchOptions {
  /** 是否立即执行 (默认 true) */
  immediate?: boolean;
  /** 缓存时间 (ms)，0 = 不缓存 */
  cacheMs?: number;
}

interface UseFetchReturn<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

/**
 * 通用的 fetch hook
 */
export function useFetch<T>(
  fetcher: () => Promise<T>,
  deps: unknown[] = [],
  options: UseFetchOptions = {},
): UseFetchReturn<T> {
  const { immediate = true, cacheMs = 0 } = options;
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lastFetchedRef = useRef(0);

  const execute = useCallback(async () => {
    if (cacheMs > 0 && Date.now() - lastFetchedRef.current < cacheMs) return;

    setLoading(true);
    setError(null);
    try {
      const result = await fetcher();
      setData(result);
      lastFetchedRef.current = Date.now();
    } catch (err) {
      setError(err instanceof Error ? err.message : "请求失败");
    } finally {
      setLoading(false);
    }
  }, deps);

  useEffect(() => {
    if (immediate) {
      execute();
    }
  }, [execute, immediate]);

  return { data, loading, error, refetch: execute };
}

/**
 * 定时轮询 hook
 */
export function useIntervalFetch<T>(
  fetcher: () => Promise<T>,
  intervalMs: number,
  deps: unknown[] = [],
): UseFetchReturn<T> {
  const result = useFetch(fetcher, deps);

  useEffect(() => {
    if (intervalMs <= 0) return;
    const timer = setInterval(() => {
      result.refetch();
    }, intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs]);

  return result;
}
