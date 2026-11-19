'use client';

import { useRouter } from 'next/navigation';
import type { Team } from '@/lib/voting';
import { BallotForm } from '@/components/BallotForm';
import { postVote } from '@/lib/submitVote';

export function BallotClient({ token, teams }: { token: string; teams: Team[] }) {
  const router = useRouter();
  return (
    <BallotForm
      teams={teams}
      // Phase 5 supplies the real Turnstile token and device signal.
      submit={(teamId) => postVote({ token, teamId, turnstileToken: '', deviceSignal: null })}
      onVoted={() => router.replace('/thanks')}
    />
  );
}
