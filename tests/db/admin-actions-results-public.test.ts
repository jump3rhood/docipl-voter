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

import { toggleResultsPublicAction } from '@/app/admin/(protected)/results/actions';
import { getAdminConfig } from '@/lib/admin';
import { signSession } from '@/lib/adminSession';
import { getServerEnv } from '@/lib/env';
import { getVotingStatus } from '@/lib/voting';

const form = (o: Record<string, string>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(o)) f.set(k, v);
  return f;
};

beforeEach(async () => {
  await resetData();
  jar.value = undefined;
});

describe('results visibility action', () => {
  test('results are hidden by default', async () => {
    expect((await getAdminConfig()).resultsPublic).toBe(false);
    expect((await getVotingStatus()).resultsPublic).toBe(false);
  });

  test('rejects without session', async () => {
    await expect(toggleResultsPublicAction(form({ resultsPublic: 'true' }))).rejects.toThrow(
      'REDIRECT:/admin/login',
    );
    expect((await getAdminConfig()).resultsPublic).toBe(false);
  });

  test('admin can show and hide results; bad input is ignored', async () => {
    jar.value = signSession(getServerEnv().ADMIN_SESSION_SECRET);
    await toggleResultsPublicAction(form({ resultsPublic: 'true' }));
    expect((await getVotingStatus()).resultsPublic).toBe(true);
    await toggleResultsPublicAction(form({ resultsPublic: 'maybe' }));
    expect((await getVotingStatus()).resultsPublic).toBe(true);
    await toggleResultsPublicAction(form({ resultsPublic: 'false' }));
    expect((await getVotingStatus()).resultsPublic).toBe(false);
  });
});
