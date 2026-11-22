import type { VotingState } from '@/lib/votingState';
import Link from 'next/link';
import { Reveal } from '@/components/motion/Reveal';
import { PrimaryLink, privacyLinkClass } from '@/components/PrimaryLink';

export function StatusScreen({ state, startLabel }: { state: VotingState; startLabel: string }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 pb-8 text-center">
      <Reveal>
        <p className="text-sm font-extrabold tracking-wide text-brand-yellow">
          DOC IPL PEOPLE&apos;S CHOICE
        </p>
      </Reveal>
      <Reveal delay={0.08} className="flex w-full flex-col items-center gap-4">
        {state === 'before' && (
          <>
            <h1 className="text-3xl font-extrabold leading-tight">Voting opens soon.</h1>
            <p className="text-base">Voting starts:</p>
            <p className="text-xl font-bold text-brand-yellow">{startLabel}</p>
          </>
        )}
        {state === 'paused' && (
          <>
            <h1 className="text-3xl font-extrabold leading-tight">Voting is paused.</h1>
            <p className="text-base">Check back soon.</p>
          </>
        )}
        {state === 'open' && (
          <>
            <h1 className="text-3xl font-extrabold leading-tight">Voting is open!</h1>
            <PrimaryLink href="/v" plain>VOTE NOW</PrimaryLink>
          </>
        )}
        {state === 'closed' && (
          <>
            <h1 className="text-3xl font-extrabold leading-tight">Voting has closed.</h1>
            <p className="text-base">Thank you to everyone who participated!</p>
          </>
        )}
      </Reveal>
      <Reveal delay={0.16}>
        <Link href="/privacy" className={privacyLinkClass}>
          Privacy
        </Link>
      </Reveal>
    </div>
  );
}
