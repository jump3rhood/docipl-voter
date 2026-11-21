/**
 * Keeps a backup of the voter ID (the httpOnly `dipl_vid` cookie value) in localStorage, so a
 * voter who clears only cookies is recognised again instead of getting a fresh vote.
 */

export const VOTER_ID_STORAGE_KEY = 'dipl_vid';

/** randomToken() output: 32 bytes base64url, no padding. */
export const VOTER_ID_FORMAT = /^[A-Za-z0-9_-]{43}$/;

export type SyncOutcome = 'none' | 'saved' | 'restored' | 'restored_voted';

type Storage = Pick<globalThis.Storage, 'getItem' | 'setItem'>;

function read(storage: Storage): string | null {
  try {
    const v = storage.getItem(VOTER_ID_STORAGE_KEY);
    return v && VOTER_ID_FORMAT.test(v) ? v : null;
  } catch {
    return null;
  }
}

function write(storage: Storage, id: string): boolean {
  try {
    storage.setItem(VOTER_ID_STORAGE_KEY, id);
    return true;
  } catch {
    return false;
  }
}

/**
 * - `voted`: the cookie ID has a vote, so it is the identity to keep; save it.
 * - A different stored ID: ask the server to put it back in the cookie.
 * - Otherwise: save the cookie ID if there is one.
 * Never throws; storage or network failures just leave things as they are.
 */
export async function syncVoterId(opts: {
  currentId: string | null;
  voted: boolean;
  storage: Storage | null;
  fetchImpl?: typeof fetch;
}): Promise<SyncOutcome> {
  const { currentId, voted, storage } = opts;
  if (!storage) return 'none';
  const current = currentId && VOTER_ID_FORMAT.test(currentId) ? currentId : null;
  const stored = read(storage);

  if (voted || !stored) {
    if (current && current !== stored) return write(storage, current) ? 'saved' : 'none';
    return 'none';
  }
  if (stored === current) return 'none';

  try {
    const res = await (opts.fetchImpl ?? fetch)('/api/voter', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ id: stored }),
    });
    if (!res.ok) return 'none';
    const data: unknown = await res.json();
    if (typeof data !== 'object' || data === null) return 'none';
    return (data as { voted?: unknown }).voted === true ? 'restored_voted' : 'restored';
  } catch {
    return 'none';
  }
}
