// @vitest-environment jsdom
import { render, waitFor } from '@testing-library/react';
import { StrictMode } from 'react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { markCelebrate } from '@/lib/celebrate';

const { fire, reset } = vi.hoisted(() => ({ fire: vi.fn(), reset: vi.fn() }));
vi.mock('canvas-confetti', () => ({ default: Object.assign(fire, { reset }) }));

import { Celebration } from '@/components/Celebration';

function mockReducedMotion(reduce: boolean) {
  window.matchMedia = ((q: string) => ({
    matches: reduce && q.includes('reduce'),
    media: q,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    onchange: null,
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
}

beforeEach(() => {
  sessionStorage.clear();
  fire.mockReset();
  reset.mockReset();
  mockReducedMotion(false);
});
afterEach(() => vi.restoreAllMocks());

test('fires confetti when flagged', async () => {
  markCelebrate();
  const { unmount } = render(<Celebration colors={['#111111', '#FFD21F']} />);
  await waitFor(() => expect(fire).toHaveBeenCalledTimes(2));
  expect(fire.mock.calls[0][0]).toMatchObject({
    particleCount: 60,
    colors: ['#111111', '#FFD21F'],
    disableForReducedMotion: true,
  });
  unmount();
  expect(reset).toHaveBeenCalled();
});

test('fires once under StrictMode', async () => {
  markCelebrate();
  render(
    <StrictMode>
      <Celebration colors={['#111111']} />
    </StrictMode>,
  );
  await waitFor(() => expect(fire).toHaveBeenCalledTimes(2));
  await new Promise((r) => setTimeout(r, 20));
  expect(fire).toHaveBeenCalledTimes(2);
});

test('does not fire without flag', async () => {
  render(<Celebration colors={['#111111']} />);
  await new Promise((r) => setTimeout(r, 20));
  expect(fire).not.toHaveBeenCalled();
});

test('does not fire with reduced motion', async () => {
  markCelebrate();
  mockReducedMotion(true);
  render(<Celebration colors={['#111111']} />);
  await new Promise((r) => setTimeout(r, 20));
  expect(fire).not.toHaveBeenCalled();
});

test('unmount before import resolves does not fire', async () => {
  markCelebrate();
  const { unmount } = render(<Celebration colors={['#111111']} />);
  unmount();
  await new Promise((r) => setTimeout(r, 20));
  expect(fire).not.toHaveBeenCalled();
});
