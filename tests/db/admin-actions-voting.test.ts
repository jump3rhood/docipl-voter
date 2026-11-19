import { beforeEach, describe, expect, test, vi } from 'vitest';
import { resetData } from './helpers';

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

import { saveVotingAction, toggleVotingAction } from '@/app/admin/(protected)/voting/actions';
import { getAdminConfig } from '@/lib/admin';
import { signSession } from '@/lib/adminSession';
import { getServerEnv } from '@/lib/env';

const form = (o: Record<string, string>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(o)) f.set(k, v);
  return f;
};

beforeEach(async () => {
  await resetData();
  jar.value = undefined;
});

describe('voting admin actions', () => {
  test('actions reject without session', async () => {
    const before = await getAdminConfig();
    await expect(
      saveVotingAction(undefined, form({ start: '2026-11-21T09:00', end: '2026-11-22T21:00', maxVotes: '5' })),
    ).rejects.toThrow('REDIRECT:/admin/login');
    await expect(toggleVotingAction(form({}))).rejects.toThrow('REDIRECT:/admin/login');
    expect(await getAdminConfig()).toEqual(before);
  });

  test('saveVotingAction persists, end before start errors, toggle flips enabled', async () => {
    jar.value = signSession(getServerEnv().ADMIN_SESSION_SECRET);
    const r = await saveVotingAction(
      undefined,
      form({ start: '2026-11-21T09:00', end: '2026-11-22T21:00', enabled: 'on', maxVotes: '7' }),
    );
    expect(r).toEqual({ ok: true });
    const c = await getAdminConfig();
    expect(c.start.toISOString()).toBe('2026-11-21T03:30:00.000Z');
    expect(c.end.toISOString()).toBe('2026-11-22T15:30:00.000Z');
    expect(c.enabled).toBe(true);
    expect(c.maxVotesPerDeviceIp).toBe(7);

    const bad = await saveVotingAction(
      undefined,
      form({ start: '2026-11-22T09:00', end: '2026-11-21T09:00', maxVotes: '7' }),
    );
    expect(bad).toEqual({ error: 'End must be after start.' });
    expect((await getAdminConfig()).start.toISOString()).toBe('2026-11-21T03:30:00.000Z');

    await toggleVotingAction(form({}));
    const t = await getAdminConfig();
    expect(t.enabled).toBe(false);
    expect(t.maxVotesPerDeviceIp).toBe(7);
  });
});
