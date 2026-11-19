import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { ADMIN_COOKIE } from '@/lib/adminSession';

export async function POST(request: Request) {
  (await cookies()).delete(ADMIN_COOKIE);
  return NextResponse.redirect(new URL('/admin/login', request.url), 303);
}
