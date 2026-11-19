import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, test } from 'vitest';
import { GET } from '@/app/v/route';
import { hashId, hashToken } from '@/lib/identity';
import { castVote, getTokenState, mintToken } from '@/lib/votes';
import { randomToken } from '@/lib/crypto';
import { admin, openWindow, resetData, teamId } from './helpers';

let counter = 0;
function fakeIp(): string {
  counter += 1;
  return `10.1.${Math.floor(counter / 250)}.${(counter % 250) + 1}`;
}

function req(opts: { cookie?: string; ip?: string } = {}): NextRequest {
  const headers: Record<string, string> = { 'x-forwarded-for': opts.ip ?? fakeIp() };
  if (opts.cookie) headers.cookie = `dipl_vid=${opts.cookie}`;
  return new NextRequest('http://localhost:3000/v', { headers });
}

async function tokenCount(): Promise<number> {
  const { count, error } = await admin
    .from('voting_tokens')
    .select('*', { count: 'exact', head: true });
  if (error) throw new Error(error.message);
  return count ?? 0;
}

beforeEach(resetData);

describe('GET /v', () => {
  test('closed -> / and no token', async () => {
    const res = await GET(req());
    expect(res.status).toBe(303);
    expect(new URL(res.headers.get('location')!).pathname).toBe('/');
    expect(await tokenCount()).toBe(0);
  });

  test('open, no cookie -> /vote/<token>, sets cookie, token active', async () => {
    await openWindow();
    const res = await GET(req());
    expect(res.status).toBe(303);
    const loc = res.headers.get('location')!;
    expect(loc).toMatch(/\/vote\/[A-Za-z0-9_-]{43}$/);
    const setCookie = res.headers.get('set-cookie')!;
    expect(setCookie).toContain('dipl_vid=');
    expect(setCookie).toContain('HttpOnly');
    expect(setCookie).toMatch(/SameSite=lax/i);
    const token = loc.split('/vote/')[1];
    expect(await getTokenState(hashToken(token))).toBe('active');
  });

  test('existing cookie reused', async () => {
    await openWindow();
    const cookie = randomToken();
    const res = await GET(req({ cookie }));
    expect(res.cookies.get('dipl_vid')?.value).toBe(cookie);
    expect(res.headers.get('location')).toMatch(/\/vote\//);
  });

  test('voted cookie -> /thanks, no new token', async () => {
    await openWindow();
    const cookie = randomToken();
    const token = randomToken();
    expect(await mintToken(hashToken(token), hashId('seed-ip'))).toBe('ok');
    const cast = await castVote({
      tokenHash: hashToken(token),
      teamId: await teamId('code-red'),
      browserHash: hashId(cookie),
      deviceHash: null,
      ipHash: hashId('seed-ip'),
      uaHash: null,
    });
    expect(cast.status).toBe('ok');
    const before = await tokenCount();
    const res = await GET(req({ cookie }));
    expect(res.status).toBe(303);
    expect(new URL(res.headers.get('location')!).pathname).toBe('/thanks');
    expect(res.cookies.get('dipl_vid')?.value).toBe(cookie);
    expect(await tokenCount()).toBe(before);
  });

  test('rate limited -> /slow-down', async () => {
    await openWindow();
    const ip = fakeIp();
    await GET(req({ ip }));
    await GET(req({ ip }));
    const res = await GET(req({ ip }));
    expect(res.status).toBe(303);
    expect(new URL(res.headers.get('location')!).pathname).toBe('/slow-down');
  });
});
