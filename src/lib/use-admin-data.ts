"use client";
import { DependencyList, useCallback, useEffect, useState } from "react";

interface AdminDataState<T> {
  data: T | null;
  loading: boolean;
  error: string;
  reload: () => void;
  setData: (value: T) => void;
}

const adminDataCache = new Map<string, { data: any; timestamp: number }>();

/** Loads an admin endpoint, instantly returning cached data if available and refreshing in the background. */
export function useAdminData<T>(loader: () => Promise<T>, deps: DependencyList, cacheKey?: string): AdminDataState<T> {
  const loaderSource = loader.toString().replace(/\s+/g, " ").trim();
  const key = cacheKey || `${loaderSource}::${JSON.stringify(deps)}`;
  const cached = adminDataCache.get(key);

  const [data, setData] = useState<T | null>(cached ? (cached.data as T) : null);
  const [loading, setLoading] = useState(!cached);
  const [error, setError] = useState("");
  const [nonce, setNonce] = useState(0);

  // The loader closes over the caller's own dependencies, which are passed through.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const run = useCallback(loader, deps);

  useEffect(() => {
    let cancelled = false;
    // If not cached, show loading state
    if (!adminDataCache.has(key)) {
      setLoading(true);
    }
    run()
      .then((result) => {
        if (!cancelled) {
          adminDataCache.set(key, { data: result, timestamp: Date.now() });
          setData(result);
          setError("");
        }
      })
      .catch((cause) => {
        if (!cancelled) setError(cause instanceof Error ? cause.message : "Unable to load this view");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [run, nonce, key]);

  return {
    data,
    loading: loading && !data,
    error,
    reload: () => {
      adminDataCache.delete(key);
      setNonce((value) => value + 1);
    },
    setData: (value: T) => {
      adminDataCache.set(key, { data: value, timestamp: Date.now() });
      setData(value);
    },
  };
}
