import 'server-only';
import { getServerEnv } from '@/lib/env';
import { hmacHex, sha256Hex } from '@/lib/crypto';

export function hashId(value: string): string {
  return hmacHex(getServerEnv().HASH_SECRET, value);
}

export function hashToken(token: string): string {
  return sha256Hex(token);
}
