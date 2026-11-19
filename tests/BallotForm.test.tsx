// @vitest-environment jsdom
import { test, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BallotForm, type SubmitResult } from '@/components/BallotForm';
import type { Team } from '@/lib/voting';

const teams: Team[] = [
  { id: 'id-smash', name: 'Smash Squad 2.0', slug: 'smash-squad', logoUrl: null, accentColor: '#ff0000' },
  { id: 'id-dink', name: 'Dink N Drive', slug: 'dink-n-drive', logoUrl: null, accentColor: null },
  { id: 'id-code-red', name: 'Code Red', slug: 'code-red', logoUrl: null, accentColor: '#00ff00' },
];

const okSubmit = () => vi.fn(async (): Promise<SubmitResult> => ({ ok: true, teamName: 'Code Red' }));
const voteButton = () => screen.getByRole('button', { name: /cast my vote|submitting/i });

test('button disabled until a team is selected', async () => {
  render(<BallotForm teams={teams} submit={okSubmit()} onVoted={vi.fn()} />);
  expect(voteButton()).toBeDisabled();
  await userEvent.click(screen.getByRole('radio', { name: /code red/i }));
  expect(voteButton()).toBeEnabled();
});

test('selecting a card marks it checked and only one', async () => {
  render(<BallotForm teams={teams} submit={okSubmit()} onVoted={vi.fn()} />);
  const a = screen.getByRole('radio', { name: /smash squad/i });
  const b = screen.getByRole('radio', { name: /code red/i });
  await userEvent.click(a);
  await userEvent.click(b);
  expect(b).toHaveAttribute('aria-checked', 'true');
  expect(a).toHaveAttribute('aria-checked', 'false');
});

test('renders initials when no logo', () => {
  render(<BallotForm teams={teams} submit={okSubmit()} onVoted={vi.fn()} />);
  expect(screen.getByText('DN')).toBeInTheDocument();
  expect(screen.getByText('SS')).toBeInTheDocument();
});

test('submits selected team and calls onVoted', async () => {
  const submit = okSubmit();
  const onVoted = vi.fn();
  render(<BallotForm teams={teams} submit={submit} onVoted={onVoted} />);
  await userEvent.click(screen.getByRole('radio', { name: /code red/i }));
  await userEvent.click(voteButton());
  expect(submit).toHaveBeenCalledWith('id-code-red');
  expect(onVoted).toHaveBeenCalledWith('Code Red');
});

test('submits once on double click', async () => {
  const submit = vi.fn(
    () => new Promise<SubmitResult>((r) => setTimeout(() => r({ ok: true, teamName: 'X' }), 50)),
  );
  render(<BallotForm teams={teams} submit={submit} onVoted={vi.fn()} />);
  await userEvent.click(screen.getByRole('radio', { name: /code red/i }));
  await userEvent.dblClick(voteButton());
  expect(submit).toHaveBeenCalledTimes(1);
});

test('shows error and keeps selection', async () => {
  const submit = vi.fn(async (): Promise<SubmitResult> => ({ ok: false, code: 'already_voted' }));
  render(<BallotForm teams={teams} submit={submit} onVoted={vi.fn()} />);
  const card = screen.getByRole('radio', { name: /code red/i });
  await userEvent.click(card);
  await userEvent.click(voteButton());
  expect(await screen.findByRole('alert')).toHaveTextContent("You've already voted!");
  expect(card).toHaveAttribute('aria-checked', 'true');
  expect(voteButton()).toBeEnabled();
});

test('token_invalid shows new ballot link', async () => {
  const submit = vi.fn(async (): Promise<SubmitResult> => ({ ok: false, code: 'token_invalid' }));
  render(<BallotForm teams={teams} submit={submit} onVoted={vi.fn()} />);
  await userEvent.click(screen.getByRole('radio', { name: /code red/i }));
  await userEvent.click(voteButton());
  const link = await screen.findByRole('link', { name: 'Get a new ballot' });
  expect(link).toHaveAttribute('href', '/v');
});
