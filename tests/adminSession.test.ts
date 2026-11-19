import { describe, expect, test } from 'vitest';
import { ADMIN_COOKIE, checkPassword, signSession, verifySession } from '@/lib/adminSession';

const SECRET = 'test-session-secret-test-session-0123';
const NOW = 1_700_000_000_000;

describe('adminSession', () => {
  test('cookie name', () => expect(ADMIN_COOKIE).toBe('dipl_admin'));

  test('round trip', () => {
    const v = signSession(SECRET, NOW);
    expect(v).toMatch(/^v1\.\d+\.[0-9a-f]{64}$/);
    expect(verifySession(SECRET, v, NOW + 1000)).toBe(true);
  });

  test('tampered hmac is rejected', () => {
    const v = signSession(SECRET, NOW);
    const bad = v.slice(0, -1) + (v.endsWith('0') ? '1' : '0');
    expect(verifySession(SECRET, bad, NOW)).toBe(false);
  });

  test('tampered expiry is rejected', () => {
    const [p, exp, mac] = signSession(SECRET, NOW).split('.');
    expect(verifySession(SECRET, `${p}.${Number(exp) + 100000}.${mac}`, NOW)).toBe(false);
  });

  test('expired after 13h', () => {
    const v = signSession(SECRET, NOW);
    expect(verifySession(SECRET, v, NOW + 13 * 3600 * 1000)).toBe(false);
  });

  test('malformed values', () => {
    for (const v of ['', 'v1.x', 'v2.1.aa', undefined, 'v1.1.2.3']) {
      expect(verifySession(SECRET, v, NOW)).toBe(false);
    }
  });

  test('different secret', () => {
    const v = signSession(SECRET, NOW);
    expect(verifySession('another-secret-another-secret-012345', v, NOW)).toBe(false);
  });

  test('checkPassword', () => {
    expect(checkPassword('hunter2hunter2', 'hunter2hunter2')).toBe(true);
    expect(checkPassword('wrong', 'hunter2hunter2')).toBe(false);
    expect(checkPassword('', 'hunter2hunter2')).toBe(false);
    expect(checkPassword('hunter2hunter2-longer', 'hunter2hunter2')).toBe(false);
  });
});
