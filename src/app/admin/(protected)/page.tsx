import { Suspense } from 'react';
import { connection } from 'next/server';
import { requireAdmin } from '@/lib/adminAuth';

async function Home() {
  await connection();
  await requireAdmin();
  return <h1 className="text-2xl font-extrabold">Admin</h1>;
}

export default function AdminHome() {
  return (
    <Suspense fallback={null}>
      <Home />
    </Suspense>
  );
}
