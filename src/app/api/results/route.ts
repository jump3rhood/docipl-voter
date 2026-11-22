import { NextResponse, connection } from 'next/server';
import { isAdmin } from '@/lib/adminAuth';
import { getResults } from '@/lib/results';
import { getVotingStatus } from '@/lib/voting';

// Hidden results are per-user (admin only), so they must never sit in a CDN cache.
const NO_STORE = { 'Cache-Control': 'private, no-store' };
// Public results are the same for everyone; a short CDN cache absorbs voter polling.
// Hiding them again takes effect for everyone within ~15s.
const PUBLIC = { 'Cache-Control': 'public, s-maxage=10, stale-while-revalidate=5' };

export async function GET(): Promise<NextResponse> {
  await connection();
  try {
    const { resultsPublic } = await getVotingStatus();
    if (!resultsPublic && !(await isAdmin())) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401, headers: NO_STORE });
    }
    const { total, rows } = await getResults();
    return NextResponse.json({ total, rows }, { headers: resultsPublic ? PUBLIC : NO_STORE });
  } catch (err) {
    console.error('[results] unavailable', err instanceof Error ? err.message : String(err));
    return NextResponse.json({ error: 'unavailable' }, { status: 500, headers: NO_STORE });
  }
}
