// @vitest-environment jsdom
import { render } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';

const pathname = vi.hoisted(() => ({ value: '/' }));
const flick = vi.hoisted(() => vi.fn());
vi.mock('next/navigation', () => ({ usePathname: () => pathname.value }));
vi.mock('@/lib/pickleballs', async (orig) => ({
  ...(await orig<typeof import('@/lib/pickleballs')>()),
  flickAt: flick,
}));

import { PickleballField } from '@/components/PickleballField';

function fakeCtx() {
  return new Proxy(
    {},
    { get: () => () => undefined, set: () => true },
  ) as unknown as CanvasRenderingContext2D;
}

beforeEach(() => {
  pathname.value = '/';
  flick.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

test('PickleballField renders nothing without 2d context', () => {
  const getContext = vi
    .spyOn(HTMLCanvasElement.prototype, 'getContext')
    .mockReturnValue(null);
  const raf = vi.spyOn(window, 'requestAnimationFrame');
  const add = vi.spyOn(window, 'addEventListener');
  const { container } = render(<PickleballField />);
  expect(getContext).toHaveBeenCalled();
  expect(container.querySelector('canvas')?.getAttribute('aria-hidden')).toBe('true');
  expect(raf).not.toHaveBeenCalled();
  expect(add.mock.calls.some(([t]) => t === 'pointerdown')).toBe(false);
});

test('PickleballField hidden on admin', () => {
  pathname.value = '/admin/voting';
  const { container } = render(<PickleballField />);
  expect(container.querySelector('canvas')).toBeNull();
});

test('loop starts after idle, taps flick only on non-interactive targets, unmount cleans up', () => {
  vi.useFakeTimers();
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(fakeCtx());
  Object.defineProperty(window, 'requestIdleCallback', { value: undefined, configurable: true });
  const raf = vi.spyOn(window, 'requestAnimationFrame').mockReturnValue(7);
  const caf = vi.spyOn(window, 'cancelAnimationFrame');
  const remove = vi.spyOn(window, 'removeEventListener');

  const { unmount } = render(
    <div>
      <button id="b">x</button>
      <div id="d">y</div>
    </div>,
  );
  const field = render(<PickleballField />);
  expect(raf).not.toHaveBeenCalled();
  vi.advanceTimersByTime(250);
  expect(raf).toHaveBeenCalledTimes(1);

  const down = (el: Element) =>
    el.dispatchEvent(new Event('pointerdown', { bubbles: true }));
  down(document.getElementById('b')!);
  expect(flick).not.toHaveBeenCalled();
  down(document.getElementById('d')!);
  expect(flick).toHaveBeenCalledTimes(1);

  field.unmount();
  expect(caf).toHaveBeenCalledWith(7);
  expect(remove.mock.calls.map(([t]) => t)).toEqual(
    expect.arrayContaining(['resize', 'pointerdown']),
  );
  down(document.getElementById('d')!);
  expect(flick).toHaveBeenCalledTimes(1);
  unmount();
});
