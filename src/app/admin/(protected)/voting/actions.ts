'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { requireAdmin } from '@/lib/adminAuth';
import { setVotingEnabled, updateVotingWindow } from '@/lib/admin';
import { istLocalToDate } from '@/lib/ist';

export type SaveState = { ok?: true; error?: string } | undefined;

const istField = (message: string) =>
  z.string({ error: message }).transform((v, ctx) => {
    try {
      return istLocalToDate(v);
    } catch {
      ctx.addIssue({ code: 'custom', message });
      return z.NEVER;
    }
  });

const MISSING_CONFIG = 'Voting settings are missing — run the seed.';
const MAX_VOTES_REQUIRED ='Enter max votes (0–1000).';

const schema = z.object({
  start: istField('Enter a valid start.'),
  end: istField('Enter a valid end.'),
  maxVotes: z
    .string({ error: MAX_VOTES_REQUIRED })
    .trim()
    .min(1, MAX_VOTES_REQUIRED)
    .transform((v) => Number(v))
    .pipe(
      z
        .number({ error: 'Max votes must be a number.' })
        .int('Max votes must be a whole number.')
        .min(0, 'Max votes must be 0 to 1000.')
        .max(1000, 'Max votes must be 0 to 1000.'),
    ),
});

function revalidateAll() {
  revalidatePath('/');
  revalidatePath('/admin');
  revalidatePath('/admin/voting');
}

export async function saveVotingAction(_prev: SaveState, formData: FormData): Promise<SaveState> {
  await requireAdmin();
  const parsed = schema.safeParse({
    start: formData.get('start'),
    end: formData.get('end'),
    maxVotes: formData.get('maxVotes'),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Invalid input.' };
  }
  const { start, end, maxVotes } = parsed.data;
  if (end <= start) return { error: 'End must be after start.' };
  try {
    // Column-level write: `is_enabled` is only ever changed by the pause/resume toggle.
    await updateVotingWindow({ start, end, maxVotesPerDeviceIp: maxVotes });
  } catch (e) {
    if (e instanceof Error && e.message === 'end_before_start') {
      return { error: 'End must be after start.' };
    }
    if (e instanceof Error && e.message === 'config_missing') return { error: MISSING_CONFIG };
    throw e;
  }
  revalidateAll();
  return { ok: true };
}

export async function toggleVotingAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const raw = formData.get('enabled');
  if (raw !== 'true' && raw !== 'false') return;
  try {
    await setVotingEnabled(raw === 'true');
  } catch (e) {
    if (e instanceof Error && e.message === 'config_missing') throw new Error(MISSING_CONFIG);
    throw e;
  }
  revalidateAll();
}
