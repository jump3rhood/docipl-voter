import 'server-only';
import { getSupabaseAdmin } from '@/lib/supabase';
import { deriveVotingState, type VotingState } from '@/lib/votingState';

export type Team = {
  id: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  accentColor: string | null;
};

export async function getActiveTeams(): Promise<Team[]> {
  const { data, error } = await getSupabaseAdmin()
    .from('teams')
    .select('id, name, slug, logo_url, accent_color')
    .eq('is_active', true)
    .order('display_order', { ascending: true });
  if (error) throw new Error(`getActiveTeams failed: ${error.message}`);
  return (data ?? []).map((t) => ({
    id: t.id,
    name: t.name,
    slug: t.slug,
    logoUrl: t.logo_url ?? null,
    accentColor: t.accent_color ?? null,
  }));
}

export async function getVotingStatus(
  now: Date = new Date(),
): Promise<{ state: VotingState; start: Date; end: Date }> {
  const { data, error } = await getSupabaseAdmin()
    .from('voting_config')
    .select('voting_start, voting_end, is_enabled')
    .eq('id', 1)
    .single();
  if (error) throw new Error(`getVotingStatus failed: ${error.message}`);
  const start = new Date(data.voting_start);
  const end = new Date(data.voting_end);
  return { state: deriveVotingState({ start, end, enabled: data.is_enabled }, now), start, end };
}
