'use client';

import { useVoterIdSync } from '@/lib/useVoterIdSync';

/** Renders nothing; backs up or restores the voter ID for server-rendered pages. */
export function VoterIdSync({
  currentId,
  voted = false,
  redirectIfVoted = true,
}: {
  currentId: string | null;
  voted?: boolean;
  redirectIfVoted?: boolean;
}) {
  useVoterIdSync(currentId, { voted, redirectIfVoted });
  return null;
}
