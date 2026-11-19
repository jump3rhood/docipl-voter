// @vitest-environment jsdom
import { act, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TurnstileWidget } from '@/components/TurnstileWidget';

let opts: Record<string, unknown>;

beforeEach(() => {
  vi.useFakeTimers();
  opts = {};
  window.turnstile = {
    render: vi.fn((_c: HTMLElement, o: Record<string, unknown>) => {
      opts = o;
      return 'w1';
    }),
    reset: vi.fn(),
    remove: vi.fn(),
  };
});

afterEach(() => {
  vi.useRealTimers();
  delete window.turnstile;
});

function mount() {
  const onError = vi.fn();
  render(<TurnstileWidget siteKey="k" onToken={() => {}} onError={onError} resetSignal={0} />);
  return onError;
}

describe('TurnstileWidget watchdog', () => {
  it('times out without any interaction', () => {
    const onError = mount();
    act(() => {
      vi.advanceTimersByTime(12_500);
    });
    expect(onError).toHaveBeenCalledWith('timeout');
  });

  it('is paused during an interactive challenge', () => {
    const onError = mount();
    act(() => {
      (opts['before-interactive-callback'] as () => void)();
      vi.advanceTimersByTime(20_000);
    });
    expect(onError).not.toHaveBeenCalled();
  });

  it('restarts after interaction', () => {
    const onError = mount();
    act(() => {
      (opts['before-interactive-callback'] as () => void)();
      vi.advanceTimersByTime(20_000);
      (opts['after-interactive-callback'] as () => void)();
      vi.advanceTimersByTime(12_500);
    });
    expect(onError).toHaveBeenCalledWith('timeout');
  });
});
