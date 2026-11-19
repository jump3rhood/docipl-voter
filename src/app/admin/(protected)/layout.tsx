import { Suspense } from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { connection } from 'next/server';
import { requireAdmin } from '@/lib/adminAuth';

export const metadata: Metadata = { title: 'Admin — Doc IPL', robots: { index: false } };

const links = [
  { href: '/admin', label: 'Dashboard' },
  { href: '/admin/voting', label: 'Voting' },
  { href: '/admin/teams', label: 'Teams' },
  { href: '/admin/results', label: 'Results' },
];

async function AdminShell({ children }: { children: React.ReactNode }) {
  await connection();
  await requireAdmin();
  return (
    <div className="flex flex-1 flex-col bg-navy text-white">
      <nav className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-white/20 px-4 py-2 text-sm">
        {links.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className="inline-flex min-h-11 items-center underline-offset-4 hover:underline"
          >
            {l.label}
          </Link>
        ))}
        <form action="/admin/logout" method="post" className="ml-auto">
          <button
            type="submit"
            className="inline-flex min-h-11 items-center text-white/80 underline"
          >
            Log out
          </button>
        </form>
      </nav>
      <div className="flex-1 px-4 py-6">{children}</div>
    </div>
  );
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<div className="flex-1 bg-navy" aria-hidden />}>
      <AdminShell>{children}</AdminShell>
    </Suspense>
  );
}
