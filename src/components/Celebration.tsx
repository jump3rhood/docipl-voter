'use client';

import { useEffect, useRef } from 'react';
import { consumeCelebrate } from '@/lib/celebrate';

type Confetti = typeof import('canvas-confetti');

export function Celebration({ colors }: { colors: string[] }) {
  // Decided once per instance so a StrictMode remount reuses the answer
  // (consumeCelebrate clears the flag on first read).
  const shouldFire = useRef<boolean | null>(null);
  const colorKey = colors.join(',');

  useEffect(() => {
    if (shouldFire.current === null) {
      const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
      shouldFire.current = !reduced && consumeCelebrate();
    }
    if (!shouldFire.current) return;

    let cancelled = false;
    let confetti: Confetti | null = null;
    void import('canvas-confetti').then((mod) => {
      if (cancelled) return;
      confetti = mod.default;
      const base = {
        particleCount: 60,
        spread: 55,
        startVelocity: 55,
        ticks: 150,
        colors: colorKey.split(','),
        disableForReducedMotion: true,
        zIndex: 100,
      };
      void confetti({ ...base, angle: 60, origin: { x: 0, y: 1 } });
      void confetti({ ...base, angle: 120, origin: { x: 1, y: 1 } });
    });

    return () => {
      cancelled = true;
      confetti?.reset();
    };
  }, [colorKey]);

  return null;
}
