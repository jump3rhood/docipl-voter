import { expect, test } from 'vitest';
import { getClientIp, ipKey } from '@/lib/clientIp';

test('first x-forwarded-for entry, trimmed', () => {
  expect(getClientIp(new Headers({ 'x-forwarded-for': ' 1.2.3.4 , 10.0.0.1' }))).toBe('1.2.3.4');
});
test('falls back to x-real-ip', () => {
  expect(getClientIp(new Headers({ 'x-real-ip': '5.6.7.8' }))).toBe('5.6.7.8');
});
test('null when absent', () => {
  expect(getClientIp(new Headers())).toBeNull();
});

test('ipKey: IPv4 unchanged', () => {
  expect(ipKey('1.2.3.4')).toBe('1.2.3.4');
});
test('ipKey: IPv4-mapped IPv6 -> IPv4', () => {
  expect(ipKey('::ffff:10.0.0.1')).toBe('10.0.0.1');
  expect(ipKey('::FFFF:10.0.0.1')).toBe('10.0.0.1');
});
test('ipKey: same /64 -> same key', () => {
  expect(ipKey('2001:db8:abcd:12:1::5')).toBe('2001:db8:abcd:12::/64');
  expect(ipKey('2001:db8:abcd:12:ffff::1')).toBe(ipKey('2001:db8:abcd:12:1::5'));
  expect(ipKey('2001:0DB8:ABCD:0012:0:0:0:1')).toBe('2001:db8:abcd:12::/64');
});
test('ipKey: different /64 -> different key', () => {
  expect(ipKey('2001:db8:abcd:13::1')).not.toBe(ipKey('2001:db8:abcd:12::1'));
});
test('ipKey: :: compression in the prefix is expanded', () => {
  expect(ipKey('2001:db8::1')).toBe('2001:db8:0:0::/64');
  expect(ipKey('::1')).toBe('0:0:0:0::/64');
});
test('ipKey: zone id stripped', () => {
  expect(ipKey('fe80::1%eth0')).toBe('fe80:0:0:0::/64');
});
test('ipKey: unknown / garbage passes through', () => {
  expect(ipKey('unknown')).toBe('unknown');
});
