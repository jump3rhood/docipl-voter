import { expect, test } from 'vitest';
import { VOTER_COOKIE, voterCookieOptions } from '@/lib/voterCookie';

const now = new Date('2026-11-21T15:30:00Z');

test('cookie name', () => expect(VOTER_COOKIE).toBe('dipl_vid'));
test('lasts until voting_end + 7 days', () => {
  const end = new Date('2026-11-22T15:30:00Z');
  expect(voterCookieOptions(end, now, true)).toEqual({
    httpOnly: true, sameSite: 'lax', path: '/', secure: true, maxAge: 8 * 86400,
  });
});
test('floors at 1 day and is not secure outside production', () => {
  const o = voterCookieOptions(new Date('2026-01-01T00:00:00Z'), now, false);
  expect(o.maxAge).toBe(86400);
  expect(o.secure).toBe(false);
});
