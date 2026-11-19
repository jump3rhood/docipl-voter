import { describe, expect, test } from 'vitest';
import { validateLogo } from '@/lib/logoValidation';

describe('validateLogo', () => {
  test.each([
    ['image/png', 'png'],
    ['image/jpeg', 'jpg'],
    ['image/webp', 'webp'],
  ])('accepts %s', (type, ext) => {
    expect(validateLogo({ type, size: 1000 })).toEqual({ ok: true, ext });
  });
  test.each(['image/svg+xml', 'image/gif', 'application/pdf'])('rejects %s', (type) => {
    expect(validateLogo({ type, size: 1000 })).toEqual({ ok: false, error: 'Use a PNG, JPG or WEBP image.' });
  });
  test('1 MB ok, 1 MB + 1 byte rejected', () => {
    expect(validateLogo({ type: 'image/png', size: 1024 * 1024 }).ok).toBe(true);
    expect(validateLogo({ type: 'image/png', size: 1024 * 1024 + 1 })).toEqual({
      ok: false,
      error: 'Image must be 1 MB or smaller.',
    });
  });
});
