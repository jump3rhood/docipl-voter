import { describe, expect, test } from 'vitest';
import { toCsv } from '@/lib/csv';

describe('toCsv', () => {
  test('header and rows use CRLF', () => {
    expect(toCsv(['a', 'b'], [['x', 1]])).toBe('a,b\r\nx,1\r\n');
  });
  test('quotes commas, quotes and newlines', () => {
    expect(toCsv(['t'], [['a,b'], ['say "hi"'], ['l1\nl2']])).toBe('t\r\n"a,b"\r\n"say ""hi"""\r\n"l1\nl2"\r\n');
  });
  test('guards formula injection', () => {
    expect(toCsv(['t'], [['=1+1'], ['+x'], ['-x'], ['@x']])).toBe("t\r\n'=1+1\r\n'+x\r\n'-x\r\n'@x\r\n");
  });
});
