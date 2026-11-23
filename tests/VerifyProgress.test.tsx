// @vitest-environment jsdom
import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { VerifyProgress } from '@/components/VerifyProgress';

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

const status = () => screen.getByRole('status');
const advance = (ms: number) => act(() => void vi.advanceTimersByTime(ms));

test('steps through the messages over time', () => {
  render(<VerifyProgress verified={false} />);
  expect(status()).toHaveTextContent('Getting your ballot ready…');
  advance(4_000);
  expect(status()).toHaveTextContent('Checking your connection…');
  advance(4_000);
  expect(status()).toHaveTextContent("Making sure you're a real voter…");
  advance(6_000);
  expect(status()).toHaveTextContent('Almost there…');
  advance(60_000);
  expect(status()).toHaveTextContent('Almost there…');
});

test('shows verified once a token arrives', () => {
  const { rerender } = render(<VerifyProgress verified={false} />);
  advance(5_000);
  rerender(<VerifyProgress verified />);
  expect(status()).toHaveTextContent('Verified, pick your team');
});

test('asks the voter to complete a visible challenge', () => {
  render(<VerifyProgress verified={false} interactive />);
  expect(status()).toHaveTextContent('Please complete the check below.');
});

test('a token that expires restarts with "Checking again…", then continues', () => {
  const { rerender } = render(<VerifyProgress verified />);
  rerender(<VerifyProgress verified={false} />);
  expect(status()).toHaveTextContent('Checking again…');
  advance(4_000);
  expect(status()).toHaveTextContent('Checking your connection…');
});
