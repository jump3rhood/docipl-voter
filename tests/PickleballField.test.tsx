// @vitest-environment jsdom
import { render } from '@testing-library/react';
import { expect, test, vi } from 'vitest';

const pathname = vi.hoisted(() => ({ value: '/' }));
vi.mock('next/navigation', () => ({ usePathname: () => pathname.value }));

import { PickleballField } from '@/components/PickleballField';

test('PickleballField renders nothing without 2d context', () => {
  pathname.value = '/';
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
  const { container } = render(<PickleballField />);
  const canvas = container.querySelector('canvas');
  if (canvas) expect(canvas.getAttribute('aria-hidden')).toBe('true');
});

test('PickleballField hidden on admin', () => {
  pathname.value = '/admin/voting';
  const { container } = render(<PickleballField />);
  expect(container.querySelector('canvas')).toBeNull();
});
