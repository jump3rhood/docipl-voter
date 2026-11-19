'use server';

import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { getServerEnv } from '@/lib/env';
import { getClientIp, ipKey } from '@/lib/clientIp';
import { hashId } from '@/lib/identity';
import { rateLimitHit } from '@/lib/votes';
import {
  ADMIN_COOKIE,
  ADMIN_SESSION_SECONDS,
  checkPassword,
  signSession,
} from '@/lib/adminSession';

export async function loginAction(
  _prev: { error?: string } | undefined,
  formData: FormData,
): Promise<{ error?: string }> {
  const env = getServerEnv();
  const ip = getClientIp(await headers());
  if (!(await rateLimitHit('adminLogin', hashId(ipKey(ip ?? 'unknown'))))) {
    return { error: 'Too many attempts. Try again later.' };
  }
  const password = formData.get('password');
  if (typeof password !== 'string' || !checkPassword(password, env.ADMIN_PASSWORD)) {
    return { error: 'Wrong password.' };
  }
  (await cookies()).set(ADMIN_COOKIE, signSession(env.ADMIN_SESSION_SECRET), {
    httpOnly: true,
    sameSite: 'strict',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: ADMIN_SESSION_SECONDS,
  });
  redirect('/admin');
}
