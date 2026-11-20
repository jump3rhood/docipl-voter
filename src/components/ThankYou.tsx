'use client';

import Link from 'next/link';
import { m } from 'motion/react';
import { Reveal } from '@/components/motion/Reveal';
import { PrimaryLink, privacyLinkClass } from '@/components/PrimaryLink';

export function ThankYou({ teamName }: { teamName: string | null }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 pb-8 text-center">
      <Reveal className="flex flex-col items-center gap-4">
        <m.h1
          initial={{ scale: 0.9 }}
          animate={{ scale: 1 }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
          className="text-3xl font-extrabold leading-tight"
        >
          🎉 THANK YOU!
        </m.h1>
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
      <PrimaryLink href="/results">VIEW LIVE RESULTS</PrimaryLink>
      <Link href="/privacy" className={privacyLinkClass}>
        Privacy
      </Link>
    </div>
  );
}
