import { describe, expect, it } from 'vitest';
import { shouldOptimizeLogo } from '@/lib/logoImage';

describe('shouldOptimizeLogo', () => {
  it('remote supabase logo is optimized', () => {
    expect(
      shouldOptimizeLogo('https://abc.supabase.co/storage/v1/object/public/team-logos/x-1.png'),
    ).toBe(true);
  });
  it('local logo hosts skip optimization', () => {
    expect(shouldOptimizeLogo('http://127.0.0.1:54321/storage/v1/object/public/team-logos/x.png')).toBe(false);
    expect(shouldOptimizeLogo('http://localhost:54321/storage/v1/object/public/team-logos/x.png')).toBe(false);
    expect(shouldOptimizeLogo('https://localhost/x.png')).toBe(false);
    expect(shouldOptimizeLogo('https://127.0.0.1/x.png')).toBe(false);
    expect(shouldOptimizeLogo('https://[::1]/x.png')).toBe(false);
  });
  it('http, relative and garbage urls are not optimized', () => {
    expect(shouldOptimizeLogo('http://abc.supabase.co/x.png')).toBe(false);
    expect(shouldOptimizeLogo('/logos/x.png')).toBe(false);
    expect(shouldOptimizeLogo('garbage url')).toBe(false);
    expect(shouldOptimizeLogo('')).toBe(false);
  });
});
