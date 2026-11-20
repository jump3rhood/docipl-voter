'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { LazyMotion, m } from 'framer-motion';
import { PrimaryLink, privacyLinkClass } from '@/components/PrimaryLink';
import { TeamBadge } from '@/components/TeamBadge';
import {
  formatPercent,
  formatVotes,
  medalFor,
  totalLabel,
  type ResultRow,
  type ResultsPayload,
} from '@/lib/resultsFormat';
import type { VotingState } from '@/lib/votingState';

const loadDomMax = () => import('@/lib/motionFeaturesMax').then((r) => r.default);

function subheading(state: VotingState): string {
  if (state === 'open') return 'Live results · updates every 15 seconds';
  if (state === 'closed') return 'Final results';
  return 'Results';
}

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const isStrOrNull = (v: unknown): v is string | null => v === null || typeof v === 'string';

function isRow(x: unknown): x is ResultRow {
  if (typeof x !== 'object' || x === null) return false;
  const r = x as Record<string, unknown>;
  return (
    typeof r.teamId === 'string' &&
    typeof r.name === 'string' &&
    typeof r.slug === 'string' &&
    isNum(r.votes) &&
    isNum(r.percent) &&
    isNum(r.rank) &&
    isStrOrNull(r.logoUrl) &&
    isStrOrNull(r.accentColor)
  );
}

function isPayload(x: unknown): x is ResultsPayload {
  if (typeof x !== 'object' || x === null) return false;
  const o = x as { total?: unknown; rows?: unknown };
  return isNum(o.total) && Array.isArray(o.rows) && o.rows.every(isRow);
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
    const doFetch = fetchImpl ?? fetch;
    // Single-flight loop: every chain is tagged with a generation; stop() bumps it,
    // so a superseded chain can neither apply data nor reschedule itself.
    let gen = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let inFlight: AbortController | null = null;

    const stop = () => {
      gen++;
      clearTimeout(timer);
      timer = undefined;
      inFlight?.abort();
      inFlight = null;
    };

    const schedule = (myGen: number) => {
      if (myGen !== gen) return;
      timer = setTimeout(() => void tick(myGen), pollMs);
    };

    const tick = async (myGen: number) => {
      if (document.visibilityState !== 'hidden') {
        const ctrl = new AbortController();
        inFlight = ctrl;
        try {
          const res = await doFetch('/api/results', { signal: ctrl.signal, cache: 'no-store' });
          if (res.ok) {
            const next: unknown = await res.json();
            if (myGen === gen && isPayload(next)) setData(next);
          }
        } catch {
          // keep last good data
        } finally {
          if (inFlight === ctrl) inFlight = null;
        }
      }
      schedule(myGen);
    };

    const onVisibility = () => {
      if (document.visibilityState === 'hidden') return; // loop skips fetches while hidden
      stop();
      void tick(gen);
    };

    document.addEventListener('visibilitychange', onVisibility);
    schedule(gen);
    return () => {
      stop();
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [pollMs, fetchImpl]);

  return (
    <div className="flex flex-1 flex-col gap-4 px-4 py-6 text-white">
      <div className="text-center">
        <h1 className="text-2xl font-extrabold">Doc IPL People&apos;s Choice</h1>
        <p className="mt-1 text-sm text-white/80">{subheading(state)}</p>
        <p className="mt-2 text-base font-semibold text-brand-yellow">{totalLabel(data.total)}</p>
      </div>

      <LazyMotion features={loadDomMax} strict>
      <ol className="flex flex-col gap-2">
        {data.rows.map((r) => {
          const medal = medalFor(r);
          const leader = r.rank === 1 && r.votes > 0;
          return (
            <m.li
              layout
              key={r.teamId}
              className={`flex flex-col gap-2 rounded-2xl p-3 ${
                leader ? 'bg-[color-mix(in_srgb,var(--color-brand-yellow)_15%,var(--color-navy))] ring-1 ring-brand-yellow' : 'bg-navy-light'
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
                <m.div
                  className="h-full w-full origin-left rounded-full bg-brand-yellow"
                  initial={{ scaleX: 0 }}
                  animate={{ scaleX: Math.min(100, Math.max(0, r.percent)) / 100 }}
                  transition={{ duration: 0.5 }}
                />
              </div>
            </m.li>
          );
        })}
      </ol>
      </LazyMotion>

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
