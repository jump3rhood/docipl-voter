import { Suspense } from 'react';
import type { Metadata } from 'next';
import { connection } from 'next/server';
import { getResults } from '@/lib/results';
import { getVotingStatus } from '@/lib/voting';
import { Leaderboard } from '@/components/Leaderboard';

export const metadata: Metadata = { title: "Results — Doc IPL People's Choice" };

async function Board() {
  await connection();
  const [initial, { state }] = await Promise.all([getResults(), getVotingStatus()]);
  return <Leaderboard initial={initial} state={state} />;
}

export default function ResultsPage() {
  return (
    <Suspense fallback={<div className="flex-1 bg-navy" aria-hidden />}>
      <Board />
    </Suspense>
  );
}
