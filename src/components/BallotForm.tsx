'use client';

import { useRef, useState, type ReactNode } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { m } from 'framer-motion';
import { Reveal, RevealGroup, RevealItem } from '@/components/motion/Reveal';
import type { Team } from '@/lib/voting';
import { voteErrorMessage, type VoteErrorCode } from '@/lib/voteMessages';
import { TeamCard } from '@/components/TeamCard';
import { PrimaryLink, primaryButtonClass, privacyLinkClass } from '@/components/PrimaryLink';
import { Check, Spinner } from '@/components/VerifyProgress';
import { useTimedStep } from '@/lib/useTimedStep';

// Lazy: keeps the sheet (and AnimatePresence) out of the ballot's first-load JS.
const ConfirmVoteSheet = dynamic(
  () => import('@/components/ConfirmVoteSheet').then((mod) => mod.ConfirmVoteSheet),
  { ssr: false },
);
const prewarmSheet = () => void import('@/components/ConfirmVoteSheet');

const ERROR_ID = 'ballot-error';

// The server checks Turnstile and records the vote in one request; the label moves on after a
// beat so a slow request still looks alive.
const SUBMIT_STEPS = [
  { at: 0, label: 'Sending your vote…' },
  { at: 1_200, label: 'Verifying your vote…' },
] as const;
const SUBMIT_OFFSETS = SUBMIT_STEPS.map((s) => s.at);
/** How long "Vote verified!" stays up before moving on to the thank-you page. */
export const VERIFIED_PAUSE_MS = 900;

type Escape = { label: string; href: string };
const TERMINAL: Partial<Record<VoteErrorCode, Escape>> = {
  already_voted: { label: 'SEE YOUR VOTE', href: '/thanks' },
  voting_closed: { label: 'Back to home', href: '/' },
  voting_not_open: { label: 'Back to home', href: '/' },
};
// Used instead when an admin has made results public.
const TERMINAL_PUBLIC: Partial<Record<VoteErrorCode, Escape>> = {
  ...TERMINAL,
  already_voted: { label: 'VIEW LIVE RESULTS', href: '/results' },
  voting_closed: { label: 'VIEW FINAL RESULTS', href: '/results' },
};

export type SubmitResult = { ok: true; teamName: string } | { ok: false; code: VoteErrorCode };

export function BallotForm({
  teams,
  submit,
  onVoted,
  canSubmit = true,
  onSubmitFailed,
  footerExtra,
  resultsPublic = false,
}: {
  teams: Team[];
  submit: (teamId: string) => Promise<SubmitResult>;
  onVoted: (teamName: string) => void;
  canSubmit?: boolean;
  onSubmitFailed?: () => void;
  footerExtra?: ReactNode;
  resultsPublic?: boolean;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<VoteErrorCode | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [voteVerified, setVoteVerified] = useState(false);
  const submitStep = useTimedStep(SUBMIT_OFFSETS, submitting);
  const inFlight = useRef(false);
  const castRef = useRef<HTMLButtonElement>(null);
  const [prevCanSubmit, setPrevCanSubmit] = useState(canSubmit);

  // If verification is lost while the sheet is open (e.g. Turnstile wants an
  // interactive challenge in the footer), close the sheet so it isn't covered.
  if (prevCanSubmit !== canSubmit) {
    setPrevCanSubmit(canSubmit);
    if (!canSubmit && confirmOpen && !submitting) setConfirmOpen(false);
  }

  async function handleSubmit() {
    if (!selectedId || !canSubmit || inFlight.current) return;
    inFlight.current = true;
    setSubmitting(true);
    setError(null);
    let result: SubmitResult;
    try {
      result = await submit(selectedId);
    } catch {
      result = { ok: false, code: 'network' };
    }
    if (result.ok) {
      // Keep the lock held: the parent navigates away from the form.
      setVoteVerified(true);
      await new Promise((r) => setTimeout(r, VERIFIED_PAUSE_MS));
      onVoted(result.teamName);
      return;
    }
    setError(result.code);
    setConfirmOpen(false);
    setSubmitting(false);
    inFlight.current = false;
    onSubmitFailed?.();
  }

  const terminal = error ? (resultsPublic ? TERMINAL_PUBLIC : TERMINAL)[error] : undefined;
  const message = error ? voteErrorMessage(error) : null;
  const submitLabel = voteVerified ? 'Vote verified!' : SUBMIT_STEPS[submitStep].label;
  const submittingContent = (
    <>
      {voteVerified ? <Check className="h-5 w-5 text-navy" /> : <Spinner className="h-5 w-5 border-navy" />}
      {submitLabel}
    </>
  );

  return (
    <div className="flex flex-1 flex-col">
      <Reveal className="pt-6 text-center">
        <h1 id="ballot-heading" className="text-2xl font-extrabold leading-tight">
          Who is the most popular team in Doc IPL?
        </h1>
        <p className="mt-2 text-white/80">Vote for your favourite team.</p>
      </Reveal>

      <RevealGroup
        role="radiogroup"
        aria-labelledby="ballot-heading"
        className="grid grid-cols-2 gap-3 pb-32 pt-6"
      >
        {teams.map((team) => (
          <RevealItem key={team.id} className="grid">
            <TeamCard
              team={team}
              selected={team.id === selectedId}
              disabled={submitting}
              onSelect={() => {
                if (selectedId === null) prewarmSheet();
                setSelectedId(team.id);
                setError(null);
              }}
            />
          </RevealItem>
        ))}
      </RevealGroup>

      <div className="sticky bottom-0 mt-auto bg-gradient-to-t from-navy/95 via-navy/80 to-transparent pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-6">
        {footerExtra}
        {message && (
          <m.div
            key={error}
            id={ERROR_ID}
            role="alert"
            tabIndex={-1}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-3 rounded-xl bg-navy-dark p-3 text-center"
          >
            <p className="font-bold text-brand-yellow">{message.title}</p>
            {message.body && <p className="text-sm text-white/80">{message.body}</p>}
            {error === 'token_invalid' && (
              <a href="/v" className="mt-2 inline-block font-bold underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-yellow">
                Get a new ballot
              </a>
            )}
          </m.div>
        )}
        {terminal ? (
          <PrimaryLink href={terminal.href}>{terminal.label}</PrimaryLink>
        ) : (
        <button
          ref={castRef}
          type="button"
          onClick={() => setConfirmOpen(true)}
          disabled={!selectedId || !canSubmit || submitting}
          className={`${primaryButtonClass} gap-2 ${submitting ? 'disabled:cursor-wait' : 'disabled:cursor-not-allowed disabled:opacity-50'}`}
        >
          {submitting ? (
            submittingContent
          ) : selectedId && !canSubmit ? (
            'Verifying…'
          ) : (
            'CAST MY VOTE'
          )}
        </button>
        )}
        <p role="status" aria-live="polite" className="sr-only">
          {submitting ? submitLabel : ''}
        </p>
        <div className="mt-1 text-center">
          <Link href="/privacy" className={privacyLinkClass}>
            Privacy
          </Link>
        </div>
      </div>
      {selectedId !== null && (
        <ConfirmVoteSheet
          team={teams.find((t) => t.id === selectedId) ?? null}
          open={confirmOpen}
          submitting={submitting}
          canSubmit={canSubmit}
          submittingContent={submittingContent}
          returnFocusRef={castRef}
          fallbackFocusId={ERROR_ID}
          onConfirm={handleSubmit}
          onCancel={() => setConfirmOpen(false)}
        />
      )}
    </div>
  );
}
