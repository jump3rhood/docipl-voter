import { Suspense } from 'react';
import { connection } from 'next/server';
import { requireAdmin } from '@/lib/adminAuth';
import { getAdminConfig } from '@/lib/admin';
import { getResults } from '@/lib/results';
import { deriveVotingState, type VotingState } from '@/lib/votingState';
import { formatIST } from '@/lib/formatIST';
import { formatPercent, formatVotes } from '@/lib/resultsFormat';

const STATE_LABEL: Record<VotingState, string> = {
  before: 'Not started',
  open: 'Open',
  paused: 'Paused',
  closed: 'Closed',
};

const card = 'rounded-2xl border border-white/20 bg-navy-light p-4';

async function Home() {
  await connection();
  await requireAdmin();
  const [cfg, results] = await Promise.all([getAdminConfig(), getResults()]);
  const state = deriveVotingState(cfg, new Date());
  return (
    <div className="flex flex-col gap-4">
      <h1 className="sr-only">Admin</h1>
      <div className={card}>
        <p className="text-sm text-white/70">Status</p>
        <p className="text-xl font-bold text-brand-yellow">{STATE_LABEL[state]}</p>
      </div>
      <div className={card}>
        <p className="text-sm text-white/70">Total votes</p>
        <p className="text-xl font-bold">{formatVotes(results.total)}</p>
      </div>
      <div className={card}>
        <p className="text-sm text-white/70">Starts</p>
        <p className="font-semibold">{formatIST(cfg.start)}</p>
        <p className="mt-2 text-sm text-white/70">Ends</p>
        <p className="font-semibold">{formatIST(cfg.end)}</p>
      </div>
      <div className={card}>
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="text-white/70">
              <th className="py-1 font-semibold">Team</th>
              <th className="py-1 text-right font-semibold">Votes</th>
              <th className="py-1 text-right font-semibold">%</th>
            </tr>
          </thead>
          <tbody>
            {results.rows.map((r) => (
              <tr key={r.teamId}>
                <td className="py-1">{r.name}</td>
                <td className="py-1 text-right">{formatVotes(r.votes)}</td>
                <td className="py-1 text-right">{formatPercent(r.percent)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <a href="/v" className="font-semibold text-brand-yellow underline">
        Open test ballot
      </a>
    </div>
  );
}

export default function AdminHome() {
  return (
    <Suspense fallback={null}>
      <Home />
    </Suspense>
  );
}
