import { Suspense } from 'react';
import type { Metadata } from 'next';
import { connection } from 'next/server';
import { requireAdmin } from '@/lib/adminAuth';
import { AdminNav } from '@/components/admin/AdminNav';
import { logoutAction } from '@/app/admin/logout/actions';

export const metadata: Metadata = { title: 'Admin — Doc IPL', robots: { index: false } };

async function AdminShell({ children }: { children: React.ReactNode }) {
  await connection();
  await requireAdmin();
  return (
    <div className="flex flex-1 flex-col bg-navy text-white">
      <AdminNav
        logout={
          <form action={logoutAction}>
            <button
              type="submit"
              className="inline-flex min-h-11 items-center px-3 text-white/80 underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-yellow"
            >
              Log out
            </button>
          </form>
        }
      />
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
