import { describe, expect, test } from 'vitest';
import { parseServerEnv } from '@/lib/env';

const valid = {
  NEXT_PUBLIC_SITE_URL: 'http://localhost:3000',
  SUPABASE_URL: 'https://abc.supabase.co',
  SUPABASE_SERVICE_ROLE_KEY: 'service-role-key',
  NEXT_PUBLIC_TURNSTILE_SITE_KEY: '1x00000000000000000000AA',
  TURNSTILE_SECRET_KEY: '1x0000000000000000000000000000000AA',
  HASH_SECRET: 'h'.repeat(32),
  ADMIN_PASSWORD: 'password123',
  ADMIN_SESSION_SECRET: 's'.repeat(32),
};

describe('parseServerEnv', () => {
  test('parses valid env with default rate limits', () => {
    const env = parseServerEnv(valid);
    expect(env.rateLimits.vote).toEqual({ max: 30, windowSeconds: 600 });
    expect(env.rateLimits.mint).toEqual({ max: 60, windowSeconds: 600 });
    expect(env.rateLimits.status).toEqual({ max: 120, windowSeconds: 60 });
    expect(env.rateLimits.adminLogin).toEqual({ max: 10, windowSeconds: 900 });
    expect(env.SITE_URL).toBe('http://localhost:3000');
  });
  test('custom rate limit', () => {
    expect(parseServerEnv({ ...valid, RATE_LIMIT_VOTE: '5/60' }).rateLimits.vote)
      .toEqual({ max: 5, windowSeconds: 60 });
  });
  test('empty rate limit string uses default', () => {
    expect(parseServerEnv({ ...valid, RATE_LIMIT_VOTE: '' }).rateLimits.vote)
      .toEqual({ max: 30, windowSeconds: 600 });
  });
  test('rejects malformed rate limit', () => {
    expect(() => parseServerEnv({ ...valid, RATE_LIMIT_VOTE: 'lots' })).toThrow(/RATE_LIMIT_VOTE/);
  });
  test('rejects rate limit window over one hour', () => {
    expect(() => parseServerEnv({ ...valid, RATE_LIMIT_VOTE: '5/7200' })).toThrow(/RATE_LIMIT_VOTE/);
    expect(parseServerEnv({ ...valid, RATE_LIMIT_VOTE: '5/3600' }).rateLimits.vote.windowSeconds).toBe(3600);
  });
  test('lists all missing vars', () => {
    expect(() => parseServerEnv({})).toThrow(/SUPABASE_URL[\s\S]*HASH_SECRET/);
  });
  test('short HASH_SECRET rejected', () => {
    expect(() => parseServerEnv({ ...valid, HASH_SECRET: 'short' })).toThrow(/HASH_SECRET/);
  });
  describe('Turnstile test keys on Vercel production', () => {
    const real = {
      ...valid,
      ADMIN_PASSWORD: 'a-long-production-password-0123456789',
      NEXT_PUBLIC_TURNSTILE_SITE_KEY: '0x4AAAAAAAreal-site-key',
      TURNSTILE_SECRET_KEY: '0x4AAAAAAAreal-secret-key',
    };
    test('real keys accepted in production', () => {
      expect(parseServerEnv({ ...real, VERCEL_ENV: 'production' }).TURNSTILE_SITE_KEY)
        .toBe('0x4AAAAAAAreal-site-key');
    });
    test.each(['1x0000000000000000000000000000000AA', '2x0000000000000000000000000000000AA', '3x0000000000000000000000000000000AA'])(
      'test secret %s rejected in production',
      (key) => {
        expect(() => parseServerEnv({ ...real, TURNSTILE_SECRET_KEY: key, VERCEL_ENV: 'production' }))
          .toThrow(/TURNSTILE_SECRET_KEY/);
      },
    );
    test.each(['1x00000000000000000000AA', '2x00000000000000000000AB', '3x00000000000000000000FF'])(
      'test site key %s rejected in production',
      (key) => {
        expect(() => parseServerEnv({ ...real, NEXT_PUBLIC_TURNSTILE_SITE_KEY: key, VERCEL_ENV: 'production' }))
          .toThrow(/NEXT_PUBLIC_TURNSTILE_SITE_KEY/);
      },
    );
    test('ADMIN_PASSWORD needs 8+ characters, in production too', () => {
      expect(() => parseServerEnv({ ...real, ADMIN_PASSWORD: 'x'.repeat(7), VERCEL_ENV: 'production' }))
        .toThrow(/ADMIN_PASSWORD/);
      expect(() => parseServerEnv({ ...real, ADMIN_PASSWORD: 'x'.repeat(8), VERCEL_ENV: 'production' }))
        .not.toThrow();
      expect(() => parseServerEnv({ ...valid, VERCEL_ENV: 'preview' })).not.toThrow();
    });
    test('test keys allowed in preview and locally', () => {
      expect(() => parseServerEnv({ ...valid, VERCEL_ENV: 'preview' })).not.toThrow();
      expect(() => parseServerEnv(valid)).not.toThrow();
    });
  });
});
