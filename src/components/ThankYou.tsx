import { PrimaryLink } from '@/components/PrimaryLink';

export function ThankYou({ teamName }: { teamName: string | null }) {
  return (
    <div className="flex flex-1 flex-col justify-center gap-4 pb-16">
      <h1 className="text-3xl font-extrabold leading-tight">🎉 THANK YOU!</h1>
      <p className="text-base">Your vote has been recorded.</p>
      {teamName && (
        <div className="rounded-2xl bg-navy-light p-4">
          <p className="text-sm">You voted for:</p>
          <p className="text-xl font-bold text-brand-yellow">{teamName}</p>
        </div>
      )}
      <PrimaryLink href="/results">VIEW LIVE RESULTS</PrimaryLink>
    </div>
  );
}
