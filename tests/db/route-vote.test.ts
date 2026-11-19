import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, test, vi } from 'vitest';

vi.mock('@/lib/turnstile', () => ({
  verifyTurnstile: vi.fn(async (t: string) => t === 'pass'),
}));

const envMock = vi.hoisted(() => ({ siteUrl: 'https://docipl.example' }));
vi.mock('@/lib/env', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/env')>();
  return {
    ...actual,
    getServerEnv: () => ({ ...actual.getServerEnv(), SITE_URL: envMock.siteUrl }),
  };
});

import { GET } from '@/app/v/route';
import { POST } from '@/app/api/vote/route';
import { hashId, hashToken } from '@/lib/identity';
import { randomToken } from '@/lib/crypto';
import * as votes from '@/lib/votes';
import { getTokenState } from '@/lib/votes';
import { admin, openWindow, resetData, teamId } from './helpers';

let counter = 0;
function fakeIp(): string {
  counter += 1;
  return `10.2.${Math.floor(counter / 250)}.${(counter % 250) + 1}`;
}

/** Mints a ballot through GET /v; returns the token and the voter cookie. */
async function mintFor(cookie?: string): Promise<{ token: string; cookie: string }> {
  const headers: Record<string, string> = { 'x-forwarded-for': fakeIp() };
  if (cookie) headers.cookie = `dipl_vid=${cookie}`;
  const res = await GET(new NextRequest('http://localhost:3000/v', { headers }));
  const loc = res.headers.get('location') ?? '';
  const m = loc.match(/\/vote\/([A-Za-z0-9_-]+)$/);
  if (!m) throw new Error(`mint failed: ${new URL(loc).pathname}`);
  const c = res.cookies.get('dipl_vid')?.value;
  if (!c) throw new Error('mint did not set a cookie');
  return { token: m[1], cookie: c };
}

async function post(
  body: unknown,
  opts: {
    cookie?: string;
    ip?: string;
    raw?: boolean;
    contentType?: string | null;
    origin?: string;
  } = {},
): Promise<Response> {
  const headers: Record<string, string> = {
    'x-forwarded-for': opts.ip ?? fakeIp(),
    'user-agent': 'vitest',
  };
  const contentType = opts.contentType === undefined ? 'application/json' : opts.contentType;
  if (contentType !== null) headers['content-type'] = contentType;
  if (opts.origin) headers.origin = opts.origin;
  if (opts.cookie) headers.cookie = `dipl_vid=${opts.cookie}`;
  return POST(
    new NextRequest('http://localhost:3000/api/vote', {
      method: 'POST',
      headers,
      body: opts.raw ? (body as string) : JSON.stringify(body),
    }),
  );
}

function ballot(token: string, team: string, extra: Record<string, unknown> = {}) {
  return { token, teamId: team, turnstileToken: 'pass', deviceSignal: null, ...extra };
}

const DEV_1 = 'a'.repeat(64);
const DEV_2 = 'b'.repeat(64);

async function clearRateLimits(): Promise<void> {
  const { error } = await admin.from('rate_limits').delete().neq('bucket', '');
  if (error) throw new Error(error.message);
}

beforeEach(resetData);

describe('POST /api/vote', () => {
  test('api: happy path', async () => {
    await openWindow();
    const { token, cookie } = await mintFor();
    const res = await post(ballot(token, await teamId('code-red')), { cookie });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, teamName: 'Code Red' });
    expect(res.headers.get('cache-control')).toContain('no-store');
    expect(await getTokenState(hashToken(token))).toBe('used');
  });

  test('api: no cookie → vote ok and cookie set', async () => {
    await openWindow();
    const { token } = await mintFor();
    const res = await post(ballot(token, await teamId('code-red')));
    expect(res.status).toBe(200);
    const setCookie = res.headers.get('set-cookie') ?? '';
    expect(setCookie).toContain('dipl_vid=');
    expect(setCookie).toContain('HttpOnly');
  });

  test('api: reused token → 409 already_voted', async () => {
    await openWindow();
    const { token, cookie } = await mintFor();
    const team = await teamId('code-red');
    expect((await post(ballot(token, team), { cookie })).status).toBe(200);
    const res = await post(ballot(token, team), { cookie: randomToken() });
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ ok: false, code: 'already_voted' });
    expect(res.headers.get('set-cookie') ?? '').toContain('dipl_vid=');
  });

  test('api: same cookie, second token → 409 already_voted', async () => {
    await openWindow();
    const first = await mintFor();
    const team = await teamId('code-red');
    expect((await post(ballot(first.token, team), { cookie: first.cookie })).status).toBe(200);
    const second = await mintFor(randomToken());
    const res = await post(ballot(second.token, team), { cookie: first.cookie });
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ ok: false, code: 'already_voted' });
    expect(await getTokenState(hashToken(second.token))).toBe('active');
  });

  test('api: turnstile fail keeps token active', async () => {
    await openWindow();
    const { token, cookie } = await mintFor();
    const res = await post(ballot(token, await teamId('code-red'), { turnstileToken: 'nope' }), {
      cookie,
    });
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ ok: false, code: 'turnstile_failed' });
    expect(res.headers.get('set-cookie')).toBeNull();
    expect(await getTokenState(hashToken(token))).toBe('active');
  });

  test('api: bad teamId → 400 invalid_team; bad token shape → 400 token_invalid; non-JSON → 400 token_invalid', async () => {
    await openWindow();
    const { token } = await mintFor();
    const team = await teamId('code-red');

    const badTeam = await post(ballot(token, 'not-a-uuid'));
    expect(badTeam.status).toBe(400);
    expect(await badTeam.json()).toEqual({ ok: false, code: 'invalid_team' });

    const badToken = await post(ballot('short', team));
    expect(badToken.status).toBe(400);
    expect(await badToken.json()).toEqual({ ok: false, code: 'token_invalid' });

    const bothBad = await post(ballot('short', 'nope'));
    expect(bothBad.status).toBe(400);
    expect(await bothBad.json()).toEqual({ ok: false, code: 'token_invalid' });

    const nonJson = await post('{not json', { raw: true });
    expect(nonJson.status).toBe(400);
    expect(await nonJson.json()).toEqual({ ok: false, code: 'token_invalid' });

    const huge = await post(ballot(token, team, { deviceSignal: 'x'.repeat(9000) }));
    expect(huge.status).toBe(400);
    expect(await huge.json()).toEqual({ ok: false, code: 'token_invalid' });

    expect(await getTokenState(hashToken(token))).toBe('active');
  });

  test('api: inactive team → 422 invalid_team, token still active', async () => {
    await openWindow();
    const { token, cookie } = await mintFor();
    const team = await teamId('smash-squad');
    const { error } = await admin.from('teams').update({ is_active: false }).eq('id', team);
    if (error) throw new Error(error.message);
    const res = await post(ballot(token, team), { cookie });
    expect(res.status).toBe(422);
    expect(await res.json()).toEqual({ ok: false, code: 'invalid_team' });
    expect(await getTokenState(hashToken(token))).toBe('active');
  });

  test('api: unknown token → 410 token_invalid', async () => {
    await openWindow();
    const res = await post(ballot(randomToken(), await teamId('code-red')));
    expect(res.status).toBe(410);
    expect(await res.json()).toEqual({ ok: false, code: 'token_invalid' });
    expect(res.headers.get('set-cookie') ?? '').toContain('dipl_vid=');
  });

  test('api: closed window → 403 voting_closed', async () => {
    await openWindow();
    const { token, cookie } = await mintFor();
    const now = Date.now();
    const { error } = await admin
      .from('voting_config')
      .update({
        voting_start: new Date(now - 7200_000).toISOString(),
        voting_end: new Date(now - 60_000).toISOString(),
      })
      .eq('id', 1);
    if (error) throw new Error(error.message);
    const res = await post(ballot(token, await teamId('code-red')), { cookie });
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ ok: false, code: 'voting_closed' });
  });

  test('api: rate limited → 429', async () => {
    await openWindow();
    const team = await teamId('code-red');
    const ip = fakeIp();
    const a = await mintFor();
    const b = await mintFor();
    const c = await mintFor();
    expect((await post(ballot(a.token, team), { cookie: a.cookie, ip })).status).toBe(200);
    expect((await post(ballot(b.token, team), { cookie: b.cookie, ip })).status).toBe(200);
    const res = await post(ballot(c.token, team), { cookie: c.cookie, ip });
    expect(res.status).toBe(429);
    expect(await res.json()).toEqual({ ok: false, code: 'rate_limited' });
    expect(await getTokenState(hashToken(c.token))).toBe('active');
  });

  test('api: concurrent same token', async () => {
    await openWindow();
    const { token } = await mintFor();
    const team = await teamId('code-red');
    const results = await Promise.all([
      post(ballot(token, team), { cookie: randomToken() }),
      post(ballot(token, team), { cookie: randomToken() }),
    ]);
    expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
  });

  test('api: device cap via API', async () => {
    await openWindow({ maxPerDeviceIp: 1 });
    const team = await teamId('dinking-dragons');
    const ip = fakeIp();
    const a = await mintFor();
    const b = await mintFor();
    const c = await mintFor();
    const r1 = await post(ballot(a.token, team, { deviceSignal: DEV_1 }), {
      cookie: a.cookie,
      ip,
    });
    expect(r1.status).toBe(200);
    const r2 = await post(ballot(b.token, team, { deviceSignal: DEV_1 }), {
      cookie: b.cookie,
      ip,
    });
    expect(r2.status).toBe(409);
    expect(await r2.json()).toEqual({ ok: false, code: 'already_voted' });
    // Negative control: same IP, different device -> its own bucket. Clear the per-IP
    // vote rate limit (2/600 in tests) so this isolates the device cap.
    await clearRateLimits();
    const r3 = await post(ballot(c.token, team, { deviceSignal: DEV_2 }), {
      cookie: c.cookie,
      ip,
    });
    expect(r3.status).toBe(200);
  });

  test('api: non-JSON content-type -> 415 token_invalid, token untouched', async () => {
    await openWindow();
    const { token, cookie } = await mintFor();
    const team = await teamId('code-red');
    for (const contentType of ['text/plain', 'application/x-www-form-urlencoded', null]) {
      const res = await post(ballot(token, team), { cookie, contentType });
      expect(res.status).toBe(415);
      expect(await res.json()).toEqual({ ok: false, code: 'token_invalid' });
    }
    const ok = await post(ballot(token, team), {
      cookie,
      contentType: 'application/json; charset=utf-8',
    });
    expect(ok.status).toBe(200);
  });

  test('api: foreign Origin -> 403 token_invalid; same origin ok', async () => {
    await openWindow();
    const { token, cookie } = await mintFor();
    const team = await teamId('code-red');
    for (const origin of ['https://evil.example', 'http://localhost:3001', 'null']) {
      const res = await post(ballot(token, team), { cookie, origin });
      expect(res.status).toBe(403);
      expect(await res.json()).toEqual({ ok: false, code: 'token_invalid' });
    }
    expect(await getTokenState(hashToken(token))).toBe('active');
    const ok = await post(ballot(token, team), { cookie, origin: 'http://localhost:3000' });
    expect(ok.status).toBe(200);
  });

  test('api: origin check uses request origin off production', async () => {
    vi.stubEnv('VERCEL_ENV', '');
    try {
      await openWindow();
      const { token, cookie } = await mintFor();
      // SITE_URL (mocked) is https://docipl.example; the request host is localhost:3000.
      const res = await post(ballot(token, await teamId('code-red')), {
        cookie,
        origin: 'http://localhost:3000',
      });
      expect(res.status).toBe(200);
    } finally {
      vi.unstubAllEnvs();
    }
  });

  test('api: production origin must match SITE_URL', async () => {
    vi.stubEnv('VERCEL_ENV', 'production');
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      await openWindow();
      const { token, cookie } = await mintFor();
      const team = await teamId('code-red');
      const foreign = await post(ballot(token, team), { cookie, origin: 'https://evil.example' });
      expect(foreign.status).toBe(403);
      // The request's own origin is not enough in production.
      const own = await post(ballot(token, team), { cookie, origin: 'http://localhost:3000' });
      expect(own.status).toBe(403);
      const good = await post(ballot(token, team), { cookie, origin: 'https://docipl.example' });
      expect(good.status).toBe(200);
      expect(warn).toHaveBeenCalledWith('[vote] rejected: origin');
      expect(warn.mock.calls.flat().join(' ')).not.toContain('evil.example');
    } finally {
      warn.mockRestore();
      vi.unstubAllEnvs();
    }
  });

  test('api: content-type rejection is logged', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const res = await post({}, { contentType: 'text/plain' });
      expect(res.status).toBe(415);
      expect(warn).toHaveBeenCalledWith('[vote] rejected: content-type');
    } finally {
      warn.mockRestore();
    }
  });

  test('api: content-length too large -> 400 token_invalid', async () => {
    await openWindow();
    const { token, cookie } = await mintFor();
    const req = new NextRequest('http://localhost:3000/api/vote', {
      method: 'POST',
      headers: {
        'x-forwarded-for': fakeIp(),
        'content-type': 'application/json',
        'content-length': '9000',
        cookie: `dipl_vid=${cookie}`,
      },
      body: JSON.stringify(ballot(token, await teamId('code-red'))),
    });
    const textSpy = vi.spyOn(req, 'text');
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    let res;
    try {
      res = await POST(req);
      expect(warn).toHaveBeenCalledWith('[vote] rejected: size');
    } finally {
      warn.mockRestore();
    }
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ ok: false, code: 'token_invalid' });
    expect(textSpy).not.toHaveBeenCalled();
    expect(await getTokenState(hashToken(token))).toBe('active');
  });

  test('api: ok with null teamName -> 500 network', async () => {
    await openWindow();
    const { token, cookie } = await mintFor();
    const spy = vi
      .spyOn(votes, 'castVote')
      .mockResolvedValueOnce({ status: 'ok', teamName: null });
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const res = await post(ballot(token, await teamId('code-red')), { cookie });
      expect(res.status).toBe(500);
      expect(await res.json()).toEqual({ ok: false, code: 'network' });
    } finally {
      spy.mockRestore();
      err.mockRestore();
    }
  });

  test('api: bogus deviceSignal still votes, stored in the none bucket', async () => {
    await openWindow();
    const { token, cookie } = await mintFor();
    const res = await post(ballot(token, await teamId('code-red'), { deviceSignal: 'not-hex' }), {
      cookie,
    });
    expect(res.status).toBe(200);
    const { data, error } = await admin.from('votes').select('device_hash');
    if (error) throw new Error(error.message);
    expect(data).toEqual([{ device_hash: 'none' }]);
  });

  test('api: valid deviceSignal stored hashed', async () => {
    await openWindow();
    const { token, cookie } = await mintFor();
    const res = await post(ballot(token, await teamId('code-red'), { deviceSignal: DEV_1 }), {
      cookie,
    });
    expect(res.status).toBe(200);
    const { data, error } = await admin.from('votes').select('device_hash');
    if (error) throw new Error(error.message);
    expect(data).toEqual([{ device_hash: hashId(DEV_1) }]);
  });
});
