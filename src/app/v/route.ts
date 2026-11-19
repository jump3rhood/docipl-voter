import { NextResponse, type NextRequest } from 'next/server';
import { getClientIp } from '@/lib/clientIp';
import { randomToken } from '@/lib/crypto';
import { hashId, hashToken } from '@/lib/identity';
import { VOTER_COOKIE, voterCookieOptions } from '@/lib/voterCookie';
import { getVotingStatus } from '@/lib/voting';
import { getVoterVote, mintToken, rateLimitHit } from '@/lib/votes';

export async function GET(req: NextRequest): Promise<NextResponse> {
  const redirect = (path: string, cookie?: string, end?: Date): NextResponse => {
    const res = NextResponse.redirect(new URL(path, req.url), 303);
    if (cookie && end) res.cookies.set(VOTER_COOKIE, cookie, voterCookieOptions(end));
    return res;
  };

  const ip = getClientIp(req.headers);
  if (!ip) console.warn('[vote] no client IP header');
  const ipHash = hashId(ip ?? 'unknown');
  if (!(await rateLimitHit('mint', ipHash))) return redirect('/slow-down');

  const { state, end } = await getVotingStatus();
  let cookie = req.cookies.get(VOTER_COOKIE)?.value;
  if (state !== 'open') return redirect('/', cookie, end);

  if (cookie && (await getVoterVote(hashId(cookie))) !== null) {
    return redirect('/thanks', cookie, end);
  }

  cookie ??= randomToken();
  const token = randomToken();
  if ((await mintToken(hashToken(token), ipHash)) !== 'ok') return redirect('/', cookie, end);
  return redirect(`/vote/${token}`, cookie, end);
}
