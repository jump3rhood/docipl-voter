export const VOTE_ERROR_CODES = [
  'already_voted',
  'voting_not_open',
  'voting_closed',
  'token_invalid',
  'invalid_team',
  'turnstile_failed',
  'rate_limited',
  'network',
] as const;

export type VoteErrorCode = (typeof VOTE_ERROR_CODES)[number];

const MESSAGES: Record<VoteErrorCode, { title: string; body?: string }> = {
  already_voted: { title: "You've already voted!", body: 'Each person can vote only once.' },
  voting_not_open: { title: "Voting isn't open right now.", body: 'Check back soon.' },
  voting_closed: { title: 'Voting has closed.' },
  token_invalid: { title: 'This ballot link has expired.', body: 'Get a new ballot to vote.' },
  invalid_team: { title: "That team isn't available.", body: 'Please pick another team.' },
  turnstile_failed: { title: 'Please try again.' },
  rate_limited: { title: 'Too many attempts.', body: 'Please wait a minute and try again.' },
  network: { title: 'Something went wrong.', body: 'Check your connection and try again.' },
};

export function voteErrorMessage(code: VoteErrorCode): { title: string; body?: string } {
  return MESSAGES[code];
}
