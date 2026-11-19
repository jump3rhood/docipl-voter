import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { getClientIp, ipKey } from '@/lib/clientIp';
import { randomToken } from '@/lib/crypto';
import { getServerEnv } from '@/lib/env';
import { hashId, hashToken } from '@/lib/identity';
import { verifyTurnstile } from '@/lib/turnstile';
import type { VoteErrorCode } from '@/lib/voteMessages';
import { VOTER_COOKIE, voterCookieOptions } from '@/lib/voterCookie';
import { getVotingStatus } from '@/lib/voting';
import { castVote, rateLimitHit, type CastStatus } from '@/lib/votes';

const MAX_BODY_CHARS = 8192;
const DAY_MS = 86_400_000;
const DEVICE_SIGNAL = /^[0-9a-f]{64}$/;

const BodySchema = z.object({
  token: z.string().min(20).max(200),
  teamId: z.guid(),
  turnstileToken: z.string().max(4096),
  // Only a SHA-256 hex digest (what collectDeviceSignal sends) counts; anything else is
  // treated as "no signal" (the shared 'none' bucket) rather than rejecting the vote.
  deviceSignal: z
    .unknown()
    .transform((v) => (typeof v === 'string' && DEVICE_SIGNAL.test(v) ? v : null)),
});

const ERROR_STATUS: Record<Exclude<CastStatus, 'ok'>, { status: number; code: VoteErrorCode }> = {
  voting_not_open: { status: 403, code: 'voting_not_open' },
  voting_closed: { status: 403, code: 'voting_closed' },
  token_invalid: { status: 410, code: 'token_invalid' },
  token_used: { status: 409, code: 'already_voted' },
  already_voted: { status: 409, code: 'already_voted' },
  invalid_team: { status: 422, code: 'invalid_team' },
};

function json(body: unknown, status: number): NextResponse {
  return NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
}

function fail(status: number, code: VoteErrorCode): NextResponse {
  return json({ ok: false, code }, status);
}

/** A malformed body maps to invalid_team only when teamId is the sole bad field. */
async function parseBody(
  req: NextRequest,
): Promise<{ ok: true; data: z.infer<typeof BodySchema> } | { ok: false; code: VoteErrorCode }> {
  const text = await req.text();
  if (text.length > MAX_BODY_CHARS) return { ok: false, code: 'token_invalid' };
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, code: 'token_invalid' };
  }
  const parsed = BodySchema.safeParse(raw);
  if (parsed.success) return { ok: true, data: parsed.data };
  const onlyTeam = parsed.error.issues.every((i) => i.path.length === 1 && i.path[0] === 'teamId');
  return { ok: false, code: onlyTeam ? 'invalid_team' : 'token_invalid' };
}

/** Voting end for the cookie lifetime; a lookup failure must not fail a recorded vote. */
async function cookieEnd(): Promise<Date> {
  try {
    return (await getVotingStatus()).end;
  } catch {
    // voterCookieOptions enforces a 1-day minimum, so "7 days ago" yields a 1-day cookie.
    return new Date(Date.now() - 7 * DAY_MS);
  }
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    if (!req.headers.get('content-type')?.toLowerCase().startsWith('application/json')) {
      console.warn('[vote] rejected: content-type');
      return fail(415, 'token_invalid');
    }
    // Production pins the canonical site; previews and local runs use their own host.
    const origin = req.headers.get('origin');
    const expectedOrigin =
      process.env.VERCEL_ENV === 'production'
        ? new URL(getServerEnv().SITE_URL).origin
        : req.nextUrl.origin;
    if (origin !== null && origin !== expectedOrigin) {
      console.warn('[vote] rejected: origin');
      return fail(403, 'token_invalid');
    }
    const declaredLength = Number(req.headers.get('content-length'));
    if (declaredLength > MAX_BODY_CHARS) return fail(400, 'token_invalid');

    const body = await parseBody(req);
    if (!body.ok) return fail(400, body.code);
    const { token, teamId, turnstileToken, deviceSignal } = body.data;

    const ip = getClientIp(req.headers);
    if (!ip) console.warn('[vote] no client IP header');
    const ipHash = hashId(ipKey(ip ?? 'unknown'));
    if (!(await rateLimitHit('vote', ipHash))) return fail(429, 'rate_limited');

    if (!(await verifyTurnstile(turnstileToken, ip))) return fail(403, 'turnstile_failed');

    const cookie = req.cookies.get(VOTER_COOKIE)?.value ?? randomToken();
    const ua = req.headers.get('user-agent');
    const { status, teamName } = await castVote({
      tokenHash: hashToken(token),
      teamId,
      browserHash: hashId(cookie),
      deviceHash: deviceSignal ? hashId(deviceSignal) : null,
      ipHash,
      uaHash: ua ? hashId(ua) : null,
    });

    let res: NextResponse;
    if (status === 'ok') {
      if (teamName === null) {
        console.error('[vote] cast_vote ok without a team name');
        return fail(500, 'network');
      }
      res = json({ ok: true, teamName }, 200);
    } else {
      const mapped = ERROR_STATUS[status];
      res = fail(mapped.status, mapped.code);
    }

    if (res.status === 200 || res.status === 409 || res.status === 410) {
      res.cookies.set(VOTER_COOKIE, cookie, voterCookieOptions(await cookieEnd()));
    }
    return res;
  } catch (err) {
    console.error('[vote] unexpected error:', err instanceof Error ? err.message : 'unknown');
    return fail(500, 'network');
  }
}
