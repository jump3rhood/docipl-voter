import 'server-only';
import { getServerEnv } from '@/lib/env';
import { getSupabaseAdmin } from '@/lib/supabase';

export type CastStatus =
  | 'ok'
  | 'voting_not_open'
  | 'voting_closed'
  | 'token_invalid'
  | 'token_used'
  | 'invalid_team'
  | 'already_voted';

const CAST_STATUSES: readonly string[] = [
  'ok',
  'voting_not_open',
  'voting_closed',
  'token_invalid',
  'token_used',
  'invalid_team',
  'already_voted',
];

/** Returns true if the hit is allowed. */
export async function rateLimitHit(bucket: 'mint' | 'vote' | 'adminLogin', keyHash: string): Promise<boolean> {
  const { max, windowSeconds } = getServerEnv().rateLimits[bucket];
  const { data, error } = await getSupabaseAdmin().rpc('rate_limit_hit', {
    p_bucket: bucket,
    p_key_hash: keyHash,
    p_window_seconds: windowSeconds,
    p_max: max,
  });
  if (error) throw new Error(`rate_limit_hit failed: ${error.message}`);
  return data === true;
}

export async function mintToken(
  tokenHash: string,
  ipHash: string,
): Promise<'ok' | 'voting_not_open' | 'voting_closed'> {
  const { data, error } = await getSupabaseAdmin().rpc('mint_token', {
    p_token_hash: tokenHash,
    p_ip_hash: ipHash,
  });
  if (error) throw new Error(`mint_token failed: ${error.message}`);
  if (data === 'ok' || data === 'voting_not_open' || data === 'voting_closed') return data;
  throw new Error('mint_token returned an unexpected status');
}

export async function castVote(a: {
  tokenHash: string;
  teamId: string;
  browserHash: string;
  deviceHash: string | null;
  ipHash: string;
  uaHash: string | null;
}): Promise<{ status: CastStatus; teamName: string | null }> {
  const { data, error } = await getSupabaseAdmin().rpc('cast_vote', {
    p_token_hash: a.tokenHash,
    p_team_id: a.teamId,
    p_browser_id_hash: a.browserHash,
    // The SQL function accepts null; the generated types mark these non-null.
    p_device_hash: a.deviceHash as string,
    p_ip_hash: a.ipHash,
    p_user_agent_hash: a.uaHash as string,
  });
  if (error) throw new Error(`cast_vote failed: ${error.message}`);
  const row = data?.[0];
  if (!row || !CAST_STATUSES.includes(row.status)) {
    throw new Error('cast_vote returned an unexpected result');
  }
  return { status: row.status as CastStatus, teamName: (row.team_name as string | null) ?? null };
}

export async function getVoterVote(
  browserHash: string,
): Promise<{ teamId: string; teamName: string; accentColor: string | null } | null> {
  const { data, error } = await getSupabaseAdmin().rpc('get_voter_vote', {
    p_browser_id_hash: browserHash,
  });
  if (error) throw new Error(`get_voter_vote failed: ${error.message}`);
  const row = data?.[0];
  if (!row) return null;
  const { data: team, error: teamError } = await getSupabaseAdmin()
    .from('teams')
    .select('accent_color')
    .eq('id', row.team_id)
    .maybeSingle();
  if (teamError) throw new Error(`team accent lookup failed: ${teamError.message}`);
  return { teamId: row.team_id, teamName: row.team_name, accentColor: team?.accent_color ?? null };
}

export async function getTokenState(tokenHash: string): Promise<'active' | 'used' | 'invalid'> {
  const { data, error } = await getSupabaseAdmin().rpc('get_token_state', {
    p_token_hash: tokenHash,
  });
  if (error) throw new Error(`get_token_state failed: ${error.message}`);
  if (data === 'active' || data === 'used' || data === 'invalid') return data;
  throw new Error('get_token_state returned an unexpected value');
}
