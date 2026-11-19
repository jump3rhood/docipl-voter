// @vitest-environment jsdom
import { test, expect, vi, beforeEach, afterEach } from 'vitest';
import { collectDeviceSignal } from '@/lib/deviceSignal';

beforeEach(() => {
  // jsdom has no canvas 2D context; silence its "not implemented" noise.
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
});
afterEach(() => vi.restoreAllMocks());

test('returns 64-hex string and is stable across calls', async () => {
  const a = await collectDeviceSignal();
  const b = await collectDeviceSignal();
  expect(a).toMatch(/^[0-9a-f]{64}$/);
  expect(b).toBe(a);
});

test('returns null when crypto.subtle throws', async () => {
  vi.spyOn(crypto.subtle, 'digest').mockRejectedValue(new Error('nope'));
  expect(await collectDeviceSignal()).toBeNull();
});
