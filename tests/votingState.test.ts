import { describe, expect, test } from 'vitest';
import { deriveVotingState } from '@/lib/votingState';

const s = new Date('2026-11-21T03:30:00Z');
const e = new Date('2026-11-22T15:30:00Z');

describe('deriveVotingState', () => {
  test.each([
    [true, '2026-11-21T03:29:59Z', 'before'],
    [true, '2026-11-21T03:30:00Z', 'open'],
    [false, '2026-11-21T10:00:00Z', 'paused'],
    [false, '2026-11-20T10:00:00Z', 'before'],
    [true, '2026-11-22T15:30:00Z', 'closed'],
    [false, '2026-11-23T00:00:00Z', 'closed'],
  ])('enabled=%s at %s → %s', (enabled, now, want) =>
    expect(deriveVotingState({ start: s, end: e, enabled }, new Date(now))).toBe(want),
  );
});
