import { beforeEach, describe, expect, test } from 'vitest';
import { resetData } from './helpers';
import { rateLimitHit } from '@/lib/votes';
import { hashId } from '@/lib/identity';

beforeEach(resetData);

describe('admin login rate limit', () => {
  test('adminLogin bucket respects RATE_LIMIT_ADMIN_LOGIN (3/900)', async () => {
    const key = hashId('admin-rl-ip');
    for (let i = 0; i < 3; i++) expect(await rateLimitHit('adminLogin', key)).toBe(true);
    expect(await rateLimitHit('adminLogin', key)).toBe(false);
  });
});
