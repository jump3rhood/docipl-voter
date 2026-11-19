import 'server-only';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { getServerEnv } from '@/lib/env';
import { ADMIN_COOKIE, verifySession } from '@/lib/adminSession';

export async function isAdmin(): Promise<boolean> {
  const store = await cookies();
  return verifySession(getServerEnv().ADMIN_SESSION_SECRET, store.get(ADMIN_COOKIE)?.value);
}

export async function requireAdmin(): Promise<void> {
  if (!(await isAdmin())) redirect('/admin/login');
}
