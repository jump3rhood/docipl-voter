// @vitest-environment jsdom
import { test, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

let pathname = '/admin/teams';
vi.mock('next/navigation', () => ({ usePathname: () => pathname }));

import { AdminNav } from '@/components/admin/AdminNav';

const logout = (
  <form>
    <button type="submit">Log out</button>
  </form>
);

beforeEach(() => {
  pathname = '/admin/teams';
  document.body.style.overflow = '';
});

test('shows current page label and marks link current', async () => {
  render(<AdminNav logout={logout} />);
  expect(screen.getByTestId('admin-nav-label')).toHaveTextContent('Teams');
  await userEvent.click(screen.getByRole('button', { name: 'Open menu' }));
  expect(screen.getByRole('link', { name: 'Teams' })).toHaveAttribute('aria-current', 'page');
  expect(screen.getByRole('link', { name: 'Dashboard' })).not.toHaveAttribute('aria-current');
});

test('dashboard matches only exactly; sub-paths match their section', () => {
  pathname = '/admin/teams/abc/edit';
  const { unmount } = render(<AdminNav logout={logout} />);
  expect(screen.getByTestId('admin-nav-label')).toHaveTextContent('Teams');
  unmount();
  pathname = '/admin';
  render(<AdminNav logout={logout} />);
  expect(screen.getByTestId('admin-nav-label')).toHaveTextContent('Dashboard');
});

async function open() {
  const burger = screen.getByRole('button', { name: 'Open menu' });
  await userEvent.click(burger);
  expect(screen.getByRole('dialog', { name: 'Admin menu' })).toHaveAttribute('aria-modal', 'true');
  expect(document.body.style.overflow).toBe('hidden');
  return burger;
}

test.each([
  ['Escape', async () => userEvent.keyboard('{Escape}')],
  ['backdrop', async () => userEvent.click(screen.getByTestId('admin-nav-backdrop'))],
  ['link', async () => userEvent.click(screen.getByRole('link', { name: 'Voting' }))],
  ['close button', async () => userEvent.click(screen.getByRole('button', { name: 'Close menu' }))],
])('AdminNav closes on %s and restores scroll', async (_n, act) => {
  render(<AdminNav logout={logout} />);
  const burger = await open();
  expect(burger).toHaveAttribute('aria-expanded', 'true');
  await act();
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(document.body.style.overflow).toBe('');
  expect(burger).toHaveFocus();
  expect(burger).toHaveAttribute('aria-expanded', 'false');
});

test('closes on pathname change', async () => {
  const { rerender } = render(<AdminNav logout={logout} />);
  await open();
  pathname = '/admin/results';
  rerender(<AdminNav logout={logout} />);
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(screen.getByTestId('admin-nav-label')).toHaveTextContent('Results');
});

test('focus moves into panel and Tab wraps', async () => {
  render(<AdminNav logout={logout} />);
  await open();
  expect(screen.getByRole('link', { name: 'Dashboard' })).toHaveFocus();
  await userEvent.keyboard('{Shift>}{Tab}{/Shift}');
  expect(screen.getByRole('button', { name: 'Close menu' })).toHaveFocus();
  await userEvent.keyboard('{Shift>}{Tab}{/Shift}');
  expect(screen.getByRole('button', { name: 'Log out' })).toHaveFocus();
  await userEvent.keyboard('{Tab}');
  expect(screen.getByRole('button', { name: 'Close menu' })).toHaveFocus();
});

test('renders logout slot inside panel', async () => {
  render(<AdminNav logout={logout} />);
  await open();
  expect(screen.getByRole('dialog')).toContainElement(screen.getByRole('button', { name: 'Log out' }));
});
