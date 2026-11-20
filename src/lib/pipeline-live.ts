"use client";
import { DependencyList, useEffect, useRef } from 'react';
import { openPipelineStream } from './api';
import { createPipelineMonitor, createPipelineRefresh } from './pipeline-monitor';

const subscribe = createPipelineMonitor(openPipelineStream, {
  schedule: (callback, ms) => setTimeout(callback, ms), cancel: timer => clearTimeout(timer), now: () => Date.now(),
  onResume: callback => {
    const resume = () => { if (document.visibilityState === 'visible') callback(); };
    window.addEventListener('online', resume); window.addEventListener('focus', resume);
    document.addEventListener('visibilitychange', resume);
    return () => { window.removeEventListener('online', resume); window.removeEventListener('focus', resume); document.removeEventListener('visibilitychange', resume); };
  },
});

export function usePipelineRefresh(load: (signal: AbortSignal) => Promise<unknown>, deps: DependencyList = []) {
  const latest = useRef(load); latest.current = load;
  useEffect(() => {
    const controller = new AbortController();
    const refresh = createPipelineRefresh(() => controller.signal.aborted ? Promise.resolve() : latest.current(controller.signal));
    const unsubscribe = subscribe(refresh);
    return () => { controller.abort(); refresh.dispose(); unsubscribe(); };
  // The caller supplies scope/filter dependencies; callbacks always use the latest closure.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}
