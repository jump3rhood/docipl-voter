import { expect, test } from 'vitest';
import { formatIST } from '@/lib/formatIST';

test('formats in IST with 12-hour clock', () => {
  expect(formatIST(new Date('2026-11-21T03:30:00Z'))).toBe('Saturday, 21 Nov, 9:00 AM');
  expect(formatIST(new Date('2026-11-22T15:30:00Z'))).toBe('Sunday, 22 Nov, 9:00 PM');
  expect(formatIST(new Date('2026-11-21T18:45:00Z'))).toBe('Sunday, 22 Nov, 12:15 AM');
});
