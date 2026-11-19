import { beforeEach, describe, expect, test, vi } from 'vitest';

const store = { get: vi.fn(), set: vi.fn(), delete: vi.fn() };
const rateLimitHit = vi.fn();

vi.mock('next/headers', () => ({
  cookies: async () => store,
  headers: async () => new Headers({ 'x-forwarded-for': '1.2.3.4' }),
}));
vi.mock('next/navigation', () => ({
  redirect: (url: string) => {
    throw new Error(`REDIRECT:${url}`);
  },
}));
vi.mock('@/lib/votes', () => ({ rateLimitHit: (...a: unknown[]) => rateLimitHit(...a) }));
vi.mock('@/lib/env', () => ({
  getServerEnv: () => ({
    HASH_SECRET: 'h'.repeat(40),
    ADMIN_PASSWORD: 'correct-password',
    ADMIN_SESSION_SECRET: 's'.repeat(40),
  }),
}));

import { loginAction } from '@/app/admin/login/actions';
import { POST as logout } from '@/app/admin/logout/route';
import { ADMIN_COOKIE, verifySession } from '@/lib/adminSession';

const form = (password: string) => {
  const f = new FormData();
  f.set('password', password);
  return f;
};

beforeEach(() => {
  vi.clearAllMocks();
  rateLimitHit.mockResolvedValue(true);
});

describe('loginAction', () => {
  test('rate limited: error, no cookie, even with the right password', async () => {
    rateLimitHit.mockResolvedValue(false);
    const r = await loginAction(undefined, form('correct-password'));
    expect(r).toEqual({ error: 'Too many attempts. Try again later.' });
    expect(rateLimitHit).toHaveBeenCalledWith('adminLogin', expect.any(String));
    expect(store.set).not.toHaveBeenCalled();
  });

  test('wrong password: error, no cookie', async () => {
    const r = await loginAction(undefined, form('nope'));
    expect(r).toEqual({ error: 'Wrong password.' });
    expect(store.set).not.toHaveBeenCalled();
  });

  test('correct password sets session cookie and redirects', async () => {
    await expect(loginAction(undefined, form('correct-password'))).rejects.toThrow(
      'REDIRECT:/admin',
    );
    expect(store.set).toHaveBeenCalledTimes(1);
    const [name, value, opts] = store.set.mock.calls[0];
    expect(name).toBe(ADMIN_COOKIE);
    expect(verifySession('s'.repeat(40), value)).toBe(true);
    expect(opts).toMatchObject({ httpOnly: true, sameSite: 'strict', path: '/', maxAge: 43200 });
  });
});

describe('logout route', () => {
  test('deletes cookie and 303s to login', async () => {
    const res = await logout(new Request('http://localhost:3000/admin/logout', { method: 'POST' }));
    expect(store.delete).toHaveBeenCalledWith(ADMIN_COOKIE);
    expect(res.status).toBe(303);
    expect(res.headers.get('location')).toBe('http://localhost:3000/admin/login');
  });

  test('cross-origin POST does not delete the cookie', async () => {
    const res = await logout(
      new Request('http://localhost:3000/admin/logout', {
        method: 'POST',
        headers: { origin: 'https://evil.example' },
      }),
    );
    expect(store.delete).not.toHaveBeenCalled();
    expect(res.status).toBe(303);
  });
});
