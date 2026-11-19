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
});
