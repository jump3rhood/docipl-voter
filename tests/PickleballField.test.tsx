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
    {
      get: (_t, key) =>
        key === 'createRadialGradient' ? () => ({ addColorStop: () => undefined }) : () => undefined,
      set: () => true,
    },
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

function pointer(type: string, el: Element, x: number, y: number, id = 1) {
  const e = new MouseEvent(type, { bubbles: true, clientX: x, clientY: y });
  Object.defineProperty(e, 'pointerId', { value: id });
  el.dispatchEvent(e);
}

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

  const b = document.getElementById('b')!;
  const d = document.getElementById('d')!;
  const tap = (el: Element) => {
    pointer('pointerdown', el, 50, 50);
    pointer('pointerup', el, 52, 53);
  };
  tap(b);
  expect(flick).not.toHaveBeenCalled();
  pointer('pointerdown', d, 50, 50);
  expect(flick).not.toHaveBeenCalled();
  pointer('pointerup', d, 52, 53);
  expect(flick).toHaveBeenCalledTimes(1);
  expect(flick).toHaveBeenLastCalledWith(expect.any(Array), 52, 53);

  field.unmount();
  expect(caf).toHaveBeenCalledWith(7);
  expect(remove.mock.calls.map(([t]) => t)).toEqual(
    expect.arrayContaining(['resize', 'pointerdown', 'pointerup', 'pointercancel']),
  );
  tap(d);
  expect(flick).toHaveBeenCalledTimes(1);
  unmount();
});

test('drags and scrolls (>= 10px movement or pointercancel) do not flick', () => {
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(fakeCtx());
  vi.spyOn(window, 'requestAnimationFrame').mockReturnValue(1);
  const { unmount } = render(<div id="d">y</div>);
  const field = render(<PickleballField />);
  const d = document.getElementById('d')!;

  pointer('pointerdown', d, 50, 50);
  pointer('pointerup', d, 50, 60);
  expect(flick).not.toHaveBeenCalled();

  pointer('pointerdown', d, 50, 50, 2);
  pointer('pointercancel', d, 50, 50, 2);
  pointer('pointerup', d, 50, 50, 2);
  expect(flick).not.toHaveBeenCalled();

  // pointers are tracked independently
  pointer('pointerdown', d, 10, 10, 3);
  pointer('pointerdown', d, 200, 200, 4);
  pointer('pointerup', d, 300, 300, 4);
  pointer('pointerup', d, 12, 12, 3);
  expect(flick).toHaveBeenCalledTimes(1);
  expect(flick).toHaveBeenLastCalledWith(expect.any(Array), 12, 12);

  field.unmount();
  unmount();
});

test('resize events are coalesced into one animation frame', () => {
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(fakeCtx());
  Object.defineProperty(window, 'requestIdleCallback', { value: () => 1, configurable: true });
  Object.defineProperty(window, 'cancelIdleCallback', { value: () => {}, configurable: true });
  const raf = vi.spyOn(window, 'requestAnimationFrame').mockReturnValue(3);
  const field = render(<PickleballField />);
  expect(raf).not.toHaveBeenCalled();
  for (let i = 0; i < 5; i++) window.dispatchEvent(new Event('resize'));
  expect(raf).toHaveBeenCalledTimes(1);
  field.unmount();
});
