'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { ADMIN_COOKIE } from '@/lib/adminSession';

export async function logoutAction(): Promise<void> {
  (await cookies()).delete({ name: ADMIN_COOKIE, path: '/' });
  redirect('/admin/login');
}
