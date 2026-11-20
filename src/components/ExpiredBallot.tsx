import Link from 'next/link';
import { Reveal } from '@/components/motion/Reveal';
import { PrimaryLink, privacyLinkClass } from '@/components/PrimaryLink';

export function ExpiredBallot() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 pb-8 text-center">
      <Reveal className="flex flex-col items-center gap-4">
        <h1 className="text-3xl font-extrabold leading-tight">This ballot link has expired.</h1>
        <p className="text-base">Get a new ballot to vote.</p>
      </Reveal>
      <Reveal delay={0.08} className="w-full">
        <PrimaryLink href="/v" plain>GET A NEW BALLOT</PrimaryLink>
      </Reveal>
      <Reveal delay={0.16}>
        <Link href="/privacy" className={privacyLinkClass}>
          Privacy
        </Link>
      </Reveal>
    </div>
  );
}
