import { describe, expect, test } from 'vitest';
import { dateToIstLocal, istLocalToDate } from '@/lib/ist';

describe('ist', () => {
  test('istLocalToDate converts IST wall time to UTC', () => {
    expect(istLocalToDate('2026-11-21T09:00').toISOString()).toBe('2026-11-21T03:30:00.000Z');
  });
  test('dateToIstLocal renders IST wall time', () => {
    expect(dateToIstLocal(new Date('2026-11-22T15:30:00Z'))).toBe('2026-11-22T21:00');
  });
  test('invalid input throws', () => {
    expect(() => istLocalToDate('nope')).toThrow();
    expect(() => istLocalToDate('2026-13-40T99:00')).toThrow();
    expect(() => istLocalToDate('2026-11-21')).toThrow();
  });
});
