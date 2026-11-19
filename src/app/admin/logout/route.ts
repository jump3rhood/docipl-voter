import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { ADMIN_COOKIE } from '@/lib/adminSession';

export async function POST(request: Request) {
  const redirectTo = new URL('/admin/login', request.url);
  const origin = request.headers.get('origin');
  // Cross-origin POSTs must not log the admin out.
  if (origin && origin !== new URL(request.url).origin) {
    return NextResponse.redirect(redirectTo, 303);
  }
  (await cookies()).delete(ADMIN_COOKIE);
  return NextResponse.redirect(redirectTo, 303);
}
