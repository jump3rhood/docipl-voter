import { expect, test } from 'vitest';
import { voteErrorMessage, type VoteErrorCode } from '@/lib/voteMessages';

test('already_voted copy', () => {
  expect(voteErrorMessage('already_voted')).toEqual({
    title: "You've already voted!",
    body: 'Each person can vote only once.',
  });
});

test('network copy', () => {
  expect(voteErrorMessage('network').title).toBe('Something went wrong.');
});

test('every code has a title', () => {
  const codes: VoteErrorCode[] = ['already_voted','voting_not_open','voting_closed','token_invalid','invalid_team','turnstile_failed','rate_limited','network'];
  for (const c of codes) expect(voteErrorMessage(c).title.length).toBeGreaterThan(0);
});
