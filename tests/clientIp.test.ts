import { expect, test } from 'vitest';
import { getClientIp } from '@/lib/clientIp';

test('first x-forwarded-for entry, trimmed', () => {
  expect(getClientIp(new Headers({ 'x-forwarded-for': ' 1.2.3.4 , 10.0.0.1' }))).toBe('1.2.3.4');
});
test('falls back to x-real-ip', () => {
  expect(getClientIp(new Headers({ 'x-real-ip': '5.6.7.8' }))).toBe('5.6.7.8');
});
test('null when absent', () => {
  expect(getClientIp(new Headers())).toBeNull();
});
