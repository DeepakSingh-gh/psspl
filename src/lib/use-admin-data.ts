"use client";
import { DependencyList, useCallback, useEffect, useState } from "react";
import { subscribeAdminAttendance } from "./admin-attendance-live";

interface AdminDataState<T> {
  data: T | null;
  loading: boolean;
  error: string;
  reload: () => void;
  setData: (value: T) => void;
}

const adminDataCache = new Map<string, { data: any; timestamp: number }>();

/** Loads an admin endpoint, instantly returning cached data if available and refreshing in the background. */
export function useAdminData<T>(loader: () => Promise<T>, deps: DependencyList, cacheKey?: string, liveAttendance = false): AdminDataState<T> {
  const loaderSource = loader.toString().replace(/\s+/g, " ").trim();
  const key = cacheKey || `${loaderSource}::${JSON.stringify(deps)}`;
  const cached = adminDataCache.get(key);

  const [data, setData] = useState<T | null>(cached ? (cached.data as T) : null);
  const [loading, setLoading] = useState(!cached);
  const [error, setError] = useState("");
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    const clear = () => {
      adminDataCache.clear();
      setData(null);
      setLoading(true);
      setNonce((value) => value + 1);
    };
    window.addEventListener("psspl:session-cleared", clear);
    return () => window.removeEventListener("psspl:session-cleared", clear);
  }, []);

  // The loader closes over the caller's own dependencies, which are passed through.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const run = useCallback(loader, deps);

  useEffect(() => {
    const refresh = (event: Event) => {
      const request = event as CustomEvent<{ tasks: Promise<unknown>[] }>;
      adminDataCache.delete(key);
      const task = run()
        .then((result) => {
          adminDataCache.set(key, { data: result, timestamp: Date.now() });
          setData(result);
          setError("");
        })
        .catch((cause) => {
          setError(cause instanceof Error ? cause.message : "Unable to refresh this view");
          throw cause;
        });
      request.detail.tasks.push(task);
    };
    window.addEventListener("psspl:refresh-data", refresh);
    return () => window.removeEventListener("psspl:refresh-data", refresh);
  }, [key, run]);

  useEffect(() => {
    if (!liveAttendance) return;
    return subscribeAdminAttendance(() => {
      adminDataCache.delete(key);
      setNonce((value) => value + 1);
    });
  }, [key, liveAttendance]);

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
