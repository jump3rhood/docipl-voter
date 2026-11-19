'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import type { Team } from '@/lib/voting';
import { voteErrorMessage, type VoteErrorCode } from '@/lib/voteMessages';
import { TeamCard } from '@/components/TeamCard';
import { primaryButtonClass } from '@/components/PrimaryLink';

export type SubmitResult = { ok: true; teamName: string } | { ok: false; code: VoteErrorCode };

export function BallotForm({
  teams,
  submit,
  onVoted,
}: {
  teams: Team[];
  submit: (teamId: string) => Promise<SubmitResult>;
  onVoted: (teamName: string) => void;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<VoteErrorCode | null>(null);
  const inFlight = useRef(false);

  async function handleSubmit() {
    if (!selectedId || inFlight.current) return;
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
    setSubmitting(false);
    inFlight.current = false;
  }

  const message = error ? voteErrorMessage(error) : null;

  return (
    <div className="flex flex-1 flex-col">
      <div className="px-4 pt-6 text-center">
        <h1 id="ballot-heading" className="text-2xl font-extrabold leading-tight">
          Who is the most popular team in Doc IPL?
        </h1>
        <p className="mt-2 text-white/80">Vote for your favourite team.</p>
      </div>

      <div
        role="radiogroup"
        aria-labelledby="ballot-heading"
        className="grid grid-cols-2 gap-3 px-4 pb-32 pt-6"
      >
        {teams.map((team) => (
          <TeamCard
            key={team.id}
            team={team}
            selected={team.id === selectedId}
            onSelect={() => setSelectedId(team.id)}
          />
        ))}
      </div>

      <div className="sticky bottom-0 mt-auto bg-gradient-to-t from-navy via-navy to-transparent px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-6">
        {message && (
          <div role="alert" className="mb-3 rounded-xl bg-navy-dark p-3 text-center">
            <p className="font-bold text-brand-yellow">{message.title}</p>
            {message.body && <p className="text-sm text-white/80">{message.body}</p>}
            {error === 'token_invalid' && (
              <Link href="/v" className="mt-2 inline-block font-bold underline">
                Get a new ballot
              </Link>
            )}
          </div>
        )}
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!selectedId || submitting}
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
          ) : (
            'CAST MY VOTE'
          )}
        </button>
      </div>
    </div>
  );
}
