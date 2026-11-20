'use client';

import { useRef, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { m } from 'motion/react';
import { Reveal, RevealGroup, RevealItem } from '@/components/motion/Reveal';
import type { Team } from '@/lib/voting';
import { voteErrorMessage, type VoteErrorCode } from '@/lib/voteMessages';
import { ConfirmVoteSheet } from '@/components/ConfirmVoteSheet';
import { TeamCard } from '@/components/TeamCard';
import { PrimaryLink, primaryButtonClass, privacyLinkClass } from '@/components/PrimaryLink';

const TERMINAL: Partial<Record<VoteErrorCode, { label: string; href: string }>> = {
  already_voted: { label: 'VIEW LIVE RESULTS', href: '/results' },
  voting_closed: { label: 'VIEW FINAL RESULTS', href: '/results' },
  voting_not_open: { label: 'Back to home', href: '/' },
};

export type SubmitResult = { ok: true; teamName: string } | { ok: false; code: VoteErrorCode };

export function BallotForm({
  teams,
  submit,
  onVoted,
  canSubmit = true,
  onSubmitFailed,
  footerExtra,
}: {
  teams: Team[];
  submit: (teamId: string) => Promise<SubmitResult>;
  onVoted: (teamName: string) => void;
  canSubmit?: boolean;
  onSubmitFailed?: () => void;
  footerExtra?: ReactNode;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<VoteErrorCode | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const inFlight = useRef(false);
  const castRef = useRef<HTMLButtonElement>(null);

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
      onVoted(result.teamName);
      return;
    }
    setError(result.code);
    setConfirmOpen(false);
    setSubmitting(false);
    inFlight.current = false;
    onSubmitFailed?.();
  }

  const terminal = error ? TERMINAL[error] : undefined;
  const message = error ? voteErrorMessage(error) : null;

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
            role="alert"
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
          className={`${primaryButtonClass} gap-2 disabled:cursor-not-allowed disabled:opacity-50`}
        >
          {submitting ? (
            <>
              <span
                aria-hidden="true"
                className="h-5 w-5 animate-spin rounded-full border-2 border-navy border-t-transparent"
              />
              Submitting…
            </>
          ) : selectedId && !canSubmit ? (
            'Verifying…'
          ) : (
            'CAST MY VOTE'
          )}
        </button>
        )}
        <div className="mt-1 text-center">
          <Link href="/privacy" className={privacyLinkClass}>
            Privacy
          </Link>
        </div>
      </div>
      <ConfirmVoteSheet
        team={teams.find((t) => t.id === selectedId) ?? null}
        open={confirmOpen}
        submitting={submitting}
        canSubmit={canSubmit}
        returnFocusRef={castRef}
        onConfirm={handleSubmit}
        onCancel={() => setConfirmOpen(false)}
      />
    </div>
  );
}
