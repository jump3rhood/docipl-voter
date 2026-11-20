import type { Metadata } from 'next';
import { Suspense } from 'react';
import { connection } from 'next/server';
import { requireAdmin } from '@/lib/adminAuth';
import { listAllTeams } from '@/lib/admin';
import { TeamList } from './TeamList';

export const metadata: Metadata = { title: 'Teams', robots: { index: false, follow: false } };

async function Teams() {
  await connection();
  await requireAdmin();
  const teams = await listAllTeams();
  return (
    <div className="flex flex-col gap-4">
      <h1 className="sr-only">Teams</h1>
      <TeamList teams={teams} />
    </div>
  );
}

export default function TeamsPage() {
  return (
    <Suspense fallback={null}>
      <Teams />
    </Suspense>
  );
}
