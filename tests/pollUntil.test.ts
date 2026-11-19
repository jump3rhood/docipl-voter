import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { pollUntil } from '@/lib/pollUntil';

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

test('calls onReady with the value as soon as check returns one', () => {
  const box: { value?: string } = {};
  const onReady = vi.fn();
  const onTimeout = vi.fn();
  pollUntil(() => box.value, { intervalMs: 50, timeoutMs: 1000, onReady, onTimeout });
  vi.advanceTimersByTime(200);
  expect(onReady).not.toHaveBeenCalled();
  box.value = 'api';
  vi.advanceTimersByTime(50);
  expect(onReady).toHaveBeenCalledWith('api');
  vi.advanceTimersByTime(5000);
  expect(onReady).toHaveBeenCalledTimes(1);
  expect(onTimeout).not.toHaveBeenCalled();
});

test('ready immediately -> synchronous onReady', () => {
  const onReady = vi.fn();
  pollUntil(() => 1, { intervalMs: 50, timeoutMs: 1000, onReady, onTimeout: vi.fn() });
  expect(onReady).toHaveBeenCalledWith(1);
});

test('gives up after timeoutMs and stops polling', () => {
  const check = vi.fn(() => undefined);
  const onTimeout = vi.fn();
  pollUntil(check, { intervalMs: 50, timeoutMs: 1000, onReady: vi.fn(), onTimeout });
  vi.advanceTimersByTime(999);
  expect(onTimeout).not.toHaveBeenCalled();
  vi.advanceTimersByTime(1);
  expect(onTimeout).toHaveBeenCalledTimes(1);
  const calls = check.mock.calls.length;
  vi.advanceTimersByTime(5000);
  expect(check.mock.calls.length).toBe(calls);
  expect(onTimeout).toHaveBeenCalledTimes(1);
});

test('cancel stops everything', () => {
  const onReady = vi.fn();
  const onTimeout = vi.fn();
  const box: { value?: number } = {};
  const cancel = pollUntil(() => box.value, { intervalMs: 50, timeoutMs: 1000, onReady, onTimeout });
  cancel();
  box.value = 1;
  vi.advanceTimersByTime(5000);
  expect(onReady).not.toHaveBeenCalled();
  expect(onTimeout).not.toHaveBeenCalled();
});
