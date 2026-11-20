import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { admin, resetData } from './helpers';

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

import { createTeamAction, reorderTeamsAction, updateTeamAction } from '@/app/admin/(protected)/teams/actions';
import { signSession } from '@/lib/adminSession';
import { getServerEnv } from '@/lib/env';
import { getActiveTeams } from '@/lib/voting';

const form = (o: Record<string, string | Blob>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(o)) f.set(k, v);
  return f;
};
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);

async function cleanup() {
  const { data } = await admin.from('teams').select('id, logo_url').like('slug', 'zz-%');
  for (const t of data ?? []) {
    if (t.logo_url?.includes('/team-logos/')) {
      await admin.storage.from('team-logos').remove([decodeURIComponent(t.logo_url.split('/team-logos/')[1])]);
    }
  }
  await admin.from('teams').delete().like('slug', 'zz-%');
}

beforeEach(async () => {
  await cleanup();
  await resetData();
  jar.value = undefined;
});
afterEach(cleanup);

const newTeam = (o: Record<string, string | Blob> = {}) =>
  form({ name: 'ZZ Team', slug: 'zz-team', accent: '#112233', ...o });

async function teamId(slug: string) {
  const { data } = await admin.from('teams').select('id').eq('slug', slug).single();
  return data!.id as string;
}

describe('team admin actions', () => {
  test('actions reject without session', async () => {
    await expect(createTeamAction(undefined, newTeam())).rejects.toThrow('REDIRECT:/admin/login');
    await expect(updateTeamAction(undefined, form({ id: 'x' }))).rejects.toThrow('REDIRECT:/admin/login');
    await expect(reorderTeamsAction(['x'])).rejects.toThrow('REDIRECT:/admin/login');
    const { data } = await admin.from('teams').select('id').eq('slug', 'zz-team');
    expect(data).toEqual([]);
  });

  test('create team then appears active; deactivate hides', async () => {
    jar.value = signSession(getServerEnv().ADMIN_SESSION_SECRET);
    expect(await createTeamAction(undefined, newTeam())).toEqual({ ok: true });
    expect((await getActiveTeams()).some((t) => t.slug === 'zz-team')).toBe(true);
    const id = await teamId('zz-team');
    const r = await updateTeamAction(
      undefined,
      form({ id, name: 'ZZ Team', slug: 'zz-team', noAccent: 'on', accent: '#000000' }),
    );
    expect(r).toEqual({ ok: true });
    expect((await getActiveTeams()).some((t) => t.slug === 'zz-team')).toBe(false);
    const { data } = await admin.from('teams').select('accent_color, is_active').eq('id', id).single();
    expect(data).toEqual({ accent_color: null, is_active: false });
  });

  test('bad or unknown id gives Team not found', async () => {
    jar.value = signSession(getServerEnv().ADMIN_SESSION_SECRET);
    const base = { name: 'ZZ X', slug: 'zz-x', accent: '#112233' };
    expect(await updateTeamAction(undefined, form({ id: 'nope', ...base }))).toEqual({ error: 'Team not found.' });
    const unknown = '11111111-1111-1111-1111-111111111111';
    expect(await updateTeamAction(undefined, form({ id: unknown, ...base }))).toEqual({ error: 'Team not found.' });
  });

  test('update logo unknown uuid gives Team not found', async () => {
    jar.value = signSession(getServerEnv().ADMIN_SESSION_SECRET);
    const png = new File([PNG], 'l.png', { type: 'image/png' });
    const unknown = '11111111-1111-1111-1111-111111111111';
    const r = await updateTeamAction(
      undefined,
      form({ id: unknown, name: 'ZZ X', slug: 'zz-x', accent: '#112233', logo: png }),
    );
    expect(r).toEqual({ error: 'Team not found.' });
  });

  test('duplicate slug error', async () => {
    jar.value = signSession(getServerEnv().ADMIN_SESSION_SECRET);
    await createTeamAction(undefined, newTeam());
    expect(await createTeamAction(undefined, newTeam({ name: 'Other' }))).toEqual({
      error: 'That slug is already used.',
    });
  });

  test('bad accent rejected', async () => {
    jar.value = signSession(getServerEnv().ADMIN_SESSION_SECRET);
    const r = await createTeamAction(undefined, newTeam({ accent: 'red' }));
    expect(r?.error).toMatch(/colour/i);
    const { data } = await admin.from('teams').select('id').eq('slug', 'zz-team');
    expect(data).toEqual([]);
  });

  test('update logo sets logo_url; bad type rejected and unchanged', async () => {
    jar.value = signSession(getServerEnv().ADMIN_SESSION_SECRET);
    await createTeamAction(undefined, newTeam());
    const id = await teamId('zz-team');
    const base = { id, name: 'ZZ Team', slug: 'zz-team', accent: '#112233' };
    const r = await updateTeamAction(undefined, form({ ...base, logo: new File([PNG], 'l.png', { type: 'image/png' }) }));
    expect(r).toEqual({ ok: true });
    const { data } = await admin.from('teams').select('logo_url').eq('id', id).single();
    expect(data!.logo_url).toMatch(/\/team-logos\/zz-team-\d+\.png$/);
    const before = data!.logo_url;

    const svg = new File(['<svg/>'], 'a.svg', { type: 'image/svg+xml' });
    expect(await updateTeamAction(undefined, form({ ...base, logo: svg }))).toEqual({
      error: 'Use a PNG, JPG or WEBP image.',
    });
    const after = await admin.from('teams').select('logo_url').eq('id', id).single();
    expect(after.data!.logo_url).toBe(before);
  });

  test('create puts team last', async () => {
    jar.value = signSession(getServerEnv().ADMIN_SESSION_SECRET);
    const { data: all } = await admin.from('teams').select('display_order');
    const max = Math.max(0, ...(all ?? []).map((t) => t.display_order));
    expect(await createTeamAction(undefined, newTeam())).toEqual({ ok: true });
    const { data } = await admin.from('teams').select('display_order').eq('slug', 'zz-team').single();
    expect(data!.display_order).toBe(max + 1);
  });

  test('create with logo sets logo_url', async () => {
    jar.value = signSession(getServerEnv().ADMIN_SESSION_SECRET);
    const logo = new Blob([PNG], { type: 'image/png' });
    expect(await createTeamAction(undefined, newTeam({ logo }))).toEqual({ ok: true });
    const { data } = await admin.from('teams').select('logo_url').eq('slug', 'zz-team').single();
    expect(data!.logo_url).toContain('/team-logos/zz-team-');
  });

  test('create with bad logo creates nothing', async () => {
    jar.value = signSession(getServerEnv().ADMIN_SESSION_SECRET);
    const logo = new Blob(['hello'], { type: 'text/plain' });
    const r = await createTeamAction(undefined, newTeam({ logo }));
    expect(r).toEqual({ error: 'Use a PNG, JPG or WEBP image.' });
    const { data } = await admin.from('teams').select('id').eq('slug', 'zz-team');
    expect(data).toEqual([]);
  });

  test('update without logo keeps logo_url', async () => {
    jar.value = signSession(getServerEnv().ADMIN_SESSION_SECRET);
    await createTeamAction(undefined, newTeam({ logo: new Blob([PNG], { type: 'image/png' }) }));
    const id = await teamId('zz-team');
    const { data: before } = await admin.from('teams').select('logo_url').eq('id', id).single();
    expect(before!.logo_url).toBeTruthy();
    const r = await updateTeamAction(
      undefined,
      form({ id, name: 'ZZ Renamed', slug: 'zz-team', accent: '#112233', isActive: 'on' }),
    );
    expect(r).toEqual({ ok: true });
    const { data } = await admin.from('teams').select('logo_url, name').eq('id', id).single();
    expect(data).toEqual({ logo_url: before!.logo_url, name: 'ZZ Renamed' });
  });

  test('update with oversize logo changes nothing', async () => {
    jar.value = signSession(getServerEnv().ADMIN_SESSION_SECRET);
    await createTeamAction(undefined, newTeam());
    const id = await teamId('zz-team');
    const big = new Blob([new Uint8Array(1024 * 1024 + 1)], { type: 'image/png' });
    const r = await updateTeamAction(
      undefined,
      form({ id, name: 'ZZ Changed', slug: 'zz-team', accent: '#112233', isActive: 'on', logo: big }),
    );
    expect(r).toEqual({ error: 'Image must be 1 MB or smaller.' });
    const { data } = await admin.from('teams').select('name').eq('id', id).single();
    expect(data!.name).toBe('ZZ Team');
  });

  test('reorder writes 1..n in given order', async () => {
    jar.value = signSession(getServerEnv().ADMIN_SESSION_SECRET);
    await createTeamAction(undefined, newTeam());
    const { data } = await admin.from('teams').select('id').order('display_order');
    const reversed = data!.map((t) => t.id).reverse();
    expect(await reorderTeamsAction(reversed)).toEqual({ ok: true });
    const { data: after } = await admin.from('teams').select('id, display_order').order('display_order');
    expect(after!.map((t) => t.id)).toEqual(reversed);
    expect(after!.map((t) => t.display_order)).toEqual(reversed.map((_, i) => i + 1));
  });

  test('reorder rejects stale id list', async () => {
    jar.value = signSession(getServerEnv().ADMIN_SESSION_SECRET);
    await createTeamAction(undefined, newTeam());
    const snap = async () => (await admin.from('teams').select('id, display_order').order('id')).data;
    const before = await snap();
    const ids = (await admin.from('teams').select('id').order('display_order')).data!.map((t) => t.id);
    const stale = { error: 'The team list changed. Reload and try again.' };
    expect(await reorderTeamsAction(ids.slice(1))).toEqual(stale);
    expect(await reorderTeamsAction([ids[0], ...ids.slice(0, -1)])).toEqual(stale);
    expect(await snap()).toEqual(before);
  });

  test('reorder rejects non-array and non-guid input without changing order', async () => {
    jar.value = signSession(getServerEnv().ADMIN_SESSION_SECRET);
    await createTeamAction(undefined, newTeam());
    const snap = async () => (await admin.from('teams').select('id, display_order').order('id')).data;
    const before = await snap();
    const bad = { error: 'The team list changed. Reload and try again.' };
    expect(await reorderTeamsAction(null as unknown as string[])).toEqual(bad);
    expect(await reorderTeamsAction(['not-a-guid'])).toEqual(bad);
    expect(await snap()).toEqual(before);
  });

  test('create reports a logo upload failure after the team row exists', async () => {
    jar.value = signSession(getServerEnv().ADMIN_SESSION_SECRET);
    const adminLib = await import('@/lib/admin');
    const spy = vi.spyOn(adminLib, 'setTeamLogo').mockRejectedValue(new Error('storage down'));
    try {
      const logo = new Blob([PNG], { type: 'image/png' });
      expect(await createTeamAction(undefined, newTeam({ logo }))).toEqual({
        error: 'Team created, but the logo upload failed. Edit the team to add it.',
      });
    } finally {
      spy.mockRestore();
    }
    const { data } = await admin.from('teams').select('slug').eq('slug', 'zz-team');
    expect(data).toHaveLength(1);
  });
});
