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

import { createTeamAction, updateTeamAction, uploadLogoAction } from '@/app/admin/(protected)/teams/actions';
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

const newTeam = (o: Record<string, string> = {}) =>
  form({ name: 'ZZ Team', slug: 'zz-team', accent: '#112233', displayOrder: '99', ...o });

async function teamId(slug: string) {
  const { data } = await admin.from('teams').select('id').eq('slug', slug).single();
  return data!.id as string;
}

describe('team admin actions', () => {
  test('actions reject without session', async () => {
    await expect(createTeamAction(undefined, newTeam())).rejects.toThrow('REDIRECT:/admin/login');
    await expect(updateTeamAction(undefined, form({ id: 'x' }))).rejects.toThrow('REDIRECT:/admin/login');
    await expect(uploadLogoAction(undefined, form({ id: 'x' }))).rejects.toThrow('REDIRECT:/admin/login');
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
      form({ id, name: 'ZZ Team', slug: 'zz-team', noAccent: 'on', accent: '#000000', displayOrder: '99' }),
    );
    expect(r).toEqual({ ok: true });
    expect((await getActiveTeams()).some((t) => t.slug === 'zz-team')).toBe(false);
    const { data } = await admin.from('teams').select('accent_color, is_active').eq('id', id).single();
    expect(data).toEqual({ accent_color: null, is_active: false });
  });

  test('bad or unknown id gives Team not found', async () => {
    jar.value = signSession(getServerEnv().ADMIN_SESSION_SECRET);
    const base = { name: 'ZZ X', slug: 'zz-x', accent: '#112233', displayOrder: '1' };
    const png = new File([PNG], 'l.png', { type: 'image/png' });
    expect(await updateTeamAction(undefined, form({ id: 'nope', ...base }))).toEqual({ error: 'Team not found.' });
    expect(await uploadLogoAction(undefined, form({ id: 'nope', logo: png }))).toEqual({ error: 'Team not found.' });
    const unknown = '11111111-1111-1111-1111-111111111111';
    expect(await updateTeamAction(undefined, form({ id: unknown, ...base }))).toEqual({ error: 'Team not found.' });
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

  test('upload logo sets logo_url; oversize rejected and unchanged', async () => {
    jar.value = signSession(getServerEnv().ADMIN_SESSION_SECRET);
    await createTeamAction(undefined, newTeam());
    const id = await teamId('zz-team');
    const r = await uploadLogoAction(undefined, form({ id, logo: new File([PNG], 'l.png', { type: 'image/png' }) }));
    expect(r).toEqual({ ok: true });
    const { data } = await admin.from('teams').select('logo_url').eq('id', id).single();
    expect(data!.logo_url).toMatch(/\/team-logos\/zz-team-\d+\.png$/);
    const before = data!.logo_url;

    const big = new File([new Uint8Array(1024 * 1024 + 1)], 'big.png', { type: 'image/png' });
    expect(await uploadLogoAction(undefined, form({ id, logo: big }))).toEqual({
      error: 'Image must be 1 MB or smaller.',
    });
    const svg = new File(['<svg/>'], 'a.svg', { type: 'image/svg+xml' });
    expect(await uploadLogoAction(undefined, form({ id, logo: svg }))).toEqual({
      error: 'Use a PNG, JPG or WEBP image.',
    });
    const after = await admin.from('teams').select('logo_url').eq('id', id).single();
    expect(after.data!.logo_url).toBe(before);
  });
});
