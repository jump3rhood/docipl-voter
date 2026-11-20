'use client';

import { useEffect, useRef } from 'react';
import { AnimatePresence, m } from 'framer-motion';
import type { RefObject } from 'react';
import type { Team } from '@/lib/voting';
import { TeamBadge } from '@/components/TeamBadge';
import { primaryButtonClass } from '@/components/PrimaryLink';

type Props = {
  team: Team | null;
  open: boolean;
  submitting: boolean;
  canSubmit?: boolean;
  returnFocusRef?: RefObject<HTMLElement | null>;
  /** id of an element (e.g. the ballot error alert) to focus if no return target is usable. */
  fallbackFocusId?: string;
  onConfirm: () => void;
  onCancel: () => void;
};

const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), [tabindex]:not([tabindex="-1"])';

function tryFocus(el: HTMLElement | null | undefined): boolean {
  if (!el?.isConnected) return false;
  el.focus?.();
  return document.activeElement === el;
}

function Sheet({ team, submitting, canSubmit = true, returnFocusRef, fallbackFocusId, onConfirm, onCancel }: Omit<Props, 'open'> & { team: Team }) {
  const panelRef = useRef<HTMLDivElement>(null);
  const yesRef = useRef<HTMLButtonElement>(null);
  const submittingRef = useRef(submitting);
  const cancelRef = useRef(onCancel);
  useEffect(() => {
    submittingRef.current = submitting;
    cancelRef.current = onCancel;
  });

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    const returnEl = returnFocusRef?.current ?? null;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    yesRef.current?.focus();
    return () => {
      document.body.style.overflow = prevOverflow;
      if (tryFocus(returnEl) || tryFocus(opener)) return;
      if (fallbackFocusId) tryFocus(document.getElementById(fallbackFocusId));
    };
  }, [returnFocusRef, fallbackFocusId]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        if (!submittingRef.current) cancelRef.current();
        return;
      }
      if (e.key !== 'Tab') return;
      const items = panelRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE);
      if (!items || items.length === 0) {
        e.preventDefault();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;
      if (!panelRef.current?.contains(active)) {
        e.preventDefault();
        first.focus();
      } else if (e.shiftKey && active === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <m.button
        type="button"
        aria-label="Close"
        tabIndex={-1}
        onClick={() => {
          if (!submitting) onCancel();
        }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 cursor-default touch-none overscroll-contain bg-black/60"
      />
      <m.div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-vote-heading"
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', stiffness: 380, damping: 36 }}
        className="relative flex w-full max-w-md flex-col items-center gap-3 rounded-t-3xl bg-navy-light px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-8 text-center"
      >
        <TeamBadge name={team.name} logoUrl={team.logoUrl} accentColor={team.accentColor} size={72} />
        <h2 id="confirm-vote-heading" className="text-2xl font-extrabold leading-tight">
          Vote for {team.name}?
        </h2>
        <p className="text-white/80">You can only vote once, and it can&apos;t be changed.</p>
        <button
          ref={yesRef}
          type="button"
          onClick={onConfirm}
          disabled={submitting || !canSubmit}
          className={`${primaryButtonClass} mt-2 gap-2 disabled:cursor-not-allowed disabled:opacity-50`}
        >
          {submitting ? (
            <>
              <span
                aria-hidden="true"
                className="h-5 w-5 animate-spin rounded-full border-2 border-navy border-t-transparent"
              />
              Submitting…
            </>
          ) : !canSubmit ? (
            'Verifying…'
          ) : (
            'YES, CAST MY VOTE'
          )}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={submitting}
          className="inline-flex min-h-11 items-center justify-center px-4 font-bold text-white/80 underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-yellow disabled:invisible"
        >
          Change my pick
        </button>
      </m.div>
    </div>
  );
}

export function ConfirmVoteSheet({ team, open, ...rest }: Props) {
  return <AnimatePresence>{open && team && <Sheet key="sheet" team={team} {...rest} />}</AnimatePresence>;
}
