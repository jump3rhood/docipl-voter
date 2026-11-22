'use server';

import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/adminAuth';
import { getAdminConfig, purgeIdentifiers, resetVotes, setResultsPublic } from '@/lib/admin';
import { getResults } from '@/lib/results';

export type DangerState = { ok?: string; error?: string } | undefined;

function revalidateAll() {
  revalidatePath('/admin');
  revalidatePath('/admin/results');
  revalidatePath('/results');
}

export async function toggleResultsPublicAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const raw = formData.get('resultsPublic');
  if (raw !== 'true' && raw !== 'false') return;
  try {
    await setResultsPublic(raw === 'true');
  } catch (e) {
    if (e instanceof Error && e.message === 'config_missing') {
      throw new Error('Voting settings are missing — run the seed.');
    }
    throw e;
  }
  revalidateAll();
  // Voter screens that show or hide the results link.
  revalidatePath('/');
  revalidatePath('/thanks');
}

export async function resetAction(_prev: DangerState, formData: FormData): Promise<DangerState> {
  await requireAdmin();
  if (formData.get('confirm') !== 'RESET') return { error: 'Type RESET to confirm.' };
  const r = await resetVotes();
  if (r === 'refused') return { error: 'Voting must be paused before reset.' };
  revalidateAll();
  return { ok: 'Reset done.' };
}

export async function purgeAction(_prev: DangerState, formData: FormData): Promise<DangerState> {
  await requireAdmin();
  if (formData.get('confirm') !== 'PURGE') return { error: 'Type PURGE to confirm.' };
  if ((await getAdminConfig()).enabled) return { error: 'Pause voting first.' };
  await purgeIdentifiers();
  const { total } = await getResults();
  revalidateAll();
  return { ok: `Purged identifiers; ${total} votes kept.` };
}
