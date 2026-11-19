import { NextResponse, connection } from 'next/server';
import { getResults } from '@/lib/results';

export async function GET(): Promise<NextResponse> {
  await connection();
  try {
    const { total, rows } = await getResults();
    return NextResponse.json(
      { total, rows },
      { headers: { 'Cache-Control': 'public, s-maxage=10, stale-while-revalidate=20' } },
    );
  } catch (err) {
    console.error('[results] unavailable', err instanceof Error ? err.message : String(err));
    return NextResponse.json(
      { error: 'unavailable' },
      { status: 500, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}
