import { randomBytes } from 'node:crypto';
import { beforeEach, expect, test } from 'vitest';
import { admin, anon, openWindow, resetData, teamId } from './helpers';

beforeEach(resetData);

const randomHex = () => randomBytes(32).toString('hex');
const iso = (offsetMs: number) => new Date(Date.now() + offsetMs).toISOString();

async function setConfig(cfg: { voting_start?: string; voting_end?: string; is_enabled?: boolean }) {
  const { error } = await admin.from('voting_config').update(cfg).eq('id', 1);
  if (error) throw new Error(error.message);
}

async function mintRaw(hash: string, ttl?: number): Promise<string> {
  const args: Record<string, unknown> = { p_token_hash: hash, p_ip_hash: 'iphash' };
  if (ttl !== undefined) args.p_ttl_seconds = ttl;
  const { data, error } = await admin.rpc('mint_token', args as never);
  if (error) throw new Error(error.message);
  return data as string;
}

async function mint(hash = randomHex()): Promise<string> {
  expect(await mintRaw(hash)).toBe('ok');
  return hash;
}

type VoteRow = { status: string; team_id: string | null; team_name: string | null };

async function vote(tokenHash: string, slug: string, browser: string, device = 'd1', ip = 'i1'): Promise<VoteRow> {
  const { data, error } = await admin.rpc('cast_vote', {
    p_token_hash: tokenHash,
    p_team_id: await teamId(slug),
    p_browser_id_hash: browser,
    p_device_hash: device,
    p_ip_hash: ip,
    p_user_agent_hash: 'ua',
  } as never);
  if (error) throw new Error(error.message);
  return (data as VoteRow[])[0];
}

async function state(): Promise<string> {
  const { data, error } = await admin.rpc('voting_state');
  if (error) throw new Error(error.message);
  return data as string;
}

async function tokenStatus(hash: string): Promise<string> {
  const { data } = await admin.from('voting_tokens').select('status').eq('token_hash', hash);
  return data![0].status;
}

test('voting_state: disabled before end → before; past end → closed; open window → open', async () => {
  // Seed: disabled, end in the future.
  await setConfig({ voting_start: iso(-3600_000), voting_end: iso(3600_000), is_enabled: false });
  expect(await state()).toBe('before');
  await setConfig({ voting_start: iso(3600_000), voting_end: iso(7200_000), is_enabled: true });
  expect(await state()).toBe('before');
  await setConfig({ voting_start: iso(-7200_000), voting_end: iso(-3600_000), is_enabled: true });
  expect(await state()).toBe('closed');
  await openWindow();
  expect(await state()).toBe('open');
});

test('mint refused when not open', async () => {
  expect(await mintRaw('t')).toBe('voting_not_open');
  expect((await admin.from('voting_tokens').select('id')).data).toHaveLength(0);
});

test('mint refused when closed', async () => {
  await setConfig({ voting_start: iso(-7200_000), voting_end: iso(-3600_000), is_enabled: true });
  expect(await mintRaw('t')).toBe('voting_closed');
});

test('mint expiry capped at voting_end', async () => {
  await openWindow();
  await setConfig({ voting_end: iso(10 * 60_000) });
  expect(await mintRaw('tcap', 7200)).toBe('ok');
  const { data: tok } = await admin.from('voting_tokens').select('expires_at,ip_hash,status').eq('token_hash', 'tcap').single();
  const { data: cfg } = await admin.from('voting_config').select('voting_end').eq('id', 1).single();
  expect(new Date(tok!.expires_at).getTime()).toBeLessThanOrEqual(new Date(cfg!.voting_end).getTime());
  expect(tok!.status).toBe('active');
  expect(tok!.ip_hash).toBe('iphash');
});

test('mint default ttl is 2h when window is longer', async () => {
  await openWindow();
  await setConfig({ voting_end: iso(10 * 3600_000) });
  await mint('tttl');
  const { data: tok } = await admin.from('voting_tokens').select('expires_at').eq('token_hash', 'tttl').single();
  const delta = new Date(tok!.expires_at).getTime() - Date.now();
  expect(delta).toBeGreaterThan(7200_000 - 60_000);
  expect(delta).toBeLessThanOrEqual(7200_000 + 60_000);
});

test('happy path vote', async () => {
  await openWindow(); await mint('t1');
  const r = await vote('t1', 'code-red', 'b1');
  expect(r).toMatchObject({ status: 'ok', team_name: 'Code Red', team_id: await teamId('code-red') });
  const { data } = await admin.from('voting_tokens').select('status,used_at').eq('token_hash', 't1');
  expect(data![0].status).toBe('used');
  expect(data![0].used_at).not.toBeNull();
  const { data: votes } = await admin.from('votes').select('device_hash,ip_hash,user_agent_hash');
  expect(votes).toEqual([{ device_hash: 'd1', ip_hash: 'i1', user_agent_hash: 'ua' }]);
});

test('reused token → token_used', async () => {
  await openWindow(); await mint('t1');
  expect((await vote('t1', 'code-red', 'b1')).status).toBe('ok');
  expect(await vote('t1', 'code-red', 'b2')).toMatchObject({ status: 'token_used', team_id: null, team_name: null });
});

test('unknown token → token_invalid', async () => {
  await openWindow();
  expect((await vote('nope', 'smash-squad', 'b1')).status).toBe('token_invalid');
});

test('revoked token → token_invalid', async () => {
  await openWindow(); await mint('trev');
  await admin.from('voting_tokens').update({ status: 'revoked' }).eq('token_hash', 'trev');
  expect((await vote('trev', 'smash-squad', 'b1')).status).toBe('token_invalid');
});

test('rejects time-expired token', async () => {
  await openWindow();
  const { error } = await admin.from('voting_tokens').insert({ token_hash: 'texp', expires_at: iso(-60_000), status: 'active' });
  expect(error).toBeNull();
  expect((await vote('texp', 'smash-squad', 'b1')).status).toBe('token_invalid');
  expect(await tokenStatus('texp')).toBe('expired');
  expect((await admin.from('votes').select('id')).data).toHaveLength(0);
});

test('invalid team leaves token active', async () => {
  await openWindow(); await mint('tteam');
  await admin.from('teams').update({ is_active: false }).eq('slug', 'dink-n-drive');
  expect((await vote('tteam', 'dink-n-drive', 'b1')).status).toBe('invalid_team');
  expect(await tokenStatus('tteam')).toBe('active');
  expect((await vote('tteam', 'smash-squad', 'b1')).status).toBe('ok');
});

test('nonexistent team id → invalid_team', async () => {
  await openWindow(); await mint('tnx');
  const { data } = await admin.rpc('cast_vote', {
    p_token_hash: 'tnx', p_team_id: '00000000-0000-0000-0000-000000000000',
    p_browser_id_hash: 'b1', p_device_hash: 'd1', p_ip_hash: 'i1', p_user_agent_hash: 'ua',
  } as never);
  expect((data as VoteRow[])[0].status).toBe('invalid_team');
});

test('same browser second token → already_voted', async () => {
  await openWindow(); await mint('ta'); await mint('tb');
  expect((await vote('ta', 'smash-squad', 'b1')).status).toBe('ok');
  expect((await vote('tb', 'jager-shots', 'b1', 'dX', 'iX')).status).toBe('already_voted');
  expect(await tokenStatus('tb')).toBe('active');
  expect((await admin.from('votes').select('id')).data).toHaveLength(1);
});

test('device+ip cap 3', async () => {
  await openWindow();
  for (const b of ['b1', 'b2', 'b3']) expect((await vote(await mint(), 'smash-squad', b)).status).toBe('ok');
  expect((await vote(await mint(), 'smash-squad', 'b4')).status).toBe('already_voted');
  expect((await vote(await mint(), 'smash-squad', 'b5', 'd1', 'i2')).status).toBe('ok');
});

test('null device/ip hash share one sentinel cap bucket', async () => {
  await openWindow({ maxPerDeviceIp: 3 });
  const castNull = async (b: string) => {
    const { data, error } = await admin.rpc('cast_vote', {
      p_token_hash: await mint(), p_team_id: await teamId('smash-squad'),
      p_browser_id_hash: b, p_device_hash: null, p_ip_hash: 'i1', p_user_agent_hash: 'ua',
    } as never);
    if (error) throw new Error(error.message);
    return (data as VoteRow[])[0].status;
  };
  for (const b of ['b1', 'b2', 'b3']) expect(await castNull(b)).toBe('ok');
  expect(await castNull('b4')).toBe('already_voted');
  const { data } = await admin.from('votes').select('device_hash,ip_hash');
  expect(data).toHaveLength(3);
  expect(data!.every(r => r.device_hash === 'none' && r.ip_hash === 'i1')).toBe(true);
});

test('cap 0 disables device check', async () => {
  await openWindow({ maxPerDeviceIp: 0 });
  for (const b of ['b1', 'b2', 'b3', 'b4', 'b5']) expect((await vote(await mint(), 'smash-squad', b)).status).toBe('ok');
});

test('closed window rejects vote', async () => {
  await openWindow(); await mint('tclosed');
  await setConfig({ voting_start: iso(-7200_000), voting_end: iso(-60_000) });
  expect((await vote('tclosed', 'smash-squad', 'b1')).status).toBe('voting_closed');
});

test('disabled window rejects vote', async () => {
  await openWindow(); await mint('tdis');
  await setConfig({ is_enabled: false });
  expect((await vote('tdis', 'smash-squad', 'b1')).status).toBe('voting_not_open');
});

test('voter row is upserted with latest hashes', async () => {
  await openWindow();
  await admin.from('teams').update({ is_active: false }).eq('slug', 'dink-n-drive');
  const t = await mint();
  await vote(t, 'dink-n-drive', 'bv', 'd1', 'ip-old'); // invalid_team: no voter created
  expect((await admin.from('voters').select('id')).data).toHaveLength(0);
  await vote(t, 'smash-squad', 'bv', 'd1', 'ip-new');
  const { data } = await admin.from('voters').select('ip_hash,user_agent_hash').eq('browser_id_hash', 'bv');
  expect(data).toEqual([{ ip_hash: 'ip-new', user_agent_hash: 'ua' }]);
});

test('cast_vote concurrency', async () => {
  await openWindow(); await mint('tc');
  const rs = await Promise.all([1, 2, 3, 4, 5].map(i => vote('tc', 'smash-squad', `bc${i}`, `dc${i}`, `ic${i}`)));
  expect(rs.filter(r => r.status === 'ok')).toHaveLength(1);
  expect(rs.filter(r => r.status === 'token_used')).toHaveLength(4);
  expect((await admin.from('votes').select('id')).data).toHaveLength(1);
});

test('cast_vote concurrency: same browser, different tokens', async () => {
  await openWindow({ maxPerDeviceIp: 0 });
  const toks = await Promise.all([1, 2, 3, 4, 5].map(() => mint()));
  const rs = await Promise.all(toks.map((t, i) => vote(t, 'smash-squad', 'bsame', `d${i}`, `i${i}`)));
  expect(rs.filter(r => r.status === 'ok')).toHaveLength(1);
  expect(rs.filter(r => r.status === 'already_voted')).toHaveLength(4);
  expect((await admin.from('votes').select('id')).data).toHaveLength(1);
  expect((await admin.from('voters').select('id')).data).toHaveLength(1);
});

test('cast_vote concurrency: device+ip cap of 1 across distinct browsers', async () => {
  await openWindow({ maxPerDeviceIp: 1 });
  const toks = await Promise.all([1, 2, 3, 4].map(() => mint()));
  const rs = await Promise.all(toks.map((t, i) => vote(t, 'smash-squad', `bcap${i}`, 'dsame', 'isame')));
  expect(rs.filter(r => r.status === 'ok')).toHaveLength(1);
  expect(rs.filter(r => r.status === 'already_voted')).toHaveLength(3);
  expect((await admin.from('votes').select('id')).data).toHaveLength(1);
});

test('purge: voters and tokens can be deleted; vote row keeps team and timestamp', async () => {
  await openWindow(); await mint('tp');
  expect((await vote('tp', 'jager-shots', 'bp')).status).toBe('ok');
  expect((await admin.from('voters').delete().neq('id', '00000000-0000-0000-0000-000000000000')).error).toBeNull();
  expect((await admin.from('voting_tokens').delete().neq('id', '00000000-0000-0000-0000-000000000000')).error).toBeNull();
  const { data } = await admin.from('votes').select('team_id,created_at,voter_id,token_id');
  expect(data).toHaveLength(1);
  expect(data![0].team_id).toBe(await teamId('jager-shots'));
  expect(data![0].created_at).toBeTruthy();
  expect(data![0].voter_id).toBeNull();
  expect(data![0].token_id).toBeNull();
  // A fresh voter is not blocked by orphaned (null voter_id) votes.
  await mint('tp2');
  expect((await vote('tp2', 'smash-squad', 'bp2', 'd9', 'i9')).status).toBe('ok');
});

test('get_voter_vote', async () => {
  await openWindow(); await mint('t1');
  await vote('t1', 'code-red', 'b1');
  const { data } = await admin.rpc('get_voter_vote', { p_browser_id_hash: 'b1' } as never);
  expect(data).toEqual([{ team_id: await teamId('code-red'), team_name: 'Code Red' }]);
  const { data: none } = await admin.rpc('get_voter_vote', { p_browser_id_hash: 'unknown' } as never);
  expect(none).toEqual([]);
});

test('rate_limit_hit', async () => {
  const hit = () => admin.rpc('rate_limit_hit', { p_bucket: 'x', p_key_hash: 'k', p_window_seconds: 600, p_max: 2 } as never);
  expect([(await hit()).data, (await hit()).data, (await hit()).data]).toEqual([true, true, false]);
  const other = await admin.rpc('rate_limit_hit', { p_bucket: 'x', p_key_hash: 'k2', p_window_seconds: 600, p_max: 2 } as never);
  expect(other.data).toBe(true);
});

test('rate_limit_hit rejects invalid window or max', async () => {
  for (const args of [{ p_window_seconds: 0, p_max: 1 }, { p_window_seconds: -5, p_max: 1 }, { p_window_seconds: 60, p_max: -1 }]) {
    const { error } = await admin.rpc('rate_limit_hit', { p_bucket: 'x', p_key_hash: 'k', ...args } as never);
    expect(error?.message).toMatch(/invalid rate limit/);
  }
});

test('get_results ranks, percents, includes zero-vote teams, excludes inactive', async () => {
  await openWindow({ maxPerDeviceIp: 0 });
  for (const b of ['r1', 'r2', 'r3']) expect((await vote(await mint(), 'jager-shots', b)).status).toBe('ok');
  expect((await vote(await mint(), 'code-blue', 'r4')).status).toBe('ok');
  await admin.from('teams').update({ is_active: false }).eq('slug', 'dinking-dragons');

  const { data, error } = await admin.rpc('get_results');
  expect(error).toBeNull();
  type Row = { slug: string; name: string; votes: number; percent: number; rank: number; team_id: string; accent_color: string | null; logo_url: string | null };
  const rows = data as Row[];
  expect(rows).toHaveLength(10);
  expect(rows.map(r => r.slug)).not.toContain('dinking-dragons');
  expect(rows[0]).toMatchObject({ slug: 'jager-shots', name: 'Jager Shots', rank: 1, votes: 3, percent: 75.0, accent_color: '#22C55E' });
  expect(rows[0].team_id).toBe(await teamId('jager-shots'));
  expect(rows[1]).toMatchObject({ slug: 'code-blue', rank: 2, votes: 1, percent: 25.0 });
  const zero = rows.slice(2);
  expect(zero.every(r => Number(r.votes) === 0 && Number(r.percent) === 0 && r.rank === 3)).toBe(true);
  // Zero-vote teams ordered by display_order.
  expect(zero.map(r => r.slug)).toEqual(['smash-squad', 'code-red', 'the-rush', 'dink-n-drive', 'spin-mavericks', 'white-coat-warriors', 'the-pacemakers', 'vdc-spartans']);
});

test('get_results with no votes: all zero, rank 1', async () => {
  const { data } = await admin.rpc('get_results');
  const rows = data as { votes: number; percent: number; rank: number }[];
  expect(rows).toHaveLength(11);
  expect(rows.every(r => Number(r.votes) === 0 && Number(r.percent) === 0 && r.rank === 1)).toBe(true);
});

async function tokenState(hash: string): Promise<string> {
  const { data, error } = await admin.rpc('get_token_state', { p_token_hash: hash } as never);
  if (error) throw new Error(error.message);
  return data as string;
}

test('token state', async () => {
  await openWindow(); await mint('tstate');
  expect(await tokenState('tstate')).toBe('active');
  expect((await vote('tstate', 'code-red', 'bstate')).status).toBe('ok');
  expect(await tokenState('tstate')).toBe('used');
  expect(await tokenState('unknown-hash')).toBe('invalid');
  const { error } = await admin.from('voting_tokens').insert({ token_hash: 'tstate-exp', expires_at: iso(-60_000), status: 'active' });
  expect(error).toBeNull();
  expect(await tokenState('tstate-exp')).toBe('invalid');
  await mint('tstate-rev');
  await admin.from('voting_tokens').update({ status: 'revoked' }).eq('token_hash', 'tstate-rev');
  expect(await tokenState('tstate-rev')).toBe('invalid');
});

test('anon cannot rpc', async () => {
  const calls: Record<string, Record<string, unknown>> = {
    get_results: {},
    voting_state: {},
    cast_vote: { p_token_hash: 'x', p_team_id: '00000000-0000-0000-0000-000000000000', p_browser_id_hash: 'b', p_device_hash: 'd', p_ip_hash: 'i', p_user_agent_hash: 'u' },
    mint_token: { p_token_hash: 'x', p_ip_hash: 'i' },
    rate_limit_hit: { p_bucket: 'x', p_key_hash: 'k', p_window_seconds: 60, p_max: 1 },
    get_voter_vote: { p_browser_id_hash: 'b' },
    get_token_state: { p_token_hash: 'x' },
  };
  for (const [fn, args] of Object.entries(calls)) {
    const { error } = await anon.rpc(fn as never, args as never);
    expect(error, fn).not.toBeNull();
    expect(error?.code, fn).toBe('42501');
  }
});
