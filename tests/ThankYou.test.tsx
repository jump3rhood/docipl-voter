// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { expect, test } from 'vitest';
import { ThankYou } from '@/components/ThankYou';

test('ThankYou shows team', () => {
  render(<ThankYou teamName="Code Red" />);
  expect(screen.getByText('🎉 THANK YOU!')).toBeTruthy();
  expect(screen.getByText('Your vote has been recorded.')).toBeTruthy();
  expect(screen.getByText('You voted for:')).toBeTruthy();
  expect(screen.getByText('Code Red')).toBeTruthy();
  expect(screen.getByRole('link', { name: 'VIEW LIVE RESULTS' }).getAttribute('href')).toBe('/results');
});

test('ThankYou without team', () => {
  render(<ThankYou teamName={null} />);
  expect(screen.queryByText('You voted for:')).toBeNull();
  expect(screen.getByText('Your vote has been recorded.')).toBeTruthy();
});
