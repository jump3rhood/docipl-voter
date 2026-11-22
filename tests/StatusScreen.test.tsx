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
test('VOTE NOW is a plain anchor (no Next Link prefetch of the token-minting route)', () => {
  render(<StatusScreen state="open" startLabel="x" />);
  const a = screen.getByRole('link', { name: 'VOTE NOW' });
  expect(a.tagName).toBe('A');
  // next/link renders extra attributes; a plain anchor carries only href and class.
  expect(Array.from(a.attributes).map((x) => x.name).sort()).toEqual(['class', 'href']);
});
test('privacy link is present', () => {
  render(<StatusScreen state="before" startLabel="x" />);
  expect(screen.getByRole('link', { name: 'Privacy' })).toHaveAttribute('href', '/privacy');
});
test('closed does not link to results', () => {
  render(<StatusScreen state="closed" startLabel="x" />);
  expect(screen.getByText('Voting has closed.')).toBeInTheDocument();
  expect(screen.getByText('Thank you to everyone who participated!')).toBeInTheDocument();
  expect(screen.queryByRole('link', { name: /results/i })).toBeNull();
});
test('results link appears when results are public', () => {
  const { unmount } = render(<StatusScreen state="closed" startLabel="x" showResults />);
  expect(screen.getByRole('link', { name: 'VIEW FINAL RESULTS' })).toHaveAttribute('href', '/results');
  unmount();
  render(<StatusScreen state="open" startLabel="x" showResults />);
  expect(screen.getByRole('link', { name: 'VIEW LIVE RESULTS' })).toHaveAttribute('href', '/results');
});
test('paused copy', () => {
  render(<StatusScreen state="paused" startLabel="x" />);
  expect(screen.getByText('Voting is paused.')).toBeInTheDocument();
  expect(screen.getByText('Check back soon.')).toBeInTheDocument();
  expect(screen.queryByRole('link', { name: /vote|results/i })).toBeNull();
});
