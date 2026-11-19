import { expect, test, vi } from 'vitest';
import { postVote } from '@/lib/submitVote';

const input = { token: 'tok', teamId: 'team-1', turnstileToken: '', deviceSignal: null };

test('ok response → ok result', async () => {
  const fetchImpl = vi.fn(async () => Response.json({ ok: true, teamName: 'Code Red' }));
  const r = await postVote(input, fetchImpl as unknown as typeof fetch);
  expect(r).toEqual({ ok: true, teamName: 'Code Red' });
  const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
  expect(url).toBe('/api/vote');
  expect(init.method).toBe('POST');
  expect(JSON.parse(init.body as string)).toEqual(input);
});

test('known error code passes through', async () => {
  const fetchImpl = async () => Response.json({ ok: false, code: 'token_invalid' }, { status: 401 });
  expect(await postVote(input, fetchImpl as unknown as typeof fetch)).toEqual({
    ok: false,
    code: 'token_invalid',
  });
});

test('unknown code → network', async () => {
  const fetchImpl = async () => Response.json({ ok: false, code: 'weird' });
  expect(await postVote(input, fetchImpl as unknown as typeof fetch)).toEqual({
    ok: false,
    code: 'network',
  });
});

test('network failure → generic error', async () => {
  const rejecting = async () => {
    throw new Error('offline');
  };
  expect(await postVote(input, rejecting as unknown as typeof fetch)).toEqual({
    ok: false,
    code: 'network',
  });
  const nonJson = async () => new Response('<html>boom</html>', { status: 500 });
  expect(await postVote(input, nonJson as unknown as typeof fetch)).toEqual({
    ok: false,
    code: 'network',
  });
});

test.each([
  ['ok without teamName', { ok: true }],
  ['null body', null],
  ['array body', [{ ok: true, teamName: 'X' }]],
])('%s -> network', async (_name, body) => {
  const fetchImpl = async () => Response.json(body);
  expect(await postVote(input, fetchImpl as unknown as typeof fetch)).toEqual({
    ok: false,
    code: 'network',
  });
});
