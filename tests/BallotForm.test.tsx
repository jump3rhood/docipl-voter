// @vitest-environment jsdom
import { test, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BallotForm, type SubmitResult } from '@/components/BallotForm';
import type { Team } from '@/lib/voting';

const teams: Team[] = [
  { id: 'id-smash', name: 'Smash Squad 2.0', slug: 'smash-squad', logoUrl: null, accentColor: '#ff0000' },
  { id: 'id-dink', name: 'Dink N Drive', slug: 'dink-n-drive', logoUrl: null, accentColor: null },
  { id: 'id-code-red', name: 'Code Red', slug: 'code-red', logoUrl: null, accentColor: '#00ff00' },
];

const okSubmit = () => vi.fn(async (): Promise<SubmitResult> => ({ ok: true, teamName: 'Code Red' }));
const voteButton = () => screen.getByRole('button', { name: /^(cast my vote|submitting)/i });
const confirmButton = () => screen.getByRole('button', { name: /yes, cast my vote/i });
async function castAndConfirm() {
  await userEvent.click(voteButton());
  await userEvent.click(confirmButton());
}

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
  await castAndConfirm();
  expect(submit).toHaveBeenCalledWith('id-code-red');
  expect(onVoted).toHaveBeenCalledWith('Code Red');
});

test('submits once on double click', async () => {
  const submit = vi.fn(
    () => new Promise<SubmitResult>((r) => setTimeout(() => r({ ok: true, teamName: 'X' }), 50)),
  );
  render(<BallotForm teams={teams} submit={submit} onVoted={vi.fn()} />);
  await userEvent.click(screen.getByRole('radio', { name: /code red/i }));
  await userEvent.click(voteButton());
  await userEvent.dblClick(confirmButton());
  expect(submit).toHaveBeenCalledTimes(1);
});

test('shows error and keeps selection', async () => {
  const submit = vi.fn(async (): Promise<SubmitResult> => ({ ok: false, code: 'rate_limited' }));
  render(<BallotForm teams={teams} submit={submit} onVoted={vi.fn()} />);
  const card = screen.getByRole('radio', { name: /code red/i });
  await userEvent.click(card);
  await castAndConfirm();
  expect(await screen.findByRole('alert')).toHaveTextContent('Too many attempts.');
  expect(card).toHaveAttribute('aria-checked', 'true');
  expect(voteButton()).toBeEnabled();
});

test('token_invalid shows new ballot link', async () => {
  const submit = vi.fn(async (): Promise<SubmitResult> => ({ ok: false, code: 'token_invalid' }));
  render(<BallotForm teams={teams} submit={submit} onVoted={vi.fn()} />);
  await userEvent.click(screen.getByRole('radio', { name: /code red/i }));
  await castAndConfirm();
  const link = await screen.findByRole('link', { name: 'Get a new ballot' });
  expect(link).toHaveAttribute('href', '/v');
});

test.each([
  ['already_voted', 'VIEW LIVE RESULTS', '/results'],
  ['voting_closed', 'VIEW FINAL RESULTS', '/results'],
  ['voting_not_open', 'Back to home', '/'],
] as const)('%s is terminal: escape link and no cast button', async (code, label, href) => {
  const submit = vi.fn(async (): Promise<SubmitResult> => ({ ok: false, code }));
  render(<BallotForm teams={teams} submit={submit} onVoted={vi.fn()} />);
  await userEvent.click(screen.getByRole('radio', { name: /code red/i }));
  await castAndConfirm();
  expect(await screen.findByRole('link', { name: label })).toHaveAttribute('href', href);
  await waitFor(() => expect(screen.queryByRole('button', { name: /cast my vote|submitting/i })).toBeNull());
});

test('retryable errors keep the cast button', async () => {
  const submit = vi.fn(async (): Promise<SubmitResult> => ({ ok: false, code: 'rate_limited' }));
  render(<BallotForm teams={teams} submit={submit} onVoted={vi.fn()} />);
  await userEvent.click(screen.getByRole('radio', { name: /code red/i }));
  await castAndConfirm();
  await screen.findByRole('alert');
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  expect(voteButton()).toBeEnabled();
});

test('token_invalid link is a plain anchor', async () => {
  const submit = vi.fn(async (): Promise<SubmitResult> => ({ ok: false, code: 'token_invalid' }));
  render(<BallotForm teams={teams} submit={submit} onVoted={vi.fn()} />);
  await userEvent.click(screen.getByRole('radio', { name: /code red/i }));
  await castAndConfirm();
  const link = await screen.findByRole('link', { name: 'Get a new ballot' });
  expect(Array.from(link.attributes).map((x) => x.name).sort()).toEqual(['class', 'href']);
});

test('privacy link is present', () => {
  render(<BallotForm teams={teams} submit={okSubmit()} onVoted={vi.fn()} />);
  expect(screen.getByRole('link', { name: 'Privacy' })).toHaveAttribute('href', '/privacy');
});

test('a rejecting submit shows the network message and keeps selection', async () => {
  const submit = vi.fn(async (): Promise<SubmitResult> => {
    throw new Error('boom');
  });
  render(<BallotForm teams={teams} submit={submit} onVoted={vi.fn()} />);
  const card = screen.getByRole('radio', { name: /code red/i });
  await userEvent.click(card);
  await castAndConfirm();
  expect(await screen.findByRole('alert')).toHaveTextContent('Something went wrong.');
  expect(card).toHaveAttribute('aria-checked', 'true');
  expect(voteButton()).toBeEnabled();
});

test('cards are disabled while submitting and ignore clicks', async () => {
  const submit = vi.fn(
    () => new Promise<SubmitResult>((r) => setTimeout(() => r({ ok: true, teamName: 'X' }), 100)),
  );
  render(<BallotForm teams={teams} submit={submit} onVoted={vi.fn()} />);
  const a = screen.getByRole('radio', { name: /code red/i });
  const b = screen.getByRole('radio', { name: /smash squad/i });
  await userEvent.click(a);
  await castAndConfirm();
  expect(b).toHaveAttribute('aria-disabled', 'true');
  await userEvent.click(b);
  expect(a).toHaveAttribute('aria-checked', 'true');
  expect(b).toHaveAttribute('aria-checked', 'false');
});

test('selecting a different team clears the error alert', async () => {
  const submit = vi.fn(async (): Promise<SubmitResult> => ({ ok: false, code: 'rate_limited' }));
  render(<BallotForm teams={teams} submit={submit} onVoted={vi.fn()} />);
  await userEvent.click(screen.getByRole('radio', { name: /code red/i }));
  await castAndConfirm();
  await screen.findByRole('alert');
  await userEvent.click(screen.getByRole('radio', { name: /smash squad/i }));
  expect(screen.queryByRole('alert')).toBeNull();
});

test('canSubmit=false shows Verifying… and blocks submit', async () => {
  const submit = okSubmit();
  render(<BallotForm teams={teams} submit={submit} onVoted={vi.fn()} canSubmit={false} />);
  await userEvent.click(screen.getByRole('radio', { name: /code red/i }));
  const btn = screen.getByRole('button', { name: /verifying/i });
  expect(btn).toBeDisabled();
  await userEvent.click(btn);
  expect(submit).not.toHaveBeenCalled();
});

test('onSubmitFailed called after error result', async () => {
  const onSubmitFailed = vi.fn();
  const submit = vi.fn(async (): Promise<SubmitResult> => ({ ok: false, code: 'rate_limited' }));
  render(<BallotForm teams={teams} submit={submit} onVoted={vi.fn()} onSubmitFailed={onSubmitFailed} />);
  await userEvent.click(screen.getByRole('radio', { name: /code red/i }));
  await castAndConfirm();
  await screen.findByRole('alert');
  expect(onSubmitFailed).toHaveBeenCalledTimes(1);
});

test('footerExtra rendered', () => {
  render(
    <BallotForm teams={teams} submit={okSubmit()} onVoted={vi.fn()} footerExtra={<div data-testid="extra" />} />,
  );
  expect(screen.getByTestId('extra')).toBeInTheDocument();
});

test('cast opens confirm without submitting', async () => {
  const submit = okSubmit();
  render(<BallotForm teams={teams} submit={submit} onVoted={vi.fn()} />);
  await userEvent.click(screen.getByRole('radio', { name: /code red/i }));
  await userEvent.click(voteButton());
  expect(screen.getByRole('dialog')).toHaveTextContent('Vote for Code Red?');
  expect(submit).not.toHaveBeenCalled();
});

test('cancel returns to ballot with selection kept', async () => {
  const submit = okSubmit();
  render(<BallotForm teams={teams} submit={submit} onVoted={vi.fn()} />);
  const card = screen.getByRole('radio', { name: /code red/i });
  await userEvent.click(card);
  await userEvent.click(voteButton());
  await userEvent.click(screen.getByRole('button', { name: 'Change my pick' }));
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  expect(card).toHaveAttribute('aria-checked', 'true');
  expect(submit).not.toHaveBeenCalled();
});

test('confirm double-tap submits once', async () => {
  const submit = vi.fn(
    () => new Promise<SubmitResult>((r) => setTimeout(() => r({ ok: true, teamName: 'X' }), 50)),
  );
  render(<BallotForm teams={teams} submit={submit} onVoted={vi.fn()} />);
  await userEvent.click(screen.getByRole('radio', { name: /code red/i }));
  await userEvent.click(voteButton());
  const yes = confirmButton();
  await userEvent.click(yes);
  await userEvent.click(yes);
  expect(submit).toHaveBeenCalledTimes(1);
});

test('failed submit closes sheet and shows error', async () => {
  const submit = vi.fn(async (): Promise<SubmitResult> => ({ ok: false, code: 'rate_limited' }));
  render(<BallotForm teams={teams} submit={submit} onVoted={vi.fn()} />);
  await userEvent.click(screen.getByRole('radio', { name: /code red/i }));
  await castAndConfirm();
  expect(await screen.findByRole('alert')).toHaveTextContent('Too many attempts.');
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
});
