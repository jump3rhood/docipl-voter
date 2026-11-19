import { VOTE_ERROR_CODES, type VoteErrorCode } from '@/lib/voteMessages';
import type { SubmitResult } from '@/components/BallotForm';

const NETWORK: SubmitResult = { ok: false, code: 'network' };

export async function postVote(
  input: { token: string; teamId: string; turnstileToken: string; deviceSignal: string | null },
  fetchImpl: typeof fetch = fetch,
): Promise<SubmitResult> {
  try {
    const res = await fetchImpl('/api/vote', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(input),
    });
    const data: unknown = await res.json();
    if (typeof data !== 'object' || data === null) return NETWORK;
    const d = data as { ok?: unknown; teamName?: unknown; code?: unknown };
    if (d.ok === true && typeof d.teamName === 'string') {
      return { ok: true, teamName: d.teamName };
    }
    if (d.ok === false && VOTE_ERROR_CODES.includes(d.code as VoteErrorCode)) {
      return { ok: false, code: d.code as VoteErrorCode };
    }
    return NETWORK;
  } catch {
    return NETWORK;
  }
}
