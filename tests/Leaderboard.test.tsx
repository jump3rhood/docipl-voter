// @vitest-environment jsdom
import { StrictMode } from 'react';
import { render, screen, act } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { Leaderboard } from '@/components/Leaderboard';
import type { ResultRow, ResultsPayload } from '@/lib/resultsFormat';

function row(over: Partial<ResultRow>): ResultRow {
  return {
    teamId: over.slug ?? 'x',
    name: 'Team',
    slug: 'x',
    logoUrl: null,
    accentColor: null,
    votes: 0,
    percent: 0,
    rank: 1,
    ...over,
  };
}

const payload: ResultsPayload = {
  total: 4,
  rows: [
    row({ slug: 'code-red', name: 'Code Red', votes: 3, percent: 75, rank: 1 }),
    row({ slug: 'jager', name: 'Jager', votes: 1, percent: 25, rank: 2 }),
    row({ slug: 'zeta', name: 'Zeta', votes: 0, percent: 0, rank: 3 }),
    row({ slug: 'omega', name: 'Omega', votes: 0, percent: 0, rank: 3 }),
  ],
};

function setVisibility(v: 'visible' | 'hidden') {
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => v });
}

beforeEach(() => {
  vi.useFakeTimers();
  setVisibility('visible');
});
afterEach(() => {
  vi.useRealTimers();
});

const never = (() => new Promise(() => {})) as unknown as typeof fetch;

test('renders rows in order with medals, votes and percent', () => {
  render(<Leaderboard initial={payload} state="open" fetchImpl={never} />);
  const items = screen.getAllByRole('listitem');
  expect(items).toHaveLength(4);
  expect(items[0]).toHaveTextContent('🥇');
  expect(items[0]).toHaveTextContent('Code Red');
  expect(items[0]).toHaveTextContent('3');
  expect(items[0]).toHaveTextContent('75.0%');
  expect(items[1]).toHaveTextContent('🥈');
  expect(items[2]).toHaveTextContent('#3');
  expect(items[2]).not.toHaveTextContent('🥉');
});

test('zero votes: no medals', () => {
  const zero: ResultsPayload = {
    total: 0,
    rows: payload.rows.map((r) => ({ ...r, votes: 0, percent: 0, rank: 1 })),
  };
  render(<Leaderboard initial={zero} state="open" fetchImpl={never} />);
  expect(document.body.textContent).not.toMatch(/[🥇🥈🥉]/u);
  expect(screen.getByText('No votes yet.')).toBeInTheDocument();
  expect(screen.getByText('0 votes cast')).toBeInTheDocument();
});

test('subheading by state', () => {
  const { unmount } = render(<Leaderboard initial={payload} state="open" fetchImpl={never} />);
  expect(screen.getByText('Live results · updates every 30 seconds')).toBeInTheDocument();
  const link = screen.getByRole('link', { name: 'VOTE NOW' });
  expect(link).toHaveAttribute('href', '/v');
  expect(link.tagName).toBe('A');
  unmount();
  render(<Leaderboard initial={payload} state="closed" fetchImpl={never} />);
  expect(screen.getByText('Final results')).toBeInTheDocument();
  expect(screen.queryByRole('link', { name: 'VOTE NOW' })).toBeNull();
});

test('polls and updates', async () => {
  const next: ResultsPayload = { ...payload, total: 9 };
  const fetchImpl = vi.fn(async () => ({ ok: true, json: async () => next }) as Response);
  render(<Leaderboard initial={payload} state="open" fetchImpl={fetchImpl as unknown as typeof fetch} />);
  await act(async () => {
    await vi.advanceTimersByTimeAsync(30000);
  });
  expect(fetchImpl).toHaveBeenCalled();
  expect(screen.getByText('9 votes cast')).toBeInTheDocument();
});

test('poll failure keeps data', async () => {
  const fetchImpl = vi.fn(async () => {
    throw new Error('network');
  });
  render(<Leaderboard initial={payload} state="open" fetchImpl={fetchImpl as unknown as typeof fetch} />);
  await act(async () => {
    await vi.advanceTimersByTimeAsync(30000);
  });
  expect(fetchImpl).toHaveBeenCalled();
  expect(screen.getByText('Code Red')).toBeInTheDocument();
  expect(screen.getByText('4 votes cast')).toBeInTheDocument();
  expect(screen.queryByText(/error|fail|unavailable/i)).toBeNull();
});

test('no polling while hidden', async () => {
  setVisibility('hidden');
  const fetchImpl = vi.fn(async () => ({ ok: true, json: async () => payload }) as Response);
  render(<Leaderboard initial={payload} state="open" fetchImpl={fetchImpl as unknown as typeof fetch} />);
  await act(async () => {
    await vi.advanceTimersByTimeAsync(30000);
  });
  expect(fetchImpl).not.toHaveBeenCalled();
});

// ---- single-flight polling loop ----

function hide() {
  setVisibility('hidden');
  document.dispatchEvent(new Event('visibilitychange'));
}
function show() {
  setVisibility('visible');
  document.dispatchEvent(new Event('visibilitychange'));
}

function deferredFetch(bodyFor: (n: number) => unknown = () => payload) {
  const pending: Array<() => void> = [];
  let n = 0;
  const fn = vi.fn((_url: string, init?: RequestInit) => {
    const body = bodyFor(++n);
    return new Promise<Response>((resolve, reject) => {
      init?.signal?.addEventListener('abort', () =>
        reject(new DOMException('aborted', 'AbortError')),
      );
      pending.push(() => resolve({ ok: true, json: async () => body } as Response));
    });
  });
  const resolveAll = async () => {
    await act(async () => {
      pending.splice(0).forEach((r) => r());
      await vi.advanceTimersByTimeAsync(0);
    });
  };
  return { fn, impl: fn as unknown as typeof fetch, resolveAll };
}

async function advance(ms: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

test('resolving polls: exactly one fetch per interval, each applied', async () => {
  const f = deferredFetch((n) => ({ ...payload, total: 100 + n }));
  render(<Leaderboard initial={payload} state="open" fetchImpl={f.impl} />);
  for (let i = 1; i <= 4; i++) {
    await advance(30000);
    await f.resolveAll();
    expect(screen.getByText(`${100 + i} votes cast`)).toBeInTheDocument();
  }
  expect(f.fn).toHaveBeenCalledTimes(4);
  expect(f.fn).toHaveBeenLastCalledWith(
    '/api/results',
    expect.objectContaining({ cache: 'no-store', signal: expect.any(AbortSignal) }),
  );
});

test('StrictMode: one fetch per interval', async () => {
  const f = deferredFetch();
  render(
    <StrictMode>
      <Leaderboard initial={payload} state="open" fetchImpl={f.impl} />
    </StrictMode>,
  );
  for (let i = 1; i <= 3; i++) {
    await advance(30000);
    expect(f.fn).toHaveBeenCalledTimes(i);
    await f.resolveAll();
  }
});

test('hidden→visible during an in-flight poll does not fork the loop', async () => {
  const f = deferredFetch();
  render(<Leaderboard initial={payload} state="open" fetchImpl={f.impl} />);
  await advance(30000);
  expect(f.fn).toHaveBeenCalledTimes(1);
  act(() => {
    hide();
    show();
  });
  expect(f.fn).toHaveBeenCalledTimes(2);
  await f.resolveAll();
  await advance(30000);
  await f.resolveAll();
  await advance(30000);
  await f.resolveAll();
  expect(f.fn).toHaveBeenCalledTimes(4);
});

test('visible→visible event during an in-flight poll does not fork the loop', async () => {
  const f = deferredFetch();
  render(<Leaderboard initial={payload} state="open" fetchImpl={f.impl} />);
  await advance(30000);
  act(() => {
    show();
  });
  expect(f.fn).toHaveBeenCalledTimes(2);
  await f.resolveAll();
  await advance(30000);
  await f.resolveAll();
  await advance(30000);
  await f.resolveAll();
  expect(f.fn).toHaveBeenCalledTimes(4);
});

test('unmount with a fetch in flight stops polling without warnings', async () => {
  const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  const f = deferredFetch();
  const { unmount } = render(<Leaderboard initial={payload} state="open" fetchImpl={f.impl} />);
  await advance(30000);
  expect(f.fn).toHaveBeenCalledTimes(1);
  unmount();
  await f.resolveAll();
  await advance(60000);
  expect(f.fn).toHaveBeenCalledTimes(1);
  expect(errSpy).not.toHaveBeenCalled();
  errSpy.mockRestore();
});

test('hidden skips fetches; resumes on next tick once visible even without an event', async () => {
  setVisibility('hidden');
  const f = deferredFetch();
  render(<Leaderboard initial={payload} state="open" fetchImpl={f.impl} />);
  await advance(30000);
  expect(f.fn).toHaveBeenCalledTimes(0);
  setVisibility('visible');
  await advance(30000);
  expect(f.fn).toHaveBeenCalledTimes(1);
});

test('malformed payload is ignored without crashing', async () => {
  const bad = {
    total: 9,
    rows: [{ ...payload.rows[0], percent: 'x' }],
  };
  const fetchImpl = vi.fn(async () => ({ ok: true, json: async () => bad }) as Response);
  render(<Leaderboard initial={payload} state="open" fetchImpl={fetchImpl as unknown as typeof fetch} />);
  await advance(30000);
  expect(fetchImpl).toHaveBeenCalledTimes(1);
  expect(screen.getByText('4 votes cast')).toBeInTheDocument();
  expect(screen.getByText('Code Red')).toBeInTheDocument();
});
