import type { VotingState } from '@/lib/votingState';
import { PrimaryLink } from '@/components/PrimaryLink';

export function StatusScreen({ state, startLabel }: { state: VotingState; startLabel: string }) {
  return (
    <div className="flex flex-1 flex-col justify-center gap-4 pb-16">
      <p className="text-sm font-extrabold tracking-wide text-brand-yellow">
        DOC IPL PEOPLE&apos;S CHOICE
      </p>
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
          <PrimaryLink href="/v">VOTE NOW</PrimaryLink>
        </>
      )}
      {state === 'closed' && (
        <>
          <h1 className="text-3xl font-extrabold leading-tight">Voting has closed.</h1>
          <p className="text-base">Thank you to everyone who participated!</p>
          <PrimaryLink href="/results">VIEW FINAL RESULTS</PrimaryLink>
        </>
      )}
    </div>
  );
}
