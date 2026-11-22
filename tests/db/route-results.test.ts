import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const failure = vi.hoisted(() => ({ on: false }));
const auth = vi.hoisted(() => ({ admin: true }));

vi.mock('@/lib/adminAuth', () => ({ isAdmin: vi.fn(async () => auth.admin) }));

vi.mock('next/server', async (importActual) => ({
  ...(await importActual<typeof import('next/server')>()),
  connection: vi.fn(async () => {}),
}));

vi.mock('@/lib/results', async (importActual) => {
  const actual = await importActual<typeof import('@/lib/results')>();
  return {
    ...actual,
    getResults: vi.fn(async () => {
      if (failure.on) throw new Error('boom');
      return actual.getResults();
    }),
  };
});

import { GET } from '@/app/api/results/route';
import { admin, resetData } from './helpers';

beforeEach(async () => {
  failure.on = false;
  auth.admin = true;
  await resetData();
});
afterEach(() => vi.restoreAllMocks());

describe('GET /api/results', () => {
  test('401 and no results for non-admins', async () => {
    auth.admin = false;
    const res = await GET();
    expect(res.status).toBe(401);
    expect(res.headers.get('cache-control')).toBe('private, no-store');
    expect(await res.json()).toEqual({ error: 'unauthorized' });
  });

  test('200 with payload for admins, never CDN-cached', async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toBe('private, no-store');
    const body = await res.json();
    expect(Object.keys(body).sort()).toEqual(['rows', 'total']);
    expect(body.total).toBe(0);
    expect(body.rows).toHaveLength(11);
  });

  test('rows expose only ResultRow keys', async () => {
    const body = await (await GET()).json();
    expect(body.rows.length).toBeGreaterThan(0);
    for (const row of body.rows) {
      expect(Object.keys(row).sort()).toEqual(
        ['accentColor', 'logoUrl', 'name', 'percent', 'rank', 'slug', 'teamId', 'votes'].sort(),
      );
    }
  });

  test('public results: anyone gets them, CDN-cacheable', async () => {
    auth.admin = false;
    await admin.from('voting_config').update({ results_public: true }).eq('id', 1);
    const res = await GET();
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toBe('public, s-maxage=10, stale-while-revalidate=5');
    expect((await res.json()).rows).toHaveLength(11);
  });

  test('500 on failure', async () => {
    failure.on = true;
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const res = await GET();
    expect(res.status).toBe(500);
    expect(res.headers.get('cache-control')).toBe('private, no-store');
    expect(await res.json()).toEqual({ error: 'unavailable' });
    expect(spy).toHaveBeenCalledWith('[results] unavailable', 'boom');
  });
});
