// @vitest-environment jsdom
import { test, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ConfirmVoteSheet } from '@/components/ConfirmVoteSheet';
import type { Team } from '@/lib/voting';

const team: Team = { id: 't1', name: 'Code Red', slug: 'code-red', logoUrl: null, accentColor: '#00ff00' };

function setup(over: Partial<{ submitting: boolean }> = {}) {
  const onConfirm = vi.fn();
  const onCancel = vi.fn();
  render(
    <ConfirmVoteSheet team={team} open submitting={over.submitting ?? false} onConfirm={onConfirm} onCancel={onCancel} />,
  );
  return { onConfirm, onCancel };
}

test('shows team copy and buttons', () => {
  setup();
  const dialog = screen.getByRole('dialog');
  expect(dialog).toHaveAttribute('aria-modal', 'true');
  expect(screen.getByRole('heading', { name: 'Vote for Code Red?' })).toBeInTheDocument();
  expect(screen.getByText("You can only vote once, and it can't be changed.")).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'YES, CAST MY VOTE' })).toBeEnabled();
  expect(screen.getByRole('button', { name: 'Change my pick' })).toBeInTheDocument();
});

test('Change my pick calls onCancel', async () => {
  const { onCancel } = setup();
  await userEvent.click(screen.getByRole('button', { name: 'Change my pick' }));
  expect(onCancel).toHaveBeenCalledTimes(1);
});

test('Escape calls onCancel', async () => {
  const { onCancel } = setup();
  await userEvent.keyboard('{Escape}');
  expect(onCancel).toHaveBeenCalledTimes(1);
});

test('sheet cannot be dismissed while submitting', async () => {
  const { onCancel } = setup({ submitting: true });
  await userEvent.keyboard('{Escape}');
  await userEvent.click(screen.getByRole('button', { name: 'Close', hidden: true }));
  expect(onCancel).not.toHaveBeenCalled();
  const yes = screen.getByRole('button', { name: /submitting/i });
  expect(yes).toBeDisabled();
});

test('focus moves to YES on open', () => {
  setup();
  expect(screen.getByRole('button', { name: 'YES, CAST MY VOTE' })).toHaveFocus();
});

test('Tab cycles within the sheet', async () => {
  setup();
  await userEvent.tab();
  expect(screen.getByRole('button', { name: 'Change my pick' })).toHaveFocus();
  await userEvent.tab();
  expect(screen.getByRole('button', { name: 'YES, CAST MY VOTE' })).toHaveFocus();
});
