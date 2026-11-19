import { createHash, createHmac, randomBytes } from 'node:crypto';

/** Random URL-safe token (base64url, no padding). 32 bytes => 43 chars. */
export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString('base64url');
}

/** SHA-256 of the UTF-8 input, lowercase hex. */
export function sha256Hex(input: string): string {
  return createHash('sha256').update(input, 'utf8').digest('hex');
}

/** HMAC-SHA256 of the UTF-8 input keyed by `secret`, lowercase hex. */
export function hmacHex(secret: string, input: string): string {
  return createHmac('sha256', secret).update(input, 'utf8').digest('hex');
}
