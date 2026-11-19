// @vitest-environment jsdom
import { expect, test } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ExpiredBallot } from '@/components/ExpiredBallot';

test('renders expiry copy and a plain anchor to /v', () => {
  render(<ExpiredBallot />);
  expect(screen.getByText('This ballot link has expired.')).toBeInTheDocument();
  expect(screen.getByText('Get a new ballot to vote.')).toBeInTheDocument();
  const a = screen.getByRole('link', { name: 'GET A NEW BALLOT' });
  expect(a.tagName).toBe('A');
  expect(a).toHaveAttribute('href', '/v');
  expect(screen.getByRole('link', { name: 'Privacy' })).toHaveAttribute('href', '/privacy');
});
