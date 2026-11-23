'use client';

import { useState } from 'react';
import { useTimedStep } from '@/lib/useTimedStep';

const STEPS = [
  { at: 0, label: 'Getting your ballot ready…' },
  { at: 4_000, label: 'Checking your connection…' },
  { at: 8_000, label: "Making sure you're a real voter…" },
  { at: 14_000, label: 'Almost there…' },
] as const;
const OFFSETS = STEPS.map((s) => s.at);

export function Spinner({ className = 'h-4 w-4 border-white' }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={`inline-block shrink-0 animate-spin rounded-full border-2 border-t-transparent ${className}`}
    />
  );
}

export function Check({ className = 'h-4 w-4 text-brand-yellow' }: { className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" className={`shrink-0 ${className}`} fill="currentColor">
      <path
        fillRule="evenodd"
        d="M16.7 5.3a1 1 0 0 1 0 1.4l-8 8a1 1 0 0 1-1.4 0l-4-4a1 1 0 1 1 1.4-1.4L8 12.6l7.3-7.3a1 1 0 0 1 1.4 0Z"
        clipRule="evenodd"
      />
    </svg>
  );
}

/**
 * Status line shown while Turnstile works in the background. The steps are paced by time,
 * not by Turnstile's progress (it reports none), so they only reassure the voter it's moving.
 */
export function VerifyProgress({ verified, interactive = false }: { verified: boolean; interactive?: boolean }) {
  const step = useTimedStep(OFFSETS, !verified && !interactive);
  const [wasVerified, setWasVerified] = useState(verified);
  if (verified && !wasVerified) setWasVerified(true);

  let content;
  if (verified) {
    content = (
      <>
        <Check /> Verified, pick your team
      </>
    );
  } else if (interactive) {
    content = 'Please complete the check below.';
  } else {
    // A token that expired later is being renewed: skip "Getting your ballot ready".
    const label = wasVerified && step === 0 ? 'Checking again…' : STEPS[step].label;
    content = (
      <>
        <Spinner /> {label}
      </>
    );
  }

  return (
    <p
      role="status"
      aria-live="polite"
      className="mx-auto mb-2 flex w-fit items-center justify-center gap-2 rounded-full bg-navy-dark/90 px-3 py-1 text-center text-sm font-semibold text-white"
    >
      {content}
    </p>
  );
}
