import { connection } from 'next/server';
import { isAdmin } from '@/lib/adminAuth';
import { exportVotesCsvRows } from '@/lib/admin';
import { getResults } from '@/lib/results';
import { toCsv } from '@/lib/csv';

const text = (body: string, status: number) =>
  new Response(body, {
    status,
    headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' },
  });

export async function GET(request: Request): Promise<Response> {
  await connection();
  if (!(await isAdmin())) return text('Unauthorized', 401);
  const type = new URL(request.url).searchParams.get('type');
  let csv: string;
  if (type === 'results') {
    const { rows } = await getResults();
    csv = toCsv(['team', 'votes', 'percent'], rows.map((r) => [r.name, r.votes, r.percent]));
  } else if (type === 'votes') {
    const rows = await exportVotesCsvRows();
    csv = toCsv(['team', 'created_at'], rows.map((r) => [r.team, r.createdAt]));
  } else {
    return text('Bad request', 400);
  }
  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="docipl-${type}.csv"`,
      'Cache-Control': 'no-store',
    },
  });
}
