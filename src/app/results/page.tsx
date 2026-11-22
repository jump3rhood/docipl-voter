import { Suspense } from 'react';
import type { Metadata } from 'next';
import { connection } from 'next/server';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { isAdmin } from '@/lib/adminAuth';
import { hashId } from '@/lib/identity';
import { VOTER_COOKIE } from '@/lib/voterCookie';
import { getVoterVote } from '@/lib/votes';
import { getResults } from '@/lib/results';
import { getVotingStatus } from '@/lib/voting';
import { Leaderboard } from '@/components/Leaderboard';

export const metadata: Metadata = {
  title: "Results — Doc IPL People's Choice",
  robots: { index: false, follow: false },
};

async function Board() {
  await connection();
  const [admin, { state, resultsPublic }] = await Promise.all([isAdmin(), getVotingStatus()]);
  // Results are admin-only unless an admin has made them public.
  if (!admin && !resultsPublic) redirect('/');
  const id = (await cookies()).get(VOTER_COOKIE)?.value;
  const [initial, vote] = await Promise.all([
    getResults(),
    !admin && id ? getVoterVote(hashId(id)) : null,
  ]);
  // hasVoted hides VOTE NOW: admins never need it, voters only until they've voted.
  return <Leaderboard initial={initial} state={state} hasVoted={admin || vote !== null} />;
}

export default function ResultsPage() {
  return (
    <Suspense fallback={<div className="flex-1" aria-hidden />}>
      <Board />
    </Suspense>
  );
}
