export type VotingState = 'before' | 'open' | 'paused' | 'closed';

export function deriveVotingState(
  cfg: { start: Date; end: Date; enabled: boolean },
  now: Date,
): VotingState {
  if (now >= cfg.end) return 'closed';
  if (now >= cfg.start) return cfg.enabled ? 'open' : 'paused';
  return 'before';
}
