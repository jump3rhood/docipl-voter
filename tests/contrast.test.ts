import { expect, test } from 'vitest';
import { pickTextColor } from '@/lib/contrast';

test('light accents get navy text', () => {
  expect(pickTextColor('#E5E7EB')).toBe('#0B2A5B');
  expect(pickTextColor('#84CC16')).toBe('#0B2A5B');
  expect(pickTextColor('#22C55E')).toBe('#0B2A5B');
  expect(pickTextColor('#FFD21F')).toBe('#0B2A5B');
});

test('dark accents get white text', () => {
  expect(pickTextColor('#EF4444')).toBe('#FFFFFF');
  expect(pickTextColor('#3B82F6')).toBe('#FFFFFF');
  expect(pickTextColor('#6366F1')).toBe('#FFFFFF');
  expect(pickTextColor('#000000')).toBe('#FFFFFF');
});

test('accepts 3-digit and no-hash hex, falls back to white on junk', () => {
  expect(pickTextColor('fff')).toBe('#0B2A5B');
  expect(pickTextColor('#000')).toBe('#FFFFFF');
  expect(pickTextColor('nonsense')).toBe('#FFFFFF');
});
