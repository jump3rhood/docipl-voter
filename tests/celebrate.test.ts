// @vitest-environment jsdom
import { beforeEach, expect, test } from 'vitest';
import { consumeCelebrate, markCelebrate } from '@/lib/celebrate';

beforeEach(() => sessionStorage.clear());

test('consumeCelebrate returns true once', () => {
  markCelebrate();
  expect(consumeCelebrate()).toBe(true);
  expect(consumeCelebrate()).toBe(false);
});

test('consume without mark is false', () => {
  expect(consumeCelebrate()).toBe(false);
});
