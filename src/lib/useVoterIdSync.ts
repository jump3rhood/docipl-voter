'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { syncVoterId } from '@/lib/voterIdSync';

function localStorageOrNull(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

/**
 * Runs the voter-ID backup/restore once on mount. Returns true once it has finished (or
 * failed), so a ballot can hold its submit button until the right cookie is in place.
 */
export function useVoterIdSync(
  currentId: string | null,
  opts: { voted?: boolean; redirectIfVoted?: boolean } = {},
): boolean {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const { voted = false, redirectIfVoted = true } = opts;

  useEffect(() => {
    let cancelled = false;
    void syncVoterId({ currentId, voted, storage: localStorageOrNull() }).then((outcome) => {
      if (cancelled) return;
      if (outcome === 'restored_voted' && redirectIfVoted) {
        router.replace('/thanks');
        return;
      }
      setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, [currentId, voted, redirectIfVoted, router]);

  return ready;
}
