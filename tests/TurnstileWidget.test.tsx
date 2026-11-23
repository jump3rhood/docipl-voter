// @vitest-environment jsdom
import { act, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TurnstileWidget } from '@/components/TurnstileWidget';

let opts: Record<string, unknown>;
let api: NonNullable<Window['turnstile']>;

beforeEach(() => {
  vi.useFakeTimers();
  opts = {};
  api = {
    render: vi.fn((_c: HTMLElement, o: Record<string, unknown>) => {
      opts = o;
      return 'w1';
    }),
    reset: vi.fn(),
    remove: vi.fn(),
  };
  window.turnstile = api;
});

afterEach(() => {
  vi.useRealTimers();
  delete window.turnstile;
  document.getElementById('cf-turnstile-script')?.remove();
});

function mount() {
  const onError = vi.fn();
  const onInteractive = vi.fn();
  render(
    <TurnstileWidget
      siteKey="k"
      onToken={() => {}}
      onError={onError}
      onInteractive={onInteractive}
      resetSignal={0}
    />,
  );
  return { onError, onInteractive };
}

describe('TurnstileWidget watchdog', () => {
  it('waits 20s for a token before timing out', () => {
    const { onError } = mount();
    act(() => {
      vi.advanceTimersByTime(19_000);
    });
    expect(onError).not.toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(1_500);
    });
    expect(onError).toHaveBeenCalledWith('timeout');
  });

  it('does not reset a running check on timeout, so a late token still arrives', () => {
    const onToken = vi.fn();
    const onError = vi.fn();
    render(<TurnstileWidget siteKey="k" onToken={onToken} onError={onError} resetSignal={0} />);
    act(() => {
      vi.advanceTimersByTime(21_000);
    });
    expect(onError).toHaveBeenCalledWith('timeout');
    expect(api.reset).not.toHaveBeenCalled();
    act(() => {
      (opts.callback as (t: string) => void)('late');
    });
    expect(onToken).toHaveBeenCalledWith('late');
  });

  it('retries once by resetting on an error', () => {
    const { onError } = mount();
    act(() => {
      (opts['error-callback'] as () => void)();
    });
    expect(onError).toHaveBeenCalledWith('error');
    expect(api.reset).toHaveBeenCalledTimes(1);
    act(() => {
      (opts['error-callback'] as () => void)();
    });
    expect(api.reset).toHaveBeenCalledTimes(1);
  });

  it('starts the timer only once the script is ready', () => {
    delete window.turnstile;
    const { onError } = mount();
    act(() => {
      vi.advanceTimersByTime(8_000);
      window.turnstile = api;
      vi.advanceTimersByTime(100);
    });
    expect(api.render).toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(15_000);
    });
    expect(onError).not.toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(5_500);
    });
    expect(onError).toHaveBeenCalledWith('timeout');
  });

  it('reports a slow script after 10s but still renders when it arrives', () => {
    delete window.turnstile;
    const { onError } = mount();
    act(() => {
      vi.advanceTimersByTime(10_500);
    });
    expect(onError).toHaveBeenCalledWith('timeout');
    expect(api.render).not.toHaveBeenCalled();
    act(() => {
      window.turnstile = api;
      vi.advanceTimersByTime(6_000);
    });
    expect(api.render).toHaveBeenCalledTimes(1);
  });

  it('is paused during an interactive challenge and reports it', () => {
    const { onError, onInteractive } = mount();
    act(() => {
      (opts['before-interactive-callback'] as () => void)();
      vi.advanceTimersByTime(30_000);
    });
    expect(onError).not.toHaveBeenCalled();
    expect(onInteractive).toHaveBeenLastCalledWith(true);
  });

  it('restarts after interaction', () => {
    const { onError, onInteractive } = mount();
    act(() => {
      (opts['before-interactive-callback'] as () => void)();
      vi.advanceTimersByTime(30_000);
      (opts['after-interactive-callback'] as () => void)();
      vi.advanceTimersByTime(20_500);
    });
    expect(onInteractive).toHaveBeenLastCalledWith(false);
    expect(onError).toHaveBeenCalledWith('timeout');
  });

  it('does not restart the watchdog after interaction while a token is held', () => {
    const { onError } = mount();
    act(() => {
      (opts.callback as (t: string) => void)('t');
      (opts['after-interactive-callback'] as () => void)();
      vi.advanceTimersByTime(21_000);
    });
    expect(onError).not.toHaveBeenCalled();
  });
});
