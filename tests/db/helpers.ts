import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL!;
const opts = { auth: { persistSession: false, autoRefreshToken: false } };

export const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, opts);
export const anon = createClient(url, process.env.SUPABASE_ANON_KEY!, opts);

const NIL = '00000000-0000-0000-0000-000000000000';

async function must<T extends { error: { message: string } | null }>(p: PromiseLike<T>) {
  const res = await p;
  if (res.error) throw new Error(res.error.message);
}

const SEED_CONFIG = {
  is_enabled: false,
  voting_start: '2026-11-21T09:00:00+05:30',
  voting_end: '2026-11-22T21:00:00+05:30',
  max_votes_per_device_ip: 3,
  results_public: false,
};

const SEED_TEAM_ORDER = [
  'smash-squad', 'jager-shots', 'code-red', 'the-rush', 'dink-n-drive', 'spin-mavericks',
  'code-blue', 'white-coat-warriors', 'the-pacemakers', 'vdc-spartans', 'dinking-dragons',
];

export async function resetData(): Promise<void> {
  await must(admin.from('votes').delete().neq('id', NIL));
  await must(admin.from('voting_tokens').delete().neq('id', NIL));
  await must(admin.from('voters').delete().neq('id', NIL));
  await must(admin.from('rate_limits').delete().neq('bucket', ''));
  await must(admin.from('teams').update({ is_active: true }).neq('id', NIL));
  for (const [i, slug] of SEED_TEAM_ORDER.entries()) {
    await must(admin.from('teams').update({ display_order: i + 1 }).eq('slug', slug));
  }
  // Restore seed config; set end first-safe by updating both in one statement.
  await must(admin.from('voting_config').update(SEED_CONFIG).eq('id', 1));
}

export async function openWindow(opts: { maxPerDeviceIp?: number } = {}): Promise<void> {
  const now = Date.now();
  await must(
    admin
      .from('voting_config')
      .update({
        voting_start: new Date(now - 3600_000).toISOString(),
        voting_end: new Date(now + 3600_000).toISOString(),
        is_enabled: true,
        max_votes_per_device_ip: opts.maxPerDeviceIp ?? 3,
      })
      .eq('id', 1),
  );
}

export async function teamId(slug: string): Promise<string> {
  const { data, error } = await admin.from('teams').select('id').eq('slug', slug).single();
  if (error) throw new Error(error.message);
  return data.id;
}
