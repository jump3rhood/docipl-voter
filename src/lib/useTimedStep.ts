'use client';

import { useEffect, useState } from 'react';

/**
 * Steps through `offsetsMs` (ms since `running` turned on; the first should be 0) and returns
 * the index of the latest offset reached. Goes back to 0 each time `running` turns on again.
 * Pass a module-level array: a new array each render restarts the timers.
 */
export function useTimedStep(offsetsMs: readonly number[], running: boolean): number {
  const [step, setStep] = useState(0);
  const [prevRunning, setPrevRunning] = useState(running);
  if (prevRunning !== running) {
    setPrevRunning(running);
    if (running) setStep(0);
  }

  useEffect(() => {
    if (!running) return;
    const timers = offsetsMs.map((ms, i) => setTimeout(() => setStep(i), ms));
    return () => timers.forEach(clearTimeout);
  }, [offsetsMs, running]);

  return step;
}
