interface Environment {
  schedule: (callback: () => void, ms: number) => ReturnType<typeof setTimeout>;
  cancel: (timer: ReturnType<typeof setTimeout>) => void;
  now: () => number;
  onResume: (callback: () => void) => () => void;
}

/** Sequential background reads collapse bursts and never apply concurrent responses. */
export function createPipelineRefresh(load: () => Promise<unknown>, retry = { schedule: (fn: () => void, ms: number) => setTimeout(fn, ms), cancel: (timer: ReturnType<typeof setTimeout>) => clearTimeout(timer) }) {
  let running = false, queued = false, disposed = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  function refresh() {
    if (disposed) return;
    if (timer !== undefined) { retry.cancel(timer); timer = undefined; }
    queued = true;
    if (running) return;
    running = true;
    void (async () => {
      try {
        while (queued && !disposed) {
          queued = false;
          try { await load(); }
          catch {
            // Keep invalidation dirty even when the stream remains healthy.
            queued = false;
            if (!disposed) timer = retry.schedule(() => { timer = undefined; refresh(); }, 5000);
            break;
          }
        }
      } finally { running = false; }
    })();
  }
  refresh.dispose = () => { disposed = true; queued = false; if (timer !== undefined) retry.cancel(timer); };
  return refresh;
}

export async function consumePipelineEvents(body: ReadableStream<Uint8Array>, receive: (revision: string) => void, onChunk = () => {}) {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      onChunk();
      buffer += decoder.decode(value, { stream: true });
      // Normalize only complete CRLF pairs; a trailing CR may arrive separately.
      buffer = buffer.replace(/\r\n/g, '\n');
      let index;
      while ((index = buffer.indexOf('\n\n')) >= 0) {
        const frame = buffer.slice(0, index); buffer = buffer.slice(index + 2);
        const lines = frame.split('\n');
        if (!lines.includes('event: pipeline')) continue;
        const data = lines.filter(line => line.startsWith('data:')).map(line => line.slice(5).trim()).join('\n');
        const parsed = JSON.parse(data);
        if (typeof parsed.revision === 'string') receive(parsed.revision);
      }
      if (buffer.length > 65536) throw new Error('Pipeline stream frame too large');
    }
  } finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
}

/** One authenticated stream per tab, with reconnect resync and a targeted-read fallback. */
export function createPipelineMonitor(connect: (signal: AbortSignal, receive: (revision: string) => void) => Promise<void>, env: Environment) {
  const listeners = new Set<() => void>();
  let active: AbortController | undefined, timer: ReturnType<typeof setTimeout> | undefined;
  let removeResume: (() => void) | undefined, epoch = 0, failures = 0, lastFallback = -Infinity, received = false;
  const notify = () => { for (const listener of listeners) listener(); };
  function start() {
    if (!listeners.size || active) return;
    const controller = new AbortController(); active = controller;
    const generation = epoch;
    let revision: string | undefined;
    void connect(controller.signal, next => {
      if (controller.signal.aborted || generation !== epoch) return;
      failures = 0; received = true;
      if (revision !== next) { revision = next; notify(); } // first frame also resyncs reconnect gaps
    }).catch(() => {}).finally(() => {
      if (generation !== epoch) return;
      active = undefined;
      if (!listeners.size) return;
      failures++;
      if (failures >= 2 && env.now() - lastFallback >= 15000) { lastFallback = env.now(); notify(); }
      timer = env.schedule(() => { timer = undefined; start(); }, Math.min(15000, 1000 * 2 ** Math.min(failures - 1, 4)));
    });
  }
  function stop() {
    epoch++;
    if (timer !== undefined) env.cancel(timer);
    timer = undefined;
    active?.abort(); active = undefined; received = false;
  }
  return (listener: () => void) => {
    listeners.add(listener);
    if (listeners.size === 1) {
      removeResume = env.onResume(() => { stop(); failures = 0; notify(); start(); });
      start();
    } else if (received) listener();
    return () => {
      listeners.delete(listener);
      if (!listeners.size) { stop(); removeResume?.(); removeResume = undefined; failures = 0; lastFallback = -Infinity; }
    };
  };
}
