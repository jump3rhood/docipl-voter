'use client';

import { useEffect, useRef } from 'react';

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

const SCRIPT_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
const SCRIPT_ID = 'cf-turnstile-script';

function whenTurnstileReady(cb: (api: TurnstileApi) => void): () => void {
  let cancelled = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const check = () => {
    if (cancelled) return;
    if (window.turnstile) cb(window.turnstile);
    else timer = setTimeout(check, 50);
  };
  if (!document.getElementById(SCRIPT_ID)) {
    const s = document.createElement('script');
    s.id = SCRIPT_ID;
    s.src = SCRIPT_SRC;
    s.async = true;
    s.defer = true;
    document.head.appendChild(s);
  }
  check();
  return () => {
    cancelled = true;
    if (timer) clearTimeout(timer);
  };
}

export function TurnstileWidget({
  siteKey,
  onToken,
  resetSignal,
}: {
  siteKey: string;
  onToken: (t: string | null) => void;
  resetSignal: number;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetId = useRef<string | null>(null);
  const onTokenRef = useRef(onToken);
  const lastReset = useRef(resetSignal);

  useEffect(() => {
    onTokenRef.current = onToken;
  });

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const cancel = whenTurnstileReady((api) => {
      widgetId.current = api.render(container, {
        sitekey: siteKey,
        appearance: 'interaction-only',
        'refresh-expired': 'auto',
        callback: (t: string) => onTokenRef.current(t),
        'expired-callback': () => onTokenRef.current(null),
        'error-callback': () => onTokenRef.current(null),
      });
    });
    return () => {
      cancel();
      if (widgetId.current !== null && window.turnstile) {
        window.turnstile.remove(widgetId.current);
      }
      widgetId.current = null;
    };
  }, [siteKey]);

  useEffect(() => {
    if (lastReset.current === resetSignal) return;
    lastReset.current = resetSignal;
    onTokenRef.current(null);
    if (widgetId.current !== null && window.turnstile) window.turnstile.reset(widgetId.current);
  }, [resetSignal]);

  return <div ref={containerRef} className="mb-2 flex min-h-0 justify-center" />;
}
