import 'server-only';
import { getServerEnv } from '@/lib/env';

const VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

/**
 * Fails closed: empty token, network error, timeout or bad JSON all return false.
 * In production the token must also have been issued for SITE_URL's hostname
 * (Cloudflare test keys return a dummy hostname, so the check is skipped elsewhere).
 */
export async function verifyTurnstile(
  token: string,
  ip: string | null,
  fetchImpl: typeof fetch = fetch,
  opts: { production?: boolean } = {},
): Promise<boolean> {
  const production = opts.production ?? process.env.NODE_ENV === 'production';
  if (!token) return false;
  try {
    const env = getServerEnv();
    const body = new URLSearchParams({
      secret: env.TURNSTILE_SECRET_KEY,
      response: token,
    });
    if (ip) body.set('remoteip', ip);
    const res = await fetchImpl(VERIFY_URL, {
      method: 'POST',
      body,
      signal: AbortSignal.timeout(5000),
    });
    const json = (await res.json()) as { success?: unknown; hostname?: unknown };
    if (json.success !== true) return false;
    return !production || json.hostname === new URL(env.SITE_URL).hostname;
  } catch {
    return false;
  }
}
