import { afterEach, describe, expect, test, vi } from 'vitest';

vi.mock('@/lib/env', () => ({ getServerEnv: () => ({ TURNSTILE_SECRET_KEY: 'sekret', SITE_URL: 'https://docipl.vercel.app' }) }));

import { verifyTurnstile } from '@/lib/turnstile';

const reply = (body: unknown) =>
  vi.fn(async () => new Response(JSON.stringify(body))) as unknown as typeof fetch;
const call = (f: typeof fetch) =>
  (f as unknown as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit];

describe('verifyTurnstile', () => {
  test('empty token -> false without fetch', async () => {
    const f = vi.fn() as unknown as typeof fetch;
    expect(await verifyTurnstile('', '1.1.1.1', f)).toBe(false);
    expect(f).not.toHaveBeenCalled();
  });
  test('success true -> true; posts form-encoded secret, response, remoteip', async () => {
    const f = reply({ success: true });
    expect(await verifyTurnstile('tok', '1.1.1.1', f)).toBe(true);
    const [url, init] = call(f);
    expect(url).toBe('https://challenges.cloudflare.com/turnstile/v0/siteverify');
    expect(init.method).toBe('POST');
    const body = init.body as URLSearchParams;
    expect(body).toBeInstanceOf(URLSearchParams);
    expect(body.get('secret')).toBe('sekret');
    expect(body.get('response')).toBe('tok');
    expect(body.get('remoteip')).toBe('1.1.1.1');
  });
  test('omits remoteip when ip is null', async () => {
    const f = reply({ success: true });
    await verifyTurnstile('tok', null, f);
    expect((call(f)[1].body as URLSearchParams).has('remoteip')).toBe(false);
  });
  test('success false -> false', async () => {
    expect(await verifyTurnstile('tok', null, reply({ success: false }))).toBe(false);
  });
  test('truthy non-true success -> false', async () => {
    expect(await verifyTurnstile('tok', null, reply({ success: 'true' }))).toBe(false);
  });
  test('fetch throws -> false', async () => {
    const f = vi.fn(async () => {
      throw new Error('boom');
    }) as unknown as typeof fetch;
    expect(await verifyTurnstile('tok', null, f)).toBe(false);
  });
  describe('hostname check', () => {
    test('production: matching hostname -> true', async () => {
      const f = reply({ success: true, hostname: 'docipl.vercel.app' });
      expect(await verifyTurnstile('tok', null, f, { production: true })).toBe(true);
    });
    test('production: other hostname -> false', async () => {
      const f = reply({ success: true, hostname: 'example.com' });
      expect(await verifyTurnstile('tok', null, f, { production: true })).toBe(false);
    });
    test('production: missing hostname -> false', async () => {
      expect(await verifyTurnstile('tok', null, reply({ success: true }), { production: true })).toBe(false);
    });
    afterEach(() => vi.unstubAllEnvs());
    test('default: enforced when VERCEL_ENV=production', async () => {
      vi.stubEnv('VERCEL_ENV', 'production');
      expect(await verifyTurnstile('tok', null, reply({ success: true, hostname: 'example.com' }))).toBe(false);
      expect(await verifyTurnstile('tok', null, reply({ success: true, hostname: 'docipl.vercel.app' }))).toBe(true);
    });
    test('default: skipped on previews even with NODE_ENV=production', async () => {
      vi.stubEnv('VERCEL_ENV', 'preview');
      vi.stubEnv('NODE_ENV', 'production');
      expect(await verifyTurnstile('tok', null, reply({ success: true, hostname: 'example.com' }))).toBe(true);
    });
    test('non-production: dummy hostname accepted', async () => {
      const f = reply({ success: true, hostname: 'example.com' });
      expect(await verifyTurnstile('tok', null, f, { production: false })).toBe(true);
    });
  });
});
