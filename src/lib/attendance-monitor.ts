interface MonitorEnvironment {
  visible: () => boolean;
  schedule: (callback: () => void, ms: number) => ReturnType<typeof setTimeout>;
  cancel: (timer: ReturnType<typeof setTimeout>) => void;
  onResume: (callback: () => void) => () => void;
}

/** One lightweight, non-overlapping poll shared by all mounted attendance views. */
export function createAttendanceMonitor(
  fetchRevision: (signal: AbortSignal) => Promise<{ revision: string }>,
  env: MonitorEnvironment,
  intervalMs = 2000,
) {
  const listeners = new Set<() => void>();
  let revision: string | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let active: AbortController | undefined;
  let removeResume: (() => void) | undefined;

  function schedule() {
    if (timer !== undefined) env.cancel(timer);
    if (listeners.size) timer = env.schedule(() => { timer = undefined; void poll(); }, intervalMs);
  }

  async function poll() {
    if (!listeners.size || active) return;
    if (!env.visible()) { schedule(); return; }
    const controller = new AbortController();
    active = controller;
    const timeout = env.schedule(() => controller.abort(), 10000);
    try {
      const next = await fetchRevision(controller.signal);
      if (controller.signal.aborted || active !== controller || !listeners.size) return;
      const changed = revision !== undefined && next.revision !== revision;
      revision = next.revision;
      if (changed) for (const listener of listeners) listener();
    } catch {
      // Keep the last valid revision and retry; an outage must not erase displayed data.
    } finally {
      env.cancel(timeout);
      if (active === controller) { active = undefined; schedule(); }
    }
  }

  return (listener: () => void) => {
    listeners.add(listener);
    if (listeners.size === 1) {
      removeResume = env.onResume(() => {
        if (env.visible()) void poll();
      });
      void poll();
    }
    return () => {
      listeners.delete(listener);
      if (!listeners.size) {
        if (timer !== undefined) env.cancel(timer);
        timer = undefined;
        const controller = active;
        active = undefined;
        controller?.abort();
        removeResume?.();
        removeResume = undefined;
        revision = undefined;
      }
    };
  };
}
