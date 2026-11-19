// @vitest-environment jsdom
import { expect, test, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BallotForm, type SubmitResult } from '@/components/BallotForm';
import { VerifyNotice } from '@/components/VerifyNotice';

test('shows the copy and a Reload button that calls onReload', async () => {
  const onReload = vi.fn();
  render(<VerifyNotice onReload={onReload} />);
  expect(screen.getByText('Verification is taking too long.')).toBeInTheDocument();
  expect(screen.getByText("Reload this page, or open it in your phone's browser.")).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'Reload' }));
  expect(onReload).toHaveBeenCalledTimes(1);
});

test('BallotForm renders the notice inside its footer', async () => {
  const onReload = vi.fn();
  render(
    <BallotForm
      teams={[]}
      submit={vi.fn(async (): Promise<SubmitResult> => ({ ok: true, teamName: 'X' }))}
      onVoted={vi.fn()}
      canSubmit={false}
      footerExtra={<VerifyNotice onReload={onReload} />}
    />,
  );
  await userEvent.click(screen.getByRole('button', { name: 'Reload' }));
  expect(onReload).toHaveBeenCalledTimes(1);
});
