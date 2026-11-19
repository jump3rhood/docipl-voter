import { Suspense } from 'react';
import type { Metadata } from 'next';
import { connection } from 'next/server';
import { redirect } from 'next/navigation';
import { isAdmin } from '@/lib/adminAuth';
import { LoginForm } from './LoginForm';

export const metadata: Metadata = {
  title: 'Admin login — Doc IPL',
  robots: { index: false },
};

async function Gate() {
  await connection();
  if (await isAdmin()) redirect('/admin');
  return <LoginForm />;
}

export default function AdminLoginPage() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 bg-navy px-6 py-12 text-center">
      <h1 className="text-2xl font-extrabold text-white">Admin</h1>
      <Suspense fallback={null}>
        <Gate />
      </Suspense>
    </main>
  );
}
