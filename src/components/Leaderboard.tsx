'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { PrimaryLink, privacyLinkClass } from '@/components/PrimaryLink';
import { TeamBadge } from '@/components/TeamBadge';
import {
  formatPercent,
  formatVotes,
  medalFor,
  totalLabel,
  type ResultsPayload,
} from '@/lib/resultsFormat';
import type { VotingState } from '@/lib/votingState';

function subheading(state: VotingState): string {
  if (state === 'open') return 'Live results · updates every 15 seconds';
  if (state === 'closed') return 'Final results';
  return 'Results';
}

function isPayload(x: unknown): x is ResultsPayload {
  if (typeof x !== 'object' || x === null) return false;
  const o = x as { total?: unknown; rows?: unknown };
  return typeof o.total === 'number' && Array.isArray(o.rows);
}

export function Leaderboard({
  initial,
  state,
  pollMs = 15000,
  fetchImpl,
}: {
  initial: ResultsPayload;
  state: VotingState;
  pollMs?: number;
  fetchImpl?: typeof fetch;
}) {
  const [data, setData] = useState<ResultsPayload>(initial);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    let cancelled = false;

    const visible = () => document.visibilityState !== 'hidden';

    const refresh = async () => {
      try {
        const doFetch = fetchImpl ?? fetch;
        const res = await doFetch('/api/results');
        if (!res.ok) return;
        const next: unknown = await res.json();
        if (!cancelled && isPayload(next)) setData(next);
      } catch {
        // keep last good data
      }
    };

    const schedule = () => {
      if (cancelled || !visible()) return;
      timer = setTimeout(async () => {
        await refresh();
        schedule();
      }, pollMs);
    };

    const onVisibility = () => {
      clearTimeout(timer);
      if (visible()) {
        void refresh();
        schedule();
      }
    };

    document.addEventListener('visibilitychange', onVisibility);
    schedule();
    return () => {
      cancelled = true;
      clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [pollMs, fetchImpl]);

  return (
    <div className="flex flex-1 flex-col gap-4 bg-navy px-4 py-6 text-white">
      <div className="text-center">
        <h1 className="text-2xl font-extrabold">Doc IPL People&apos;s Choice</h1>
        <p className="mt-1 text-sm text-white/80">{subheading(state)}</p>
        <p className="mt-2 text-base font-semibold text-brand-yellow">{totalLabel(data.total)}</p>
      </div>

      <ol className="flex flex-col gap-2">
        {data.rows.map((r) => {
          const medal = medalFor(r);
          const leader = r.rank === 1 && r.votes > 0;
          return (
            <li
              key={r.teamId}
              className={`flex flex-col gap-2 rounded-2xl p-3 ${
                leader ? 'bg-brand-yellow/15 ring-1 ring-brand-yellow' : 'bg-navy-light'
              }`}
            >
              <div className="flex items-center gap-3">
                <span className="w-9 shrink-0 text-center text-xl font-bold">
                  {medal ?? `#${r.rank}`}
                </span>
                <TeamBadge
                  name={r.name}
                  logoUrl={r.logoUrl}
                  accentColor={r.accentColor}
                  size={40}
                />
                <span className="min-w-0 flex-1 text-sm font-semibold leading-tight">{r.name}</span>
                <span className="shrink-0 text-right text-sm">
                  <span className="font-bold">{formatVotes(r.votes)}</span>
                  <span className="ml-2 text-white/80">{formatPercent(r.percent)}</span>
                </span>
              </div>
              <div aria-hidden="true" className="h-1.5 w-full overflow-hidden rounded-full bg-navy-dark">
                <div
                  className="h-full rounded-full bg-brand-yellow"
                  style={{ width: `${Math.min(100, Math.max(0, r.percent))}%` }}
                />
              </div>
            </li>
          );
        })}
      </ol>

      {data.total === 0 && <p className="text-center text-white/80">No votes yet.</p>}

      <div className="mt-2 flex flex-col items-center gap-2">
        {state === 'open' && <PrimaryLink href="/v" plain>VOTE NOW</PrimaryLink>}
        <Link href="/privacy" className={privacyLinkClass}>
          Privacy
        </Link>
      </div>
    </div>
  );
}
