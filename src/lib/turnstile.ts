import 'server-only';
import { getServerEnv } from '@/lib/env';

const VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

/** Fails closed: empty token, network error, timeout or bad JSON all return false. */
export async function verifyTurnstile(
  token: string,
  ip: string | null,
  fetchImpl: typeof fetch = fetch,
): Promise<boolean> {
  if (!token) return false;
  try {
    const body = new URLSearchParams({
      secret: getServerEnv().TURNSTILE_SECRET_KEY,
      response: token,
    });
    if (ip) body.set('remoteip', ip);
    const res = await fetchImpl(VERIFY_URL, {
      method: 'POST',
      body,
      signal: AbortSignal.timeout(5000),
    });
    const json = (await res.json()) as { success?: unknown };
    return json.success === true;
  } catch {
    return false;
  }
}
