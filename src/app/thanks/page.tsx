import { Suspense } from 'react';
import { connection } from 'next/server';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { ThankYou } from '@/components/ThankYou';
import { VoterIdSync } from '@/components/VoterIdSync';
import { VOTER_COOKIE } from '@/lib/voterCookie';
import { hashId } from '@/lib/identity';
import { getVoterVote } from '@/lib/votes';
import { getVotingStatus } from '@/lib/voting';

async function Thanks() {
  await connection();
  const id = (await cookies()).get(VOTER_COOKIE)?.value;
  const [vote, { state, resultsPublic }] = await Promise.all([
    id ? getVoterVote(hashId(id)) : null,
    getVotingStatus(),
  ]);
  if (!vote) redirect('/');
  const results = resultsPublic ? (state === 'closed' ? 'final' : 'live') : null;
  return (
    <>
      <VoterIdSync currentId={id ?? null} voted />
      <ThankYou teamName={vote.teamName} accentColor={vote.accentColor} results={results} />
    </>
  );
}

export default function ThanksPage() {
  return (
    <Suspense fallback={<div className="flex-1" aria-hidden />}>
      <Thanks />
    </Suspense>
  );
}
