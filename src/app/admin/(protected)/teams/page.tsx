import type { Metadata } from 'next';
import { Suspense } from 'react';
import { connection } from 'next/server';
import { requireAdmin } from '@/lib/adminAuth';
import { listAllTeams } from '@/lib/admin';
import { AddTeamForm, TeamRow } from './TeamForms';

export const metadata: Metadata = { title: 'Teams', robots: { index: false, follow: false } };

async function Teams() {
  await connection();
  await requireAdmin();
  const teams = await listAllTeams();
  const nextOrder = teams.reduce((m, t) => Math.max(m, t.displayOrder), 0) + 1;
  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-2xl font-extrabold">Teams</h1>
      {teams.map((t) => (
        <TeamRow
          key={t.id}
          id={t.id}
          name={t.name}
          slug={t.slug}
          accentColor={t.accentColor}
          displayOrder={t.displayOrder}
          logoUrl={t.logoUrl}
          isActive={t.isActive}
        />
      ))}
      <AddTeamForm nextOrder={nextOrder} />
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
