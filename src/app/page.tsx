import { Suspense } from 'react';
import { connection } from 'next/server';
import { getVotingStatus } from '@/lib/voting';
import { formatIST } from '@/lib/formatIST';
import { StatusScreen } from '@/components/StatusScreen';

async function Status() {
  await connection();
  const { state, start } = await getVotingStatus();
  return <StatusScreen state={state} startLabel={formatIST(start)} />;
}

export default function Home() {
  return (
    <Suspense fallback={<div className="flex-1 bg-navy" aria-hidden />}>
      <Status />
    </Suspense>
  );
}
