import { describe, expect, test } from 'vitest';
import { formatPercent, formatVotes, medalFor, totalLabel } from '@/lib/resultsFormat';

describe('resultsFormat', () => {
  test('medalFor', () => {
    expect(medalFor({ rank: 1, votes: 5 })).toBe('🥇');
    expect(medalFor({ rank: 2, votes: 5 })).toBe('🥈');
    expect(medalFor({ rank: 3, votes: 1 })).toBe('🥉');
    expect(medalFor({ rank: 1, votes: 0 })).toBeNull();
    expect(medalFor({ rank: 4, votes: 9 })).toBeNull();
  });
  test('ties share medal', () => {
    const rows = [
      { rank: 1, votes: 3 },
      { rank: 1, votes: 3 },
      { rank: 3, votes: 1 },
    ];
    expect(rows.map(medalFor)).toEqual(['🥇', '🥇', '🥉']);
  });
  test('formatVotes en-IN', () => {
    expect(formatVotes(1284)).toBe('1,284');
    expect(formatVotes(100000)).toBe('1,00,000');
  });
  test('formatPercent', () => {
    expect(formatPercent(37.5)).toBe('37.5%');
    expect(formatPercent(0)).toBe('0.0%');
    expect(formatPercent(100)).toBe('100.0%');
  });
  test('totalLabel', () => {
    expect(totalLabel(1)).toBe('1 vote cast');
    expect(totalLabel(1284)).toBe('1,284 votes cast');
  });
});
