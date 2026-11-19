import { beforeEach, expect, test } from 'vitest';
import { admin, anon, resetData } from './helpers';

beforeEach(resetData);

test('11 seeded active teams in order', async () => {
  const { data } = await admin.from('teams').select('slug,display_order,is_active').order('display_order');
  expect(data!.map(t => t.slug)).toEqual([
    'smash-squad', 'jager-shots', 'code-red', 'the-rush', 'dink-n-drive', 'spin-mavericks', 'code-blue', 'white-coat-warriors', 'the-pacemakers', 'vdc-spartans', 'dinking-dragons',
  ]);
  expect(data!.every(t => t.is_active)).toBe(true);
});
test('voting_config is a single disabled row', async () => {
  const { data } = await admin.from('voting_config').select('*');
  expect(data).toHaveLength(1);
  expect(data![0].is_enabled).toBe(false);
  expect(data![0].max_votes_per_device_ip).toBe(3);
  const { error } = await admin.from('voting_config').insert({ id: 2, voting_start: new Date().toISOString(), voting_end: new Date(Date.now()+1e6).toISOString() });
  expect(error).not.toBeNull();
});
test('config rejects end before start', async () => {
  const { error } = await admin.from('voting_config').update({ voting_start: '2026-01-02T00:00:00Z', voting_end: '2026-01-01T00:00:00Z' }).eq('id', 1);
  expect(error).not.toBeNull();
});
test('duplicate token_hash rejected', async () => {
  const row = { token_hash: 'h1', expires_at: new Date(Date.now()+1e6).toISOString() };
  await admin.from('voting_tokens').insert(row);
  expect((await admin.from('voting_tokens').insert(row)).error?.code).toBe('23505');
});
test('anon is locked out', async () => {
  for (const t of ['teams','votes','voters','voting_tokens','voting_config','rate_limits']) {
    const { data, error } = await anon.from(t).select('*');
    expect(error?.code, t).toBe('42501');
    expect(data ?? []).toHaveLength(0);
  }
});
