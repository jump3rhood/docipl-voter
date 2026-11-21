import { NextResponse, type NextRequest } from 'next/server';
import { getClientIp, ipKey } from '@/lib/clientIp';
import { getServerEnv } from '@/lib/env';
import { hashId } from '@/lib/identity';
import { VOTER_COOKIE, voterCookieOptions } from '@/lib/voterCookie';
import { VOTER_ID_FORMAT } from '@/lib/voterIdSync';
import { getVotingStatus } from '@/lib/voting';
import { getVoterVote, rateLimitHit } from '@/lib/votes';

const MAX_BODY_CHARS = 512;

function json(body: unknown, status: number): NextResponse {
  return NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
}

/**
 * Restores the voter cookie from the browser's localStorage backup. The ID is random and
 * already in the caller's hands, so accepting it grants nothing that clearing cookies doesn't.
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    if (!req.headers.get('content-type')?.toLowerCase().startsWith('application/json')) {
      return json({ ok: false }, 415);
    }
    const origin = req.headers.get('origin');
    const expectedOrigin =
      process.env.VERCEL_ENV === 'production'
        ? new URL(getServerEnv().SITE_URL).origin
        : req.nextUrl.origin;
    if (origin !== null && origin !== expectedOrigin) return json({ ok: false }, 403);

    const text = await req.text();
    if (text.length > MAX_BODY_CHARS) return json({ ok: false }, 400);
    let id: unknown;
    try {
      id = (JSON.parse(text) as { id?: unknown })?.id;
    } catch {
      return json({ ok: false }, 400);
    }
    if (typeof id !== 'string' || !VOTER_ID_FORMAT.test(id)) return json({ ok: false }, 400);

    const ip = getClientIp(req.headers);
    if (!(await rateLimitHit('status', hashId(ipKey(ip ?? 'unknown'))))) {
      return json({ ok: false }, 429);
    }

    const [vote, { end }] = await Promise.all([getVoterVote(hashId(id)), getVotingStatus()]);
    const res = json({ ok: true, voted: vote !== null }, 200);
    res.cookies.set(VOTER_COOKIE, id, voterCookieOptions(end));
    return res;
  } catch (err) {
    console.error('[voter] restore failed', err instanceof Error ? err.message : 'unknown');
    return json({ ok: false }, 500);
  }
}
