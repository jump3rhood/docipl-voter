import type { Metadata } from 'next';
import { Suspense } from 'react';
import { connection } from 'next/server';
import { requireAdmin } from '@/lib/adminAuth';
import { getAdminConfig } from '@/lib/admin';
import { getResults } from '@/lib/results';
import { formatPercent, formatVotes, totalLabel } from '@/lib/resultsFormat';
import { DangerZone } from './DangerZone';
import { ToggleButton } from '../voting/ToggleButton';
import { toggleResultsPublicAction } from './actions';

export const metadata: Metadata = { title: 'Results', robots: { index: false, follow: false } };

const linkClass = 'min-h-14 content-center rounded-2xl border border-white/30 px-4 text-center font-semibold underline';

async function Results() {
  await connection();
  await requireAdmin();
  const [config, results] = await Promise.all([getAdminConfig(), getResults()]);
  return (
    <div className="flex flex-col gap-8">
      <h1 className="sr-only">Results</h1>
      <section aria-labelledby="visibility" className="flex flex-col gap-3">
        <h2 id="visibility" className="font-bold">
          Who can see results
        </h2>
        <p role="status" className="text-white/80">
          {config.resultsPublic
            ? 'Everyone: voters see a results link and can open the leaderboard.'
            : 'Admins only: voters see just the ballot and thank-you page.'}
        </p>
        <form action={toggleResultsPublicAction}>
          <input type="hidden" name="resultsPublic" value={config.resultsPublic ? 'false' : 'true'} />
          <ToggleButton label={config.resultsPublic ? 'HIDE RESULTS FROM PUBLIC' : 'SHOW RESULTS TO PUBLIC'} />
        </form>
      </section>
      <p className="text-white/80">{totalLabel(results.total)}</p>
      <table className="w-full text-left">
        <thead>
          <tr className="text-sm text-white/70">
            <th className="py-2">Team</th>
            <th className="py-2 text-right">Votes</th>
            <th className="py-2 text-right">%</th>
          </tr>
        </thead>
        <tbody>
          {results.rows.map((r) => (
            <tr key={r.teamId} className="border-t border-white/10">
              <td className="py-3">{r.name}</td>
              <td className="py-3 text-right">{formatVotes(r.votes)}</td>
              <td className="py-3 text-right">{formatPercent(r.percent)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="flex flex-col gap-3">
        <a href="/results" className={linkClass}>
          Open live leaderboard
        </a>
        <a href="/admin/export?type=results" className={linkClass}>
          Download results CSV
        </a>
        <a href="/admin/export?type=votes" className={linkClass}>
          Download votes CSV
        </a>
      </div>
      <DangerZone enabled={config.enabled} />
    </div>
  );
}

export default function ResultsPage() {
  return (
    <Suspense fallback={null}>
      <Results />
    </Suspense>
  );
}
