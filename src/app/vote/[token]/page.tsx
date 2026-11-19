import { Suspense } from 'react';
import { connection } from 'next/server';
import { getActiveTeams, getVotingStatus } from '@/lib/voting';
import { formatIST } from '@/lib/formatIST';
import { StatusScreen } from '@/components/StatusScreen';
import { BallotClient } from './BallotClient';

async function Ballot({ params }: { params: Promise<{ token: string }> }) {
  await connection();
  const { token } = await params;
  const { state, start } = await getVotingStatus();
  if (state !== 'open') {
    return <StatusScreen state={state} startLabel={formatIST(start)} />;
  }
  const teams = await getActiveTeams();
  return <BallotClient token={token} teams={teams} />;
}

export default function VotePage({ params }: { params: Promise<{ token: string }> }) {
  return (
    <Suspense fallback={<div className="flex-1 bg-navy" aria-hidden />}>
      <Ballot params={params} />
    </Suspense>
  );
}
