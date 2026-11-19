import Link from 'next/link';
import { PrimaryLink, privacyLinkClass } from '@/components/PrimaryLink';

export default function SlowDownPage() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 pb-8 text-center">
      <p className="text-sm font-extrabold tracking-wide text-brand-yellow">
        DOC IPL PEOPLE&apos;S CHOICE
      </p>
      <h1 className="text-3xl font-extrabold leading-tight">Too many attempts.</h1>
      <p className="text-base">Please wait a minute and try again.</p>
      <PrimaryLink href="/v" plain>
        TRY AGAIN
      </PrimaryLink>
      <Link href="/privacy" className={privacyLinkClass}>
        Privacy
      </Link>
    </div>
  );
}
