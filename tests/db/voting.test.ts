import { beforeEach, expect, test } from 'vitest';
import { admin, resetData } from './helpers';
import { getActiveTeams, getVotingStatus } from '@/lib/voting';

beforeEach(resetData);

test('getActiveTeams returns 11 in display order, excludes inactive', async () => {
  const teams = await getActiveTeams();
  expect(teams).toHaveLength(11);
  expect(teams[0].name).toBe('Smash Squad 2.0');
  expect(teams[10].name).toBe('Dinking Dragons');

  const { error } = await admin.from('teams').update({ is_active: false }).eq('slug', 'code-red');
  expect(error).toBeNull();
  const after = await getActiveTeams();
  expect(after).toHaveLength(10);
  expect(after.some((t) => t.slug === 'code-red')).toBe(false);
});

test('getVotingStatus reads config', async () => {
  const st = await getVotingStatus(new Date('2026-11-20T00:00:00Z'));
  expect(st.state).toBe('before');
  expect(st.start.getTime()).toBe(new Date('2026-11-21T09:00:00+05:30').getTime());
  expect(st.end.getTime()).toBe(new Date('2026-11-22T21:00:00+05:30').getTime());
});
