'use client';

import { useEffect, useRef } from 'react';
import { pollUntil } from '@/lib/pollUntil';

type TurnstileApi = {
  render: (container: HTMLElement, options: Record<string, unknown>) => string;
  reset: (widgetId: string) => void;
  remove: (widgetId: string) => void;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

export type TurnstileErrorReason = 'timeout' | 'error';

const SCRIPT_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
const SCRIPT_ID = 'cf-turnstile-script';
const SCRIPT_TIMEOUT_MS = 10_000;
const TOKEN_TIMEOUT_MS = 12_000;

function whenTurnstileReady(onReady: (api: TurnstileApi) => void, onTimeout: () => void): () => void {
  if (!document.getElementById(SCRIPT_ID)) {
    const s = document.createElement('script');
    s.id = SCRIPT_ID;
    s.src = SCRIPT_SRC;
    s.async = true;
    s.defer = true;
    document.head.appendChild(s);
  }
  return pollUntil(() => window.turnstile, {
    intervalMs: 50,
    timeoutMs: SCRIPT_TIMEOUT_MS,
    onReady,
    onTimeout,
  });
}

export function TurnstileWidget({
  siteKey,
  onToken,
  onError,
  resetSignal,
}: {
  siteKey: string;
  onToken: (t: string | null) => void;
  onError?: (reason: TurnstileErrorReason) => void;
  resetSignal: number;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetId = useRef<string | null>(null);
  const onTokenRef = useRef(onToken);
  const onErrorRef = useRef(onError);
  const lastReset = useRef(resetSignal);
  const watchdog = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const retried = useRef(false);
  const hasTokenRef = useRef(false);
  const resetWidget = useRef<() => void>(() => {});

  useEffect(() => {
    onTokenRef.current = onToken;
    onErrorRef.current = onError;
  });

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    let disposed = false;

    const stopWatchdog = () => {
      if (watchdog.current) clearTimeout(watchdog.current);
      watchdog.current = undefined;
    };
    const safeReset = () => {
      hasTokenRef.current = false;
      try {
        if (widgetId.current !== null) window.turnstile?.reset(widgetId.current);
      } catch {
        // Nothing more to do; the watchdog / notice covers a dead widget.
      }
    };
    const startWatchdog = () => {
      stopWatchdog();
      watchdog.current = setTimeout(() => fail('timeout'), TOKEN_TIMEOUT_MS);
    };
    // Report the failure, then retry once (per successful token) by resetting the widget.
    const fail = (reason: TurnstileErrorReason) => {
      if (disposed) return;
      stopWatchdog();
      onErrorRef.current?.(reason);
      if (!retried.current && widgetId.current !== null) {
        retried.current = true;
        safeReset();
        startWatchdog();
      }
    };

    startWatchdog();
    const cancel = whenTurnstileReady(
      (api) => {
        try {
          widgetId.current = api.render(container, {
            sitekey: siteKey,
            appearance: 'interaction-only',
            'refresh-expired': 'auto',
            // A visible challenge is the user's time, not a stall: pause the watchdog.
            'before-interactive-callback': stopWatchdog,
            // ...but a challenge that ended with a token held needs no watchdog.
            'after-interactive-callback': () => {
              if (!hasTokenRef.current) startWatchdog();
            },
            callback: (t: string) => {
              stopWatchdog();
              hasTokenRef.current = true;
              retried.current = false;
              onTokenRef.current(t);
            },
            'expired-callback': () => {
              hasTokenRef.current = false;
              onTokenRef.current(null);
              startWatchdog();
            },
            'error-callback': () => {
              hasTokenRef.current = false;
              onTokenRef.current(null);
              fail('error');
              return true;
            },
          });
        } catch {
          fail('error');
        }
      },
      () => fail('timeout'),
    );

    resetWidget.current = () => {
      safeReset();
      startWatchdog();
    };

    return () => {
      disposed = true;
      cancel();
      stopWatchdog();
      resetWidget.current = () => {};
      try {
        if (widgetId.current !== null) window.turnstile?.remove(widgetId.current);
      } catch {
        // Ignore: the container is being torn down anyway.
      }
      widgetId.current = null;
      hasTokenRef.current = false;
    };
  }, [siteKey]);

  useEffect(() => {
    if (lastReset.current === resetSignal) return;
    lastReset.current = resetSignal;
    onTokenRef.current(null);
    resetWidget.current();
  }, [resetSignal]);

  return <div ref={containerRef} className="mb-2 flex min-h-0 justify-center" />;
}
