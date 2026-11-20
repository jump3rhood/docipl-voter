import { beforeEach, describe, expect, test } from 'vitest';
import { admin, openWindow, resetData, teamId } from './helpers';
import { castVote, getTokenState, getVoterVote, mintToken, rateLimitHit } from '@/lib/votes';
import { hashId, hashToken } from '@/lib/identity';
import { randomToken } from '@/lib/crypto';

beforeEach(resetData);

async function minted(ip: string) {
  const tokenHash = hashToken(randomToken());
  expect(await mintToken(tokenHash, hashId(ip))).toBe('ok');
  return tokenHash;
}

describe('vote wrappers', () => {
  test('rateLimitHit allows then blocks per env limit', async () => {
    const key = hashId('rl-ip');
    expect(await rateLimitHit('vote', key)).toBe(true);
    expect(await rateLimitHit('vote', key)).toBe(true);
    expect(await rateLimitHit('vote', key)).toBe(false);
  });

  test('mint + cast + getVoterVote + getTokenState round trip', async () => {
    await openWindow();
    const tokenHash = await minted('ip-a');
    expect(await getTokenState(tokenHash)).toBe('active');
    const browserHash = hashId('browser-a');
    const r = await castVote({
      tokenHash,
      teamId: await teamId('code-red'),
      browserHash,
      deviceHash: hashId('dev-a'),
      ipHash: hashId('ip-a'),
      uaHash: hashId('ua-a'),
    });
    expect(r).toEqual({ status: 'ok', teamName: 'Code Red' });
    expect(await getTokenState(tokenHash)).toBe('used');
    expect(await getVoterVote(browserHash)).toMatchObject({ teamName: 'Code Red' });
    expect(await getVoterVote(hashId('nobody'))).toBeNull();
    expect(await getTokenState(hashToken('missing'))).toBe('invalid');
  });

  test('getVoterVote includes accentColor', async () => {
    await openWindow();
    const tokenHash = await minted('ip-d');
    const browserHash = hashId('browser-d');
    await castVote({
      tokenHash,
      teamId: await teamId('code-red'),
      browserHash,
      deviceHash: null,
      ipHash: hashId('ip-d'),
      uaHash: null,
    });
    expect(await getVoterVote(browserHash)).toEqual({
      teamId: await teamId('code-red'),
      teamName: 'Code Red',
      accentColor: '#EF4444',
    });
    const id = await teamId('code-red');
    try {
      await admin.from('teams').update({ accent_color: null }).eq('id', id);
      expect((await getVoterVote(browserHash))?.accentColor).toBeNull();
    } finally {
      await admin.from('teams').update({ accent_color: '#EF4444' }).eq('id', id);
    }
  });

  test('castVote maps token_used', async () => {
    await openWindow();
    const tokenHash = await minted('ip-b');
    const base = {
      tokenHash,
      teamId: await teamId('code-red'),
      deviceHash: null,
      ipHash: hashId('ip-b'),
      uaHash: null,
    };
    expect((await castVote({ ...base, browserHash: hashId('b1') })).status).toBe('ok');
    const again = await castVote({ ...base, browserHash: hashId('b2') });
    expect(again.status).toBe('token_used');
    expect(again.teamName).toBeNull();
  });

  test('mintToken when closed -> voting_not_open', async () => {
    expect(await mintToken(hashToken(randomToken()), hashId('ip-c'))).toBe('voting_not_open');
  });
});
