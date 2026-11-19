import { beforeEach, describe, expect, test } from 'vitest';
import { admin, openWindow, resetData, teamId } from './helpers';
import { castVote, mintToken } from '@/lib/votes';
import { hashId, hashToken } from '@/lib/identity';
import { randomToken } from '@/lib/crypto';
import { getResults } from '@/lib/results';

beforeEach(resetData);

let n = 0;
async function vote(slug: string) {
  const i = ++n;
  const tokenHash = hashToken(randomToken());
  expect(await mintToken(tokenHash, hashId(`res-ip-${i}`))).toBe('ok');
  const r = await castVote({
    tokenHash,
    teamId: await teamId(slug),
    browserHash: hashId(`res-b-${i}`),
    deviceHash: hashId(`res-d-${i}`),
    ipHash: hashId(`res-ip-${i}`),
    uaHash: hashId(`res-ua-${i}`),
  });
  expect(r.status).toBe('ok');
}

describe('getResults', () => {
  test('getResults totals and order', async () => {
    await openWindow();
    await vote('code-red');
    await vote('code-red');
    await vote('code-red');
    await vote('jager-shots');
    const res = await getResults();
    expect(res.total).toBe(4);
    expect(res.rows).toHaveLength(11);
    expect(res.rows[0]).toMatchObject({ slug: 'code-red', votes: 3, percent: 75, rank: 1 });
    for (const r of res.rows) {
      expect(typeof r.votes).toBe('number');
      expect(typeof r.percent).toBe('number');
      expect(typeof r.rank).toBe('number');
    }
  });

  test('getResults excludes inactive', async () => {
    await admin.from('teams').update({ is_active: false }).eq('slug', 'the-rush');
    const res = await getResults();
    expect(res.rows).toHaveLength(10);
    expect(res.rows.some((r) => r.slug === 'the-rush')).toBe(false);
  });

  test('getResults zero state', async () => {
    const res = await getResults();
    expect(res.total).toBe(0);
    expect(res.rows).toHaveLength(11);
    expect(res.rows.every((r) => r.percent === 0 && r.rank === 1)).toBe(true);
  });
});
