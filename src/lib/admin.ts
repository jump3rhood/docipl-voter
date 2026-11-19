import 'server-only';
import { getSupabaseAdmin } from '@/lib/supabase';
import type { Team } from '@/lib/voting';

export type AdminTeam = Team & { displayOrder: number; isActive: boolean };
export type AdminConfig = { start: Date; end: Date; enabled: boolean; maxVotesPerDeviceIp: number };

const LOGO_BUCKET = 'team-logos';
const MAX_LOGO_BYTES = 1024 * 1024;
const EXT: Record<string, string> = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' };

type DbError = { code?: string; message: string };

function fail(what: string, error: DbError, map: Record<string, string> = {}): never {
  const mapped = error.code ? map[error.code] : undefined;
  if (mapped) throw new Error(mapped);
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
  if (error) fail('updateAdminConfig', error, { '23514': 'end_before_start' });
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
  if (error) fail('createTeam', error, { '23505': 'duplicate_slug' });
}

export async function updateTeam(
  id: string,
  t: { name: string; slug: string; accentColor: string | null; displayOrder: number; isActive: boolean },
): Promise<void> {
  const { data, error } = await getSupabaseAdmin()
    .from('teams')
    .update({
      name: t.name,
      slug: t.slug,
      accent_color: t.accentColor,
      display_order: t.displayOrder,
      is_active: t.isActive,
    })
    .eq('id', id)
    .select('id');
  if (error) fail('updateTeam', error, { '23505': 'duplicate_slug' });
  if (!data || data.length === 0) throw new Error('not_found');
}

export async function setTeamLogo(
  id: string,
  file: { bytes: ArrayBuffer; type: string; slug?: string },
): Promise<string> {
  const ext = EXT[file.type];
  if (!ext) throw new Error('unsupported_type');
  if (file.bytes.byteLength > MAX_LOGO_BYTES) throw new Error('too_large');
  const db = getSupabaseAdmin();
  const team = await db.from('teams').select('slug, logo_url').eq('id', id).single();
  if (team.error) fail('setTeamLogo', team.error);
  const slug = team.data.slug;
  if (!/^[a-z0-9-]+$/.test(slug)) throw new Error('invalid_slug');
  const bucket = db.storage.from(LOGO_BUCKET);
  const path = `${slug}-${Date.now()}.${ext}`;
  const up = await bucket.upload(path, file.bytes, { contentType: file.type, upsert: false });
  if (up.error) throw new Error(`setTeamLogo upload failed: ${up.error.message}`);
  const url = bucket.getPublicUrl(path).data.publicUrl;
  const { error } = await db.from('teams').update({ logo_url: url }).eq('id', id).select('id').single();
  if (error) {
    await bucket.remove([path]);
    fail('setTeamLogo', error);
  }
  const marker = `/${LOGO_BUCKET}/`;
  const prev = team.data.logo_url;
  if (prev && prev.includes(marker)) {
    const oldPath = decodeURIComponent(prev.split(marker)[1].split('?')[0]);
    await bucket.remove([oldPath]).catch(() => undefined);
  }
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
  const PAGE = 1000;
  const rows: { team: string; createdAt: string }[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await getSupabaseAdmin()
      .from('votes')
      .select('created_at, teams(name)')
      .order('created_at', { ascending: true })
      .order('id', { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) fail('exportVotesCsvRows', error);
    for (const v of data ?? []) {
      rows.push({ team: (v.teams as { name: string } | null)?.name ?? '', createdAt: v.created_at ?? '' });
    }
    if ((data?.length ?? 0) < PAGE) break;
  }
  return rows;
}
