import { beforeEach, describe, expect, test, vi } from 'vitest';
import { admin, openWindow, resetData } from './helpers';

const jar = { value: undefined as string | undefined };
vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: (n: string) => (jar.value && n === 'dipl_admin' ? { name: n, value: jar.value } : undefined),
  }),
}));
vi.mock('next/navigation', () => ({
  redirect: (url: string) => {
    throw new Error(`REDIRECT:${url}`);
  },
}));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('next/server', async (importActual) => ({
  ...(await importActual<typeof import('next/server')>()),
  connection: vi.fn(async () => {}),
}));

import { GET } from '@/app/admin/export/route';
import { purgeAction, resetAction } from '@/app/admin/(protected)/results/actions';
import { getAdminConfig } from '@/lib/admin';
import { signSession } from '@/lib/adminSession';
import { getServerEnv } from '@/lib/env';

const form = (o: Record<string, string>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(o)) f.set(k, v);
  return f;
};
const req = (type: string) => new Request(`http://localhost/admin/export?type=${type}`);
const login = () => {
  jar.value = signSession(getServerEnv().ADMIN_SESSION_SECRET);
};
const voteCount = async () => (await admin.from('votes').select('id', { count: 'exact', head: true })).count;

async function seedVote() {
  const { data: v, error: e1 } = await admin.from('voters').insert({ browser_id_hash: 'b1' }).select('id').single();
  if (e1) throw new Error(e1.message);
  const { data: t, error: e2 } = await admin.from('voting_tokens').insert({ token_hash: 't1', expires_at: new Date(Date.now() + 3600_000).toISOString() }).select('id').single();
  if (e2) throw new Error(e2.message);
  const { data: team } = await admin.from('teams').select('id').limit(1).single();
  const { error } = await admin.from('votes').insert({ voter_id: v.id, token_id: t.id, team_id: team!.id });
  if (error) throw new Error(error.message);
}

beforeEach(async () => {
  await resetData();
  jar.value = undefined;
});

describe('GET /admin/export', () => {
  test('401 without cookie', async () => {
    const res = await GET(req('results'));
    expect(res.status).toBe(401);
    expect(res.headers.get('cache-control')).toBe('no-store');
  });

  test('results csv with headers and team rows', async () => {
    login();
    const res = await GET(req('results'));
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('text/csv; charset=utf-8');
    expect(res.headers.get('content-disposition')).toBe('attachment; filename="docipl-results.csv"');
    expect(res.headers.get('cache-control')).toBe('no-store');
    const lines = (await res.text()).trimEnd().split('\r\n');
    expect(lines[0]).toBe('team,votes,percent');
    expect(lines.length).toBeGreaterThan(1);
  });

  test('votes csv and bad type', async () => {
    login();
    const res = await GET(req('votes'));
    expect(res.headers.get('content-disposition')).toBe('attachment; filename="docipl-votes.csv"');
    expect((await res.text()).split('\r\n')[0]).toBe('team,created_at');
    expect((await GET(req('nope'))).status).toBe(400);
  });
});

describe('danger zone actions', () => {
  test('actions reject without session', async () => {
    await expect(resetAction(undefined, form({ confirm: 'RESET' }))).rejects.toThrow('REDIRECT:/admin/login');
    await expect(purgeAction(undefined, form({ confirm: 'PURGE' }))).rejects.toThrow('REDIRECT:/admin/login');
  });

  test('reset needs RESET', async () => {
    login();
    await seedVote();
    expect(await resetAction(undefined, form({ confirm: 'reset' }))).toEqual({ error: 'Type RESET to confirm.' });
    expect(await voteCount()).toBe(1);
    expect(await resetAction(undefined, form({ confirm: 'RESET' }))).toEqual({ ok: 'Reset done.' });
    expect(await voteCount()).toBe(0);
  });

  test('reset refused while enabled', async () => {
    login();
    await seedVote();
    await openWindow();
    expect(await resetAction(undefined, form({ confirm: 'RESET' }))).toEqual({
      error: 'Voting must be paused before reset.',
    });
    expect(await voteCount()).toBe(1);
    expect((await getAdminConfig()).enabled).toBe(true);
  });

  test('purge needs PURGE, refused while enabled, keeps votes', async () => {
    login();
    await seedVote();
    expect(await purgeAction(undefined, form({ confirm: 'purge' }))).toEqual({ error: 'Type PURGE to confirm.' });
    await openWindow();
    expect(await purgeAction(undefined, form({ confirm: 'PURGE' }))).toEqual({ error: 'Pause voting first.' });
    await admin.from('voting_config').update({ is_enabled: false }).eq('id', 1);
    expect(await purgeAction(undefined, form({ confirm: 'PURGE' }))).toEqual({
      ok: 'Purged identifiers; 1 votes kept.',
    });
    expect(await voteCount()).toBe(1);
  });
});
