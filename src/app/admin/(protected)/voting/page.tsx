import type { Metadata } from 'next';
import { Suspense } from 'react';
import { connection } from 'next/server';
import { requireAdmin } from '@/lib/adminAuth';
import { getAdminConfig } from '@/lib/admin';
import { dateToIstLocal } from '@/lib/ist';
import { VotingForm } from './VotingForm';
import { ToggleButton } from './ToggleButton';
import { toggleVotingAction } from './actions';

export const metadata: Metadata = { title: 'Voting controls', robots: { index: false, follow: false } };

async function Voting() {
  await connection();
  await requireAdmin();
  const c = await getAdminConfig();
  return (
    <div className="flex flex-col gap-8">
      <h1 className="sr-only">Voting</h1>
      <form action={toggleVotingAction}>
        <input type="hidden" name="enabled" value={c.enabled ? 'false' : 'true'} />
        <ToggleButton label={c.enabled ? 'PAUSE VOTING' : 'RESUME VOTING'} />
      </form>
      <VotingForm
        start={dateToIstLocal(c.start)}
        end={dateToIstLocal(c.end)}
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
