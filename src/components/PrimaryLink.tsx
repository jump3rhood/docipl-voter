import Link from 'next/link';

export const primaryButtonClass =
  'flex min-h-14 w-full items-center justify-center rounded-2xl bg-brand-yellow px-6 transition-transform active:scale-[0.97] text-lg font-extrabold uppercase tracking-wide text-navy focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-yellow';

export const privacyLinkClass =
  'inline-flex min-h-11 items-center justify-center px-3 text-sm text-white/80 underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-yellow';

/**
 * `plain` renders a bare <a> so Next never prefetches the target. Use it for routes
 * that have side effects on GET (/v mints a ballot token).
 */
export function PrimaryLink({
  href,
  children,
  plain = false,
}: {
  href: string;
  children: React.ReactNode;
  plain?: boolean;
}) {
  if (plain) {
    return (
      <a href={href} className={primaryButtonClass}>
        {children}
      </a>
    );
  }
  return (
    <Link href={href} className={primaryButtonClass}>
      {children}
    </Link>
  );
}
