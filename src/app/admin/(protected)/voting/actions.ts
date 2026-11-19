'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { requireAdmin } from '@/lib/adminAuth';
import { getAdminConfig, updateAdminConfig } from '@/lib/admin';
import { istLocalToDate } from '@/lib/ist';

export type SaveState = { ok?: true; error?: string } | undefined;

const istField = (message: string) =>
  z.string().transform((v, ctx) => {
    try {
      return istLocalToDate(v);
    } catch {
      ctx.addIssue({ code: 'custom', message });
      return z.NEVER;
    }
  });

const schema = z.object({
  start: istField('Enter a valid start.'),
  end: istField('Enter a valid end.'),
  enabled: z.boolean(),
  maxVotes: z.coerce
    .number({ error: 'Max votes must be a number.' })
    .int('Max votes must be a whole number.')
    .min(0, 'Max votes must be 0 to 1000.')
    .max(1000, 'Max votes must be 0 to 1000.'),
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
    enabled: formData.get('enabled') === 'on',
    maxVotes: formData.get('maxVotes'),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Invalid input.' };
  }
  const { start, end, enabled, maxVotes } = parsed.data;
  if (end <= start) return { error: 'End must be after start.' };
  try {
    await updateAdminConfig({ start, end, enabled, maxVotesPerDeviceIp: maxVotes });
  } catch (e) {
    if (e instanceof Error && e.message === 'end_before_start') {
      return { error: 'End must be after start.' };
    }
    throw e;
  }
  revalidateAll();
  return { ok: true };
}

export async function toggleVotingAction(formData: FormData): Promise<void> {
  void formData;
  await requireAdmin();
  const c = await getAdminConfig();
  await updateAdminConfig({ ...c, enabled: !c.enabled });
  revalidateAll();
}
