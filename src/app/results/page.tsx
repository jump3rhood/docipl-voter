import { Suspense } from 'react';
import type { Metadata } from 'next';
import { connection } from 'next/server';
import { cookies } from 'next/headers';
import { hashId } from '@/lib/identity';
import { VOTER_COOKIE } from '@/lib/voterCookie';
import { getVoterVote } from '@/lib/votes';
import { getResults } from '@/lib/results';
import { getVotingStatus } from '@/lib/voting';
import { Leaderboard } from '@/components/Leaderboard';

export const metadata: Metadata = { title: "Results — Doc IPL People's Choice" };

async function Board() {
  await connection();
  const id = (await cookies()).get(VOTER_COOKIE)?.value;
  const [initial, { state }, vote] = await Promise.all([
    getResults(),
    getVotingStatus(),
    id ? getVoterVote(hashId(id)) : null,
  ]);
  return <Leaderboard initial={initial} state={state} hasVoted={vote !== null} />;
}

export default function ResultsPage() {
  return (
    <Suspense fallback={<div className="flex-1" aria-hidden />}>
      <Board />
    </Suspense>
  );
}
