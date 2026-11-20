'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const links = [
  { href: '/admin', label: 'Dashboard' },
  { href: '/admin/voting', label: 'Voting' },
  { href: '/admin/teams', label: 'Teams' },
  { href: '/admin/results', label: 'Results' },
];

const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), [tabindex]:not([tabindex="-1"])';

function isCurrent(pathname: string, href: string) {
  return href === '/admin' ? pathname === '/admin' : pathname === href || pathname.startsWith(`${href}/`);
}

function Panel({ pathname, logout, onClose }: { pathname: string; logout: React.ReactNode; onClose: () => void }) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);
  const closeRef = useRef(onClose);
  useEffect(() => {
    closeRef.current = onClose;
  });

  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    panelRef.current?.querySelector<HTMLElement>('a[href]')?.focus();
    const raf = requestAnimationFrame(() => setShown(true));
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        closeRef.current();
        return;
      }
      if (e.key !== 'Tab') return;
      const items = panelRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE);
      if (!items || items.length === 0) {
        e.preventDefault();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;
      if (!panelRef.current?.contains(active)) {
        e.preventDefault();
        first.focus();
      } else if (e.shiftKey && active === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    }
    document.addEventListener('keydown', onKeyDown);
    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = prevOverflow;
    };
  }, []);

  return (
    <div className="fixed inset-0 z-50">
      <button
        type="button"
        tabIndex={-1}
        aria-label="Close"
        data-testid="admin-nav-backdrop"
        onClick={onClose}
        className={`absolute inset-0 cursor-default bg-black/60 transition-opacity duration-200 motion-reduce:transition-none ${shown ? 'opacity-100' : 'opacity-0'}`}
      />
      <div
        ref={panelRef}
        id="admin-menu-panel"
        role="dialog"
        aria-modal="true"
        aria-label="Admin menu"
        className={`absolute inset-y-0 right-0 flex w-72 max-w-[85%] flex-col gap-1 bg-navy-light px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 text-white transition-transform duration-200 motion-reduce:transition-none ${shown ? 'translate-x-0' : 'translate-x-full'}`}
      >
        <button
          type="button"
          aria-label="Close menu"
          onClick={onClose}
          className="-mr-2 inline-flex min-h-11 min-w-11 items-center justify-center self-end text-2xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-yellow"
        >
          <span aria-hidden="true">✕</span>
        </button>
        <nav aria-label="Admin" className="flex flex-col">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              onClick={onClose}
              aria-current={isCurrent(pathname, l.href) ? 'page' : undefined}
              className={`inline-flex min-h-12 items-center rounded-lg px-3 text-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-yellow ${
                isCurrent(pathname, l.href) ? 'bg-white/10 font-bold text-brand-yellow' : 'text-white'
              }`}
            >
              {l.label}
            </Link>
          ))}
        </nav>
        <div className="mt-auto border-t border-white/20 pt-3">{logout}</div>
      </div>
    </div>
  );
}

export function AdminNav({ logout }: { logout: React.ReactNode }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [prevPath, setPrevPath] = useState(pathname);
  const burgerRef = useRef<HTMLButtonElement>(null);
  const wasOpen = useRef(false);

  if (pathname !== prevPath) {
    setPrevPath(pathname);
    setOpen(false);
  }

  useEffect(() => {
    if (wasOpen.current && !open) burgerRef.current?.focus();
    wasOpen.current = open;
  }, [open]);

  const current = links.find((l) => isCurrent(pathname, l.href));

  return (
    <>
      <div className="flex items-center justify-between border-b border-white/20 px-4 py-1">
        <span data-testid="admin-nav-label" className="text-base font-bold">
          {current?.label ?? 'Admin'}
        </span>
        <button
          ref={burgerRef}
          type="button"
          aria-label="Open menu"
          aria-expanded={open}
          aria-controls="admin-menu-panel"
          onClick={() => setOpen(true)}
          className="-mr-2 inline-flex min-h-11 min-w-11 items-center justify-center text-2xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-yellow"
        >
          <span aria-hidden="true">☰</span>
        </button>
      </div>
      {open && <Panel pathname={pathname} logout={logout} onClose={() => setOpen(false)} />}
    </>
  );
}
