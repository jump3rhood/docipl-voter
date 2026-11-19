import Link from 'next/link';
import { PrimaryLink, privacyLinkClass } from '@/components/PrimaryLink';

export function ExpiredBallot() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 pb-8 text-center">
      <h1 className="text-3xl font-extrabold leading-tight">This ballot link has expired.</h1>
      <p className="text-base">Get a new ballot to vote.</p>
      <PrimaryLink href="/v" plain>GET A NEW BALLOT</PrimaryLink>
      <Link href="/privacy" className={privacyLinkClass}>
        Privacy
      </Link>
    </div>
  );
}
