"use client";
import { DependencyList, useCallback, useEffect, useState } from "react";

interface AdminDataState<T> {
  data: T | null;
  loading: boolean;
  error: string;
  reload: () => void;
  setData: (value: T) => void;
}

/** Loads an admin endpoint, keeping the previous result visible while refreshing. */
export function useAdminData<T>(loader: () => Promise<T>, deps: DependencyList): AdminDataState<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [nonce, setNonce] = useState(0);

  // The loader closes over the caller's own dependencies, which are passed through.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const run = useCallback(loader, deps);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    run()
      .then((result) => { if (!cancelled) { setData(result); setError(""); } })
      .catch((cause) => { if (!cancelled) setError(cause instanceof Error ? cause.message : "Unable to load this view"); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [run, nonce]);

  return { data, loading: loading && !data, error, reload: () => setNonce((value) => value + 1), setData };
}
