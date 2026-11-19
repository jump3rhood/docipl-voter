// @vitest-environment jsdom
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
  expect(screen.getByText('Live results · updates every 15 seconds')).toBeInTheDocument();
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
    await vi.advanceTimersByTimeAsync(15000);
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
    await vi.advanceTimersByTimeAsync(15000);
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
