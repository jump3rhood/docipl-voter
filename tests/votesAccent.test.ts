import { afterEach, expect, test, vi } from 'vitest';

const { rpc, maybeSingle } = vi.hoisted(() => ({ rpc: vi.fn(), maybeSingle: vi.fn() }));
vi.mock('@/lib/supabase', () => ({
  getSupabaseAdmin: () => ({
    rpc,
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle }) }) }),
  }),
}));

import { getVoterVote } from '@/lib/votes';

afterEach(() => vi.restoreAllMocks());

test('failing accent lookup still returns the vote with null accent', async () => {
  rpc.mockResolvedValue({ data: [{ team_id: 't1', team_name: 'Code Red' }], error: null });
  maybeSingle.mockResolvedValue({ data: null, error: { message: 'boom' } });
  const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
  expect(await getVoterVote('hash')).toEqual({ teamId: 't1', teamName: 'Code Red', accentColor: null });
  expect(spy).toHaveBeenCalledWith('[thanks] accent lookup failed');
});
