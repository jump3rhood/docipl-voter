import { Suspense } from 'react';
import { connection } from 'next/server';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { getActiveTeams, getVotingStatus } from '@/lib/voting';
import { getServerEnv } from '@/lib/env';
import { formatIST } from '@/lib/formatIST';
import { VOTER_COOKIE } from '@/lib/voterCookie';
import { hashId, hashToken } from '@/lib/identity';
import { getTokenState, getVoterVote } from '@/lib/votes';
import { StatusScreen } from '@/components/StatusScreen';
import { ExpiredBallot } from '@/components/ExpiredBallot';
import { BallotClient } from './BallotClient';

export const metadata = { title: "Vote — Doc IPL People's Choice" };

async function Ballot({ params }: { params: Promise<{ token: string }> }) {
  await connection();
  const { token } = await params;
  const { state, start } = await getVotingStatus();
  if (state !== 'open') {
    return <StatusScreen state={state} startLabel={formatIST(start)} />;
  }
  const id = (await cookies()).get(VOTER_COOKIE)?.value;
  if (id && (await getVoterVote(hashId(id)))) redirect('/thanks');
  const tokenState = await getTokenState(hashToken(token));
  if (tokenState === 'used') redirect('/thanks');
  if (tokenState === 'invalid') return <ExpiredBallot />;
  const teams = await getActiveTeams();
  if (teams.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center pb-8 text-center">
        <p className="text-base">No teams are available right now.</p>
      </div>
    );
  }
  return (
    <BallotClient
      token={token}
      teams={teams}
      siteKey={getServerEnv().TURNSTILE_SITE_KEY}
      voterId={id ?? null}
    />
  );
}

export default function VotePage({ params }: { params: Promise<{ token: string }> }) {
  return (
    <Suspense fallback={<div className="flex-1" aria-hidden />}>
      <Ballot params={params} />
    </Suspense>
  );
}
