import { afterAll, beforeEach, expect, test } from 'vitest';
import { admin, openWindow, resetData, teamId } from './helpers';
import {
  createTeam,
  getAdminConfig,
  listAllTeams,
  purgeIdentifiers,
  resetVotes,
  setTeamLogo,
  updateAdminConfig,
  updateTeam,
} from '@/lib/admin';

beforeEach(async () => {
  await resetData();
  await admin.from('teams').delete().like('slug', 'zz-%');
});

async function seedVote() {
  const { data: voter } = await admin.from('voters').insert({ browser_id_hash: 'bh' }).select('id').single();
  const { data: token } = await admin
    .from('voting_tokens')
    .insert({ token_hash: 'th', status: 'used', expires_at: new Date(Date.now() + 60_000).toISOString() })
    .select('id')
    .single();
  const { error } = await admin.from('votes').insert({
    team_id: await teamId((await listAllTeams())[0].slug),
    voter_id: voter!.id,
    token_id: token!.id,
    device_hash: 'd',
    ip_hash: 'i',
    user_agent_hash: 'u',
  });
  expect(error).toBeNull();
  await admin.from('rate_limits').insert({ bucket: 'b', key_hash: 'k', window_start: new Date().toISOString(), count: 1 });
}

test('admin_reset_votes refuses when enabled', async () => {
  await openWindow();
  await seedVote();
  expect(await resetVotes()).toBe('refused');
  const { count } = await admin.from('votes').select('*', { count: 'exact', head: true });
  expect(count).toBe(1);
});

test('reset ok when disabled clears votes/tokens/voters', async () => {
  await seedVote();
  expect(await resetVotes()).toBe('ok');
  for (const t of ['votes', 'voting_tokens', 'voters', 'rate_limits'] as const) {
    const { count } = await admin.from(t).select('*', { count: 'exact', head: true });
    expect(count, t).toBe(0);
  }
});

test('purge keeps votes, nulls hashes, deletes voters/tokens', async () => {
  await seedVote();
  expect(await purgeIdentifiers()).toBe(1);
  const { data } = await admin.from('votes').select('*');
  expect(data).toHaveLength(1);
  expect(data![0].ip_hash).toBeNull();
  expect(data![0].device_hash).toBeNull();
  expect(data![0].user_agent_hash).toBeNull();
  for (const t of ['voting_tokens', 'voters', 'rate_limits'] as const) {
    const { count } = await admin.from(t).select('*', { count: 'exact', head: true });
    expect(count, t).toBe(0);
  }
});

test('create/update team round trip incl. inactive', async () => {
  await createTeam({ name: 'ZZ Team', slug: 'zz-team', accentColor: '#112233', displayOrder: 99 });
  let t = (await listAllTeams()).find((x) => x.slug === 'zz-team')!;
  expect(t).toMatchObject({ name: 'ZZ Team', accentColor: '#112233', displayOrder: 99, isActive: true, logoUrl: null });
  await updateTeam(t.id, { name: 'ZZ Two', slug: 'zz-two', accentColor: null, displayOrder: 100, isActive: false });
  t = (await listAllTeams()).find((x) => x.id === t.id)!;
  expect(t).toMatchObject({ name: 'ZZ Two', slug: 'zz-two', accentColor: null, displayOrder: 100, isActive: false });
});

test('duplicate slug rejected', async () => {
  await createTeam({ name: 'A', slug: 'zz-dup', accentColor: null, displayOrder: 98 });
  await expect(createTeam({ name: 'B', slug: 'zz-dup', accentColor: null, displayOrder: 99 })).rejects.toThrow('duplicate_slug');
});

test('updateAdminConfig rejects end before start', async () => {
  const c = await getAdminConfig();
  await expect(updateAdminConfig({ ...c, end: new Date(c.start.getTime() - 1000) })).rejects.toThrow('end_before_start');
  await updateAdminConfig({ ...c, maxVotesPerDeviceIp: 5 });
  expect((await getAdminConfig()).maxVotesPerDeviceIp).toBe(5);
});

test('setTeamLogo uploads to team-logos and sets logo_url', async () => {
  await createTeam({ name: 'Logo', slug: 'zz-logo', accentColor: null, displayOrder: 97 });
  const t = (await listAllTeams()).find((x) => x.slug === 'zz-logo')!;
  const png = Uint8Array.from(
    Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64'),
  );
  const url = await setTeamLogo(t.id, { bytes: png.buffer as ArrayBuffer, type: 'image/png', slug: 'zz-logo' });
  const after = (await listAllTeams()).find((x) => x.id === t.id)!;
  expect(after.logoUrl).toBe(url);
  expect(url).toContain('/team-logos/zz-logo-');
  const res = await fetch(url);
  expect(res.status).toBe(200);
  const path = url.split('/team-logos/')[1];
  await admin.storage.from('team-logos').remove([path]);
});

afterAll(async () => {
  await admin.from('teams').delete().like('slug', 'zz-%');
});
