import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, test, vi } from 'vitest';

vi.mock('@/lib/turnstile', () => ({
  verifyTurnstile: vi.fn(async (t: string) => t === 'pass'),
}));

// Raise the mint and vote rate limits so load is bounded by the code under test, not by them.
vi.mock('@/lib/env', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/env')>();
  return {
    ...actual,
    getServerEnv: () => {
      const env = actual.getServerEnv();
      return {
        ...env,
        rateLimits: {
          ...env.rateLimits,
          mint: { max: 1000, windowSeconds: 600 },
          vote: { max: 1000, windowSeconds: 600 },
        },
      };
    },
  };
});

import { GET } from '@/app/v/route';
import { POST } from '@/app/api/vote/route';
import { randomToken } from '@/lib/crypto';
import { admin, openWindow, resetData, teamId } from './helpers';

let counter = 0;
function fakeIp(): string {
  counter += 1;
  return `10.3.${Math.floor(counter / 250)}.${(counter % 250) + 1}`;
}

async function mint(): Promise<{ token: string; cookie: string }> {
  const res = await GET(
    new NextRequest('http://localhost:3000/v', { headers: { 'x-forwarded-for': fakeIp() } }),
  );
  const loc = res.headers.get('location') ?? '';
  const m = loc.match(/\/vote\/([A-Za-z0-9_-]+)$/);
  if (!m) throw new Error(`mint failed: ${new URL(loc, 'http://localhost:3000').pathname}`);
  const cookie = res.cookies.get('dipl_vid')?.value;
  if (!cookie) throw new Error('mint did not set a cookie');
  return { token: m[1], cookie };
}

function post(
  token: string,
  team: string,
  opts: { cookie: string; ip?: string; deviceSignal?: string | null },
): Promise<Response> {
  return POST(
    new NextRequest('http://localhost:3000/api/vote', {
      method: 'POST',
      headers: {
        'x-forwarded-for': opts.ip ?? fakeIp(),
        'user-agent': 'vitest',
        'content-type': 'application/json',
        cookie: `dipl_vid=${opts.cookie}`,
      },
      body: JSON.stringify({
        token,
        teamId: team,
        turnstileToken: 'pass',
        deviceSignal: opts.deviceSignal ?? null,
      }),
    }),
  );
}

async function mintMany(n: number): Promise<{ token: string; cookie: string }[]> {
  const out: { token: string; cookie: string }[] = [];
  for (let i = 0; i < n; i += 1) out.push(await mint());
  return out;
}

function hex64(seed: number): string {
  return seed.toString(16).padStart(64, '0');
}

async function statuses(rs: Response[]): Promise<number[]> {
  return rs.map((r) => r.status);
}

beforeEach(resetData);

describe('vote flow under load', () => {
  test('api load: 50 concurrent distinct voters', async () => {
    await openWindow({ maxPerDeviceIp: 0 });
    const teams = [
      await teamId('code-red'),
      await teamId('code-blue'),
      await teamId('jager-shots'),
    ];
    const ballots = await mintMany(50);
    const sent = new Map<string, number>();
    const responses = await Promise.all(
      ballots.map((b, i) => {
        const team = teams[i % 3];
        sent.set(team, (sent.get(team) ?? 0) + 1);
        return post(b.token, team, { cookie: b.cookie, deviceSignal: hex64(i + 1) });
      }),
    );
    expect(await statuses(responses)).toEqual(Array(50).fill(200));

    const { data, error } = await admin.rpc('get_results');
    expect(error).toBeNull();
    const rows = data as { team_id: string; votes: number }[];
    expect(rows.reduce((s, r) => s + Number(r.votes), 0)).toBe(50);
    for (const [team, count] of sent) {
      expect(Number(rows.find((r) => r.team_id === team)?.votes)).toBe(count);
    }
  });

  test('api load: same cookie, 10 concurrent tokens', async () => {
    await openWindow({ maxPerDeviceIp: 0 });
    const team = await teamId('code-red');
    const ballots = await mintMany(10);
    const cookie = randomToken();
    const responses = await Promise.all(
      ballots.map((b) => post(b.token, team, { cookie, deviceSignal: null })),
    );
    const codes = await statuses(responses);
    expect(codes.filter((c) => c === 200)).toHaveLength(1);
    expect(codes.filter((c) => c === 409)).toHaveLength(9);
    for (const r of responses.filter((r) => r.status === 409)) {
      expect(await r.json()).toEqual({ ok: false, code: 'already_voted' });
    }
  });

  test('api load: 10 concurrent requests on one token', async () => {
    await openWindow({ maxPerDeviceIp: 0 });
    const team = await teamId('code-red');
    const { token } = await mint();
    const responses = await Promise.all(
      Array.from({ length: 10 }, () => post(token, team, { cookie: randomToken() })),
    );
    const codes = await statuses(responses);
    expect(codes.filter((c) => c === 200)).toHaveLength(1);
    expect(codes.filter((c) => c === 409)).toHaveLength(9);
  });

  test('api load: device cap under concurrency', async () => {
    await openWindow({ maxPerDeviceIp: 3 });
    const team = await teamId('code-red');
    const ip = fakeIp();
    const device = hex64(0xabc);
    const ballots = await mintMany(8);
    const responses = await Promise.all(
      ballots.map((b) => post(b.token, team, { cookie: b.cookie, ip, deviceSignal: device })),
    );
    const codes = await statuses(responses);
    expect(codes.filter((c) => c === 200)).toHaveLength(3);
    expect(codes.filter((c) => c === 409)).toHaveLength(5);
    const { count, error } = await admin.from('votes').select('*', { count: 'exact', head: true });
    expect(error).toBeNull();
    expect(count).toBe(3);
  });
});
