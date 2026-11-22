import { Suspense } from 'react';
import type { Metadata } from 'next';
import { connection } from 'next/server';
import { redirect } from 'next/navigation';
import { isAdmin } from '@/lib/adminAuth';
import { getResults } from '@/lib/results';
import { getVotingStatus } from '@/lib/voting';
import { Leaderboard } from '@/components/Leaderboard';

export const metadata: Metadata = {
  title: "Results — Doc IPL People's Choice",
  robots: { index: false, follow: false },
};

async function Board() {
  await connection();
  // Results are for admins only; voters are sent back to the home page.
  if (!(await isAdmin())) redirect('/');
  const [initial, { state }] = await Promise.all([getResults(), getVotingStatus()]);
  // hasVoted hides the VOTE NOW button, which admins don't need.
  return <Leaderboard initial={initial} state={state} hasVoted />;
}

export default function ResultsPage() {
  return (
    <Suspense fallback={<div className="flex-1" aria-hidden />}>
      <Board />
    </Suspense>
  );
}
