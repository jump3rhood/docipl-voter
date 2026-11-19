import Link from 'next/link';

export const primaryButtonClass =
  'flex min-h-14 w-full items-center justify-center rounded-2xl bg-brand-yellow px-6 text-lg font-extrabold uppercase tracking-wide text-navy';

export function PrimaryLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className={primaryButtonClass}>
      {children}
    </Link>
  );
}
