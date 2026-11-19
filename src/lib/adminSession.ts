import { timingSafeEqual } from 'node:crypto';
import { hmacHex, sha256Hex } from '@/lib/crypto';

export const ADMIN_COOKIE = 'dipl_admin';
export const ADMIN_SESSION_SECONDS = 12 * 60 * 60;

function safeEqualText(a: string, b: string): boolean {
  const ba = Buffer.from(a, 'utf8');
  const bb = Buffer.from(b, 'utf8');
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}

/** `v1.<expEpochSeconds>.<hmacHex>`; expires 12h after `now` (ms). */
export function signSession(secret: string, now: number = Date.now()): string {
  const exp = Math.floor(now / 1000) + ADMIN_SESSION_SECONDS;
  return `v1.${exp}.${hmacHex(secret, `v1.${exp}`)}`;
}

export function verifySession(
  secret: string,
  value: string | undefined,
  now: number = Date.now(),
): boolean {
  if (!value) return false;
  const parts = value.split('.');
  if (parts.length !== 3 || parts[0] !== 'v1' || !/^\d+$/.test(parts[1])) return false;
  if (!safeEqualText(parts[2], hmacHex(secret, `v1.${parts[1]}`))) return false;
  return Number(parts[1]) > Math.floor(now / 1000);
}

/** Timing-safe: compares fixed-length SHA-256 digests. */
export function checkPassword(input: string, expected: string): boolean {
  return timingSafeEqual(
    Buffer.from(sha256Hex(input), 'hex'),
    Buffer.from(sha256Hex(expected), 'hex'),
  );
}
