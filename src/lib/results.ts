import 'server-only';
import { getSupabaseAdmin } from '@/lib/supabase';
import type { ResultsPayload } from '@/lib/resultsFormat';

export async function getResults(): Promise<ResultsPayload> {
  const { data, error } = await getSupabaseAdmin().rpc('get_results');
  if (error) throw new Error(`getResults failed: ${error.message}`);
  const rows = (data ?? []).map((r) => ({
    teamId: r.team_id,
    name: r.name,
    slug: r.slug,
    logoUrl: r.logo_url ?? null,
    accentColor: r.accent_color ?? null,
    votes: Number(r.votes),
    percent: Number(r.percent),
    rank: Number(r.rank),
  }));
  return { total: rows.reduce((s, r) => s + r.votes, 0), rows };
}
