import { NextResponse, connection } from 'next/server';
import { isAdmin } from '@/lib/adminAuth';
import { getResults } from '@/lib/results';

// Admin-only: results are never shown to voters. Responses are per-user, so never cache them in a CDN.
const NO_STORE = { 'Cache-Control': 'private, no-store' };

export async function GET(): Promise<NextResponse> {
  await connection();
  if (!(await isAdmin())) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401, headers: NO_STORE });
  }
  try {
    const { total, rows } = await getResults();
    return NextResponse.json({ total, rows }, { headers: NO_STORE });
  } catch (err) {
    console.error('[results] unavailable', err instanceof Error ? err.message : String(err));
    return NextResponse.json({ error: 'unavailable' }, { status: 500, headers: NO_STORE });
  }
}
