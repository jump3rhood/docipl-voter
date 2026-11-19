import Link from 'next/link';
import { PrimaryLink, privacyLinkClass } from '@/components/PrimaryLink';

export function ThankYou({ teamName }: { teamName: string | null }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 pb-8 text-center">
      <h1 className="text-3xl font-extrabold leading-tight">🎉 THANK YOU!</h1>
      <p className="text-base">Your vote has been recorded.</p>
      {teamName && (
        <div className="w-full rounded-2xl bg-navy-light p-4">
          <p className="text-sm">You voted for:</p>
          <p className="text-xl font-bold text-brand-yellow">{teamName}</p>
        </div>
      )}
      <PrimaryLink href="/results">VIEW LIVE RESULTS</PrimaryLink>
      <Link href="/privacy" className={privacyLinkClass}>
        Privacy
      </Link>
    </div>
  );
}
