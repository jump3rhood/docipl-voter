import { Suspense } from 'react';
import { connection } from 'next/server';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { ThankYou } from '@/components/ThankYou';
import { VOTER_COOKIE } from '@/lib/voterCookie';
import { hashId } from '@/lib/identity';
import { getVoterVote } from '@/lib/votes';

async function Thanks() {
  await connection();
  const id = (await cookies()).get(VOTER_COOKIE)?.value;
  const vote = id ? await getVoterVote(hashId(id)) : null;
  if (!vote) redirect('/');
  return <ThankYou teamName={vote.teamName} />;
}

export default function ThanksPage() {
  return (
    <Suspense fallback={<div className="flex-1" aria-hidden />}>
      <Thanks />
    </Suspense>
  );
}
