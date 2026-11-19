/**
 * Polls `check` every `intervalMs` until it returns a value (→ onReady) or `timeoutMs`
 * elapses (→ onTimeout). Exactly one callback fires, at most once. Returns a cancel function.
 */
export function pollUntil<T>(
  check: () => T | undefined,
  opts: {
    intervalMs: number;
    timeoutMs: number;
    onReady: (value: T) => void;
    onTimeout: () => void;
  },
): () => void {
  let done = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = setTimeout(() => {
    if (done) return;
    done = true;
    if (timer) clearTimeout(timer);
    opts.onTimeout();
  }, opts.timeoutMs);
  const tick = () => {
    if (done) return;
    const value = check();
    if (value === undefined) {
      timer = setTimeout(tick, opts.intervalMs);
      return;
    }
    done = true;
    clearTimeout(deadline);
    opts.onReady(value);
  };
  tick();
  return () => {
    done = true;
    clearTimeout(deadline);
    if (timer) clearTimeout(timer);
  };
}
