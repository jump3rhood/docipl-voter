import type { Metadata } from 'next';
import { Suspense } from 'react';
import { connection } from 'next/server';
import { requireAdmin } from '@/lib/adminAuth';
import { getAdminConfig } from '@/lib/admin';
import { dateToIstLocal } from '@/lib/ist';
import { primaryButtonClass } from '@/components/PrimaryLink';
import { VotingForm } from './VotingForm';
import { toggleVotingAction } from './actions';

export const metadata: Metadata = { title: 'Voting controls', robots: { index: false, follow: false } };

async function Voting() {
  await connection();
  await requireAdmin();
  const c = await getAdminConfig();
  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-2xl font-extrabold">Voting</h1>
      <form action={toggleVotingAction}>
        <button type="submit" className={`${primaryButtonClass} w-full`}>
          {c.enabled ? 'PAUSE VOTING' : 'RESUME VOTING'}
        </button>
      </form>
      <VotingForm
        start={dateToIstLocal(c.start)}
        end={dateToIstLocal(c.end)}
        enabled={c.enabled}
        maxVotes={c.maxVotesPerDeviceIp}
      />
    </div>
  );
}

export default function VotingPage() {
  return (
    <Suspense fallback={null}>
      <Voting />
    </Suspense>
  );
}
