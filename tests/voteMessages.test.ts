import { expect, test } from 'vitest';
import { voteErrorMessage, VOTE_ERROR_CODES } from '@/lib/voteMessages';

test('already_voted copy', () => {
  expect(voteErrorMessage('already_voted')).toEqual({
    title: "You've already voted!",
    body: 'Each person can vote only once.',
  });
});

test('network copy', () => {
  expect(voteErrorMessage('network').title).toBe('Something went wrong.');
});

test('voting_not_open copy covers paused voting', () => {
  expect(voteErrorMessage('voting_not_open')).toEqual({
    title: "Voting isn't open right now.",
    body: 'Check back soon.',
  });
});

test('every code has a non-empty title', () => {
  for (const c of VOTE_ERROR_CODES) expect(voteErrorMessage(c).title.length).toBeGreaterThan(0);
});
