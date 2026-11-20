// @vitest-environment jsdom
import { test, expect, vi, beforeEach } from 'vitest';
import { act, fireEvent, render, screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { AdminTeam } from '@/lib/admin';

const reorderTeamsAction = vi.fn();
vi.mock('@/app/admin/(protected)/teams/actions', () => ({
  reorderTeamsAction: (ids: string[]) => reorderTeamsAction(ids),
  createTeamAction: vi.fn(),
  updateTeamAction: vi.fn(),
}));

import { Reorder } from 'framer-motion';
import { TeamList } from '@/app/admin/(protected)/teams/TeamList';
import { MotionProvider } from '@/components/MotionProvider';

const teams: AdminTeam[] = [
  { id: 'a', name: 'Alpha Smash', slug: 'alpha', logoUrl: null, accentColor: '#ff0000', displayOrder: 1, isActive: true },
  { id: 'b', name: 'Bravo Dinks', slug: 'bravo', logoUrl: null, accentColor: null, displayOrder: 2, isActive: false },
  { id: 'c', name: 'Charlie Lobs', slug: 'charlie', logoUrl: null, accentColor: '#00ff00', displayOrder: 3, isActive: true },
];

function rowNames() {
  return screen.getAllByRole('listitem').map((li) => within(li).getByTestId('team-name').textContent);
}

beforeEach(() => {
  reorderTeamsAction.mockReset();
  document.body.style.overflow = '';
});

test('renders rows in order with Live/Hidden pills', () => {
  render(<TeamList teams={teams} />);
  expect(rowNames()).toEqual(['Alpha Smash', 'Bravo Dinks', 'Charlie Lobs']);
  const rows = screen.getAllByRole('listitem');
  expect(within(rows[0]).getByText('Live')).toBeInTheDocument();
  expect(within(rows[1]).getByText('Hidden')).toBeInTheDocument();
  expect(within(rows[2]).getByText('Live')).toBeInTheDocument();
  const handle = within(rows[0]).getByTestId('drag-handle');
  expect(handle).toHaveAttribute('aria-hidden', 'true');
  expect(handle.style.touchAction).toBe('none');
});

test('move down calls reorderTeamsAction with swapped ids and announces Order saved', async () => {
  reorderTeamsAction.mockResolvedValue({ ok: true });
  render(<TeamList teams={teams} />);
  await userEvent.click(screen.getByRole('button', { name: 'Move Alpha Smash down' }));
  expect(reorderTeamsAction).toHaveBeenCalledWith(['b', 'a', 'c']);
  expect(rowNames()).toEqual(['Bravo Dinks', 'Alpha Smash', 'Charlie Lobs']);
  await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Order saved'));
});

test('first row move up disabled, last row move down disabled', () => {
  render(<TeamList teams={teams} />);
  expect(screen.getByRole('button', { name: 'Move Alpha Smash up' })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Move Alpha Smash down' })).toBeEnabled();
  expect(screen.getByRole('button', { name: 'Move Charlie Lobs up' })).toBeEnabled();
  expect(screen.getByRole('button', { name: 'Move Charlie Lobs down' })).toBeDisabled();
});

test('reorder error shows message and restores order', async () => {
  reorderTeamsAction.mockResolvedValue({ error: 'The team list changed. Reload and try again.' });
  render(<TeamList teams={teams} />);
  await userEvent.click(screen.getByRole('button', { name: 'Move Charlie Lobs up' }));
  expect(reorderTeamsAction).toHaveBeenCalledWith(['a', 'c', 'b']);
  await waitFor(() =>
    expect(screen.getByRole('status')).toHaveTextContent('The team list changed. Reload and try again.'),
  );
  expect(rowNames()).toEqual(['Alpha Smash', 'Bravo Dinks', 'Charlie Lobs']);
});

test('tapping a row opens the editor titled Edit {name}', async () => {
  render(<TeamList teams={teams} />);
  await userEvent.click(screen.getByRole('button', { name: /^Bravo Dinks/ }));
  const dialog = await screen.findByRole('dialog');
  expect(within(dialog).getByRole('heading', { name: 'Edit Bravo Dinks' })).toBeInTheDocument();
});

test('Add team opens editor titled Add team', async () => {
  render(<TeamList teams={teams} />);
  await userEvent.click(screen.getByRole('button', { name: /Add team/ }));
  const dialog = await screen.findByRole('dialog');
  expect(within(dialog).getByRole('heading', { name: 'Add team' })).toBeInTheDocument();
});

test('reordering is locked while a save is in flight, so saves never overlap', async () => {
  let resolve!: (v: { ok: true }) => void;
  reorderTeamsAction.mockReturnValueOnce(new Promise((r) => (resolve = r)));
  render(<TeamList teams={teams} />);
  await userEvent.click(screen.getByRole('button', { name: 'Move Alpha Smash down' }));
  expect(screen.getByRole('status')).toHaveTextContent('Saving…');
  for (const b of screen.getAllByRole('button', { name: /^Move / })) expect(b).toBeDisabled();
  // Even a direct click (e.g. a double tap before re-render) is refused.
  fireEvent.click(screen.getByRole('button', { name: 'Move Alpha Smash up' }));
  expect(reorderTeamsAction).toHaveBeenCalledTimes(1);
  await act(async () => resolve({ ok: true }));
  expect(screen.getByRole('status')).toHaveTextContent('Order saved');
  expect(screen.getByRole('button', { name: 'Move Alpha Smash up' })).toBeEnabled();
  expect(rowNames()).toEqual(['Bravo Dinks', 'Alpha Smash', 'Charlie Lobs']);
});

test('Order saved clears after about 3 seconds', async () => {
  vi.useFakeTimers();
  try {
    reorderTeamsAction.mockResolvedValue({ ok: true });
    render(<TeamList teams={teams} />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Move Alpha Smash down' }));
    });
    expect(screen.getByRole('status')).toHaveTextContent('Order saved');
    await act(async () => {
      vi.advanceTimersByTime(2900);
    });
    expect(screen.getByRole('status')).toHaveTextContent('Order saved');
    await act(async () => {
      vi.advanceTimersByTime(200);
    });
    expect(screen.getByRole('status')).toHaveTextContent('');
  } finally {
    vi.useRealTimers();
  }
});

// Order matters: framer-motion's strict-mode warning is warnOnce per process, so the
// clean case runs first and the negative control (proving the check fires here) second.
test('renders inside the strict root MotionProvider without a LazyMotion strict warning', () => {
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  const error = vi.spyOn(console, 'error').mockImplementation(() => {});
  render(
    <MotionProvider>
      <TeamList teams={teams} />
    </MotionProvider>,
  );
  expect(screen.getAllByRole('listitem')).toHaveLength(3);
  const msgs = [...warn.mock.calls, ...error.mock.calls].flat().join(' ');
  expect(msgs).not.toMatch(/LazyMotion/);
  warn.mockRestore();
  error.mockRestore();
});

test('negative control: Reorder directly under the strict provider does trip the check', () => {
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  render(
    <MotionProvider>
      <Reorder.Group axis="y" values={['x']} onReorder={() => {}}>
        <Reorder.Item value="x">x</Reorder.Item>
      </Reorder.Group>
    </MotionProvider>,
  );
  expect(warn.mock.calls.flat().join(' ')).toMatch(/LazyMotion/);
  warn.mockRestore();
});
