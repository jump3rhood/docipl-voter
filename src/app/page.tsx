import { Suspense } from 'react';
import { connection } from 'next/server';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { getVotingStatus } from '@/lib/voting';
import { formatIST } from '@/lib/formatIST';
import { hashId } from '@/lib/identity';
import { VOTER_COOKIE } from '@/lib/voterCookie';
import { getVoterVote } from '@/lib/votes';
import { StatusScreen } from '@/components/StatusScreen';
import { VoterIdSync } from '@/components/VoterIdSync';

async function Status() {
  await connection();
  const { state, start } = await getVotingStatus();
  const id = (await cookies()).get(VOTER_COOKIE)?.value ?? null;
  // Someone who has voted goes straight to their thank-you page (and its results link).
  // Once voting closes, the closed screen with "final results" fits better.
  const sendVotersToThanks = state !== 'closed';
  if (sendVotersToThanks && id && (await getVoterVote(hashId(id)))) redirect('/thanks');
  return (
    <>
      <VoterIdSync currentId={id} redirectIfVoted={sendVotersToThanks} />
      <StatusScreen state={state} startLabel={formatIST(start)} />
    </>
  );
}

export default function Home() {
  return (
    <Suspense fallback={<div className="flex-1" aria-hidden />}>
      <Status />
    </Suspense>
  );
}
