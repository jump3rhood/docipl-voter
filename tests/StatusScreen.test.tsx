// @vitest-environment jsdom
import { expect, test } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StatusScreen } from '@/components/StatusScreen';

test('before shows start time', () => {
  render(<StatusScreen state="before" startLabel="Saturday, 21 Nov, 9:00 AM" />);
  expect(screen.getByText('Voting opens soon.')).toBeInTheDocument();
  expect(screen.getByText('Saturday, 21 Nov, 9:00 AM')).toBeInTheDocument();
});
test('open links to /v', () => {
  render(<StatusScreen state="open" startLabel="x" />);
  expect(screen.getByText('Voting is open!')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'VOTE NOW' })).toHaveAttribute('href', '/v');
});
test('closed links to results', () => {
  render(<StatusScreen state="closed" startLabel="x" />);
  expect(screen.getByText('Voting has closed.')).toBeInTheDocument();
  expect(screen.getByText('Thank you to everyone who participated!')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'VIEW FINAL RESULTS' })).toHaveAttribute('href', '/results');
});
test('paused copy', () => {
  render(<StatusScreen state="paused" startLabel="x" />);
  expect(screen.getByText('Voting is paused.')).toBeInTheDocument();
  expect(screen.getByText('Check back soon.')).toBeInTheDocument();
  expect(screen.queryAllByRole('link')).toHaveLength(0);
});
