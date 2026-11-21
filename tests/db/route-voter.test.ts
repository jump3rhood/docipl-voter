import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, test } from 'vitest';
import { POST } from '@/app/api/voter/route';
import { hashId, hashToken } from '@/lib/identity';
import { randomToken } from '@/lib/crypto';
import { castVote, mintToken } from '@/lib/votes';
import { openWindow, resetData, teamId } from './helpers';

let counter = 0;
function fakeIp(): string {
  counter += 1;
  return `10.3.${Math.floor(counter / 250)}.${(counter % 250) + 1}`;
}

function post(body: unknown, opts: { origin?: string; contentType?: string; ip?: string } = {}) {
  const headers: Record<string, string> = {
    'x-forwarded-for': opts.ip ?? fakeIp(),
    'content-type': opts.contentType ?? 'application/json',
  };
  if (opts.origin) headers.origin = opts.origin;
  return POST(
    new NextRequest('http://localhost:3000/api/voter', {
      method: 'POST',
      headers,
      body: typeof body === 'string' ? body : JSON.stringify(body),
    }),
  );
}

async function voteAs(cookie: string): Promise<void> {
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
}

beforeEach(resetData);

describe('POST /api/voter', () => {
  test('voted ID: sets the cookie back and reports voted', async () => {
    await openWindow();
    const id = randomToken();
    await voteAs(id);
    const res = await post({ id });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, voted: true });
    expect(res.cookies.get('dipl_vid')?.value).toBe(id);
    expect(res.headers.get('set-cookie')).toContain('HttpOnly');
  });

  test('unvoted ID: sets the cookie, voted false', async () => {
    await openWindow();
    const id = randomToken();
    const res = await post({ id });
    expect(await res.json()).toEqual({ ok: true, voted: false });
    expect(res.cookies.get('dipl_vid')?.value).toBe(id);
  });

  test('malformed ID, bad JSON, wrong content-type, foreign origin are rejected without a cookie', async () => {
    const cases = [
      await post({ id: 'short' }),
      await post({ id: 42 }),
      await post('{nope'),
      await post({ id: randomToken() }, { contentType: 'text/plain' }),
      await post({ id: randomToken() }, { origin: 'https://evil.example' }),
    ];
    for (const res of cases) {
      expect(res.status).toBeGreaterThanOrEqual(400);
      expect(res.cookies.get('dipl_vid')).toBeUndefined();
    }
  });

  test('rate limited per IP', async () => {
    const ip = fakeIp();
    let last: Response | undefined;
    for (let i = 0; i < 200; i++) {
      last = await post({ id: randomToken() }, { ip });
      if (last.status === 429) break;
    }
    expect(last?.status).toBe(429);
  });
});
