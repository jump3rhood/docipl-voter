import { test, expect } from 'vitest';
import { randomToken, sha256Hex, hmacHex } from '@/lib/crypto';

test('randomToken is 43 url-safe chars and unique', () => {
  const a = randomToken(), b = randomToken();
  expect(a).toMatch(/^[A-Za-z0-9_-]{43}$/);
  expect(a).not.toBe(b);
});
test('sha256Hex known vector', () => {
  expect(sha256Hex('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
});
test('hmacHex depends on secret', () => {
  expect(hmacHex('k1', 'x')).toMatch(/^[0-9a-f]{64}$/);
  expect(hmacHex('k1', 'x')).not.toBe(hmacHex('k2', 'x'));
  expect(hmacHex('k1', 'x')).toBe(hmacHex('k1', 'x'));
});
