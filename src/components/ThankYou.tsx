'use client';

import Link from 'next/link';
import { Reveal } from '@/components/motion/Reveal';
import { PrimaryLink, privacyLinkClass } from '@/components/PrimaryLink';
import { Celebration } from '@/components/Celebration';

export function ThankYou({
  teamName,
  accentColor,
  results = null,
}: {
  teamName: string | null;
  accentColor?: string | null;
  /** Results link to show, only when an admin has made results public. */
  results?: 'live' | 'final' | null;
}) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 pb-8 text-center">
      <Celebration colors={[accentColor ?? '#FFD21F', '#FFD21F', '#FFFFFF']} />
      <Reveal className="flex flex-col items-center gap-4">
        <h1 className="text-3xl font-extrabold leading-tight">🎉 THANK YOU!</h1>
        <p className="text-base">Your vote has been recorded.</p>
      </Reveal>
      {teamName && (
        <Reveal delay={0.12} className="w-full">
          <div className="w-full rounded-2xl bg-navy-light p-4">
            <p className="text-sm">You voted for:</p>
            <p className="text-xl font-bold text-brand-yellow">{teamName}</p>
          </div>
        </Reveal>
      )}
      {results && (
        <PrimaryLink href="/results">
          {results === 'final' ? 'VIEW FINAL RESULTS' : 'VIEW LIVE RESULTS'}
        </PrimaryLink>
      )}
      <Link href="/privacy" className={privacyLinkClass}>
        Privacy
      </Link>
    </div>
  );
}
