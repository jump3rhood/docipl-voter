import 'server-only';
import { getSupabaseAdmin } from '@/lib/supabase';
import type { Team } from '@/lib/voting';

export type AdminTeam = Team & { displayOrder: number; isActive: boolean };
export type AdminConfig = { start: Date; end: Date; enabled: boolean; maxVotesPerDeviceIp: number };

const LOGO_BUCKET = 'team-logos';
const EXT: Record<string, string> = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' };

type DbError = { code?: string; message: string };

function fail(what: string, error: DbError): never {
  if (error.code === '23505') throw new Error('duplicate_slug');
  if (error.code === '23514') throw new Error('end_before_start');
  throw new Error(`${what} failed: ${error.message}`);
}

export async function getAdminConfig(): Promise<AdminConfig> {
  const { data, error } = await getSupabaseAdmin()
    .from('voting_config')
    .select('voting_start, voting_end, is_enabled, max_votes_per_device_ip')
    .eq('id', 1)
    .single();
  if (error) fail('getAdminConfig', error);
  return {
    start: new Date(data.voting_start),
    end: new Date(data.voting_end),
    enabled: data.is_enabled,
    maxVotesPerDeviceIp: data.max_votes_per_device_ip,
  };
}

export async function updateAdminConfig(c: AdminConfig): Promise<void> {
  const { error } = await getSupabaseAdmin()
    .from('voting_config')
    .update({
      voting_start: c.start.toISOString(),
      voting_end: c.end.toISOString(),
      is_enabled: c.enabled,
      max_votes_per_device_ip: c.maxVotesPerDeviceIp,
    })
    .eq('id', 1);
  if (error) fail('updateAdminConfig', error);
}

export async function listAllTeams(): Promise<AdminTeam[]> {
  const { data, error } = await getSupabaseAdmin()
    .from('teams')
    .select('id, name, slug, logo_url, accent_color, display_order, is_active')
    .order('display_order', { ascending: true });
  if (error) fail('listAllTeams', error);
  return (data ?? []).map((t) => ({
    id: t.id,
    name: t.name,
    slug: t.slug,
    logoUrl: t.logo_url ?? null,
    accentColor: t.accent_color ?? null,
    displayOrder: t.display_order,
    isActive: t.is_active,
  }));
}

export async function createTeam(t: {
  name: string;
  slug: string;
  accentColor: string | null;
  displayOrder: number;
}): Promise<void> {
  const { error } = await getSupabaseAdmin().from('teams').insert({
    name: t.name,
    slug: t.slug,
    accent_color: t.accentColor,
    display_order: t.displayOrder,
  });
  if (error) fail('createTeam', error);
}

export async function updateTeam(
  id: string,
  t: { name: string; slug: string; accentColor: string | null; displayOrder: number; isActive: boolean },
): Promise<void> {
  const { error } = await getSupabaseAdmin()
    .from('teams')
    .update({
      name: t.name,
      slug: t.slug,
      accent_color: t.accentColor,
      display_order: t.displayOrder,
      is_active: t.isActive,
    })
    .eq('id', id);
  if (error) fail('updateTeam', error);
}

export async function setTeamLogo(
  id: string,
  file: { bytes: ArrayBuffer; type: string; slug: string },
): Promise<string> {
  const ext = EXT[file.type];
  if (!ext) throw new Error('unsupported_type');
  const db = getSupabaseAdmin();
  const path = `${file.slug}-${Date.now()}.${ext}`;
  const up = await db.storage
    .from(LOGO_BUCKET)
    .upload(path, file.bytes, { contentType: file.type, upsert: false });
  if (up.error) throw new Error(`setTeamLogo upload failed: ${up.error.message}`);
  const url = db.storage.from(LOGO_BUCKET).getPublicUrl(path).data.publicUrl;
  const { error } = await db.from('teams').update({ logo_url: url }).eq('id', id);
  if (error) fail('setTeamLogo', error);
  return url;
}

export async function resetVotes(): Promise<'ok' | 'refused'> {
  const { data, error } = await getSupabaseAdmin().rpc('admin_reset_votes');
  if (error) fail('resetVotes', error);
  return data === 'ok' ? 'ok' : 'refused';
}

export async function purgeIdentifiers(): Promise<number> {
  const { data, error } = await getSupabaseAdmin().rpc('admin_purge_identifiers');
  if (error) fail('purgeIdentifiers', error);
  return data ?? 0;
}

export async function exportVotesCsvRows(): Promise<{ team: string; createdAt: string }[]> {
  const { data, error } = await getSupabaseAdmin()
    .from('votes')
    .select('created_at, teams(name)')
    .order('created_at', { ascending: true });
  if (error) fail('exportVotesCsvRows', error);
  return (data ?? []).map((v) => ({
    team: (v.teams as { name: string } | null)?.name ?? '',
    createdAt: v.created_at ?? '',
  }));
}
