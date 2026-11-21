import { describe, expect, test, vi } from 'vitest';
import { syncVoterId, VOTER_ID_STORAGE_KEY } from '@/lib/voterIdSync';

const A = 'a'.repeat(43);
const B = 'B'.repeat(42) + '_';

function memStorage(initial?: string) {
  const map = new Map<string, string>();
  if (initial !== undefined) map.set(VOTER_ID_STORAGE_KEY, initial);
  return {
    map,
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
  };
}

function fetchReturning(body: unknown, ok = true) {
  return vi.fn(async () => ({ ok, json: async () => body }) as Response);
}

describe('syncVoterId', () => {
  test('no backup yet: saves the cookie ID', async () => {
    const s = memStorage();
    const f = fetchReturning({});
    expect(await syncVoterId({ currentId: A, voted: false, storage: s, fetchImpl: f })).toBe('saved');
    expect(s.map.get(VOTER_ID_STORAGE_KEY)).toBe(A);
    expect(f).not.toHaveBeenCalled();
  });

  test('backup matches the cookie: nothing to do', async () => {
    const s = memStorage(A);
    const f = fetchReturning({});
    expect(await syncVoterId({ currentId: A, voted: false, storage: s, fetchImpl: f })).toBe('none');
    expect(f).not.toHaveBeenCalled();
  });

  test('cookie cleared (new ID): restores the backup, reports voted', async () => {
    const s = memStorage(A);
    const f = fetchReturning({ ok: true, voted: true });
    expect(await syncVoterId({ currentId: B, voted: false, storage: s, fetchImpl: f })).toBe(
      'restored_voted',
    );
    expect(f).toHaveBeenCalledWith('/api/voter', expect.objectContaining({ method: 'POST', body: JSON.stringify({ id: A }) }));
    expect(s.map.get(VOTER_ID_STORAGE_KEY)).toBe(A);
  });

  test('no cookie at all: restores the backup, not voted', async () => {
    const s = memStorage(A);
    const f = fetchReturning({ ok: true, voted: false });
    expect(await syncVoterId({ currentId: null, voted: false, storage: s, fetchImpl: f })).toBe('restored');
  });

  test('cookie ID has voted: it wins and overwrites the backup', async () => {
    const s = memStorage(A);
    const f = fetchReturning({});
    expect(await syncVoterId({ currentId: B, voted: true, storage: s, fetchImpl: f })).toBe('saved');
    expect(s.map.get(VOTER_ID_STORAGE_KEY)).toBe(B);
    expect(f).not.toHaveBeenCalled();
  });

  test('malformed backup is ignored and replaced', async () => {
    const s = memStorage('not-an-id');
    const f = fetchReturning({});
    expect(await syncVoterId({ currentId: A, voted: false, storage: s, fetchImpl: f })).toBe('saved');
    expect(f).not.toHaveBeenCalled();
  });

  test('server error or network failure: no-op', async () => {
    expect(
      await syncVoterId({ currentId: B, voted: false, storage: memStorage(A), fetchImpl: fetchReturning({}, false) }),
    ).toBe('none');
    const boom = vi.fn(async () => {
      throw new Error('offline');
    });
    expect(await syncVoterId({ currentId: B, voted: false, storage: memStorage(A), fetchImpl: boom })).toBe('none');
  });

  test('storage unavailable or throwing: no-op', async () => {
    expect(await syncVoterId({ currentId: A, voted: false, storage: null })).toBe('none');
    const throwing = {
      getItem: () => {
        throw new Error('denied');
      },
      setItem: () => {
        throw new Error('denied');
      },
    };
    expect(await syncVoterId({ currentId: A, voted: false, storage: throwing })).toBe('none');
  });
});
