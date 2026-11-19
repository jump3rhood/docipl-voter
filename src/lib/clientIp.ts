/** First x-forwarded-for entry (trimmed), else x-real-ip, else null. */
export function getClientIp(headers: Headers): string | null {
  const xff = headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  if (xff) return xff;
  const real = headers.get('x-real-ip')?.trim();
  return real || null;
}

/**
 * Rate-limit / cap key for an IP. IPv4 is unchanged; IPv4-mapped IPv6 becomes the IPv4;
 * other IPv6 collapses to its /64 (one subscriber usually owns a whole /64).
 * Anything that is not an IP (e.g. 'unknown') is returned unchanged.
 */
export function ipKey(ip: string): string {
  const addr = ip.trim().split('%')[0].toLowerCase();
  if (!addr.includes(':')) return addr;
  const mapped = addr.match(/^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/);
  if (mapped) return mapped[1];
  const halves = addr.split('::');
  if (halves.length > 2) return addr;
  const head = halves[0] ? halves[0].split(':') : [];
  const tail = halves.length === 2 && halves[1] ? halves[1].split(':') : [];
  const missing = 8 - head.length - tail.length;
  if (halves.length === 1 ? missing !== 0 : missing < 1) return addr;
  const groups = [...head, ...Array<string>(halves.length === 2 ? missing : 0).fill('0'), ...tail];
  if (!groups.every((g) => /^[0-9a-f]{1,4}$/.test(g))) return addr;
  return `${groups
    .slice(0, 4)
    .map((g) => parseInt(g, 16).toString(16))
    .join(':')}::/64`;
}
