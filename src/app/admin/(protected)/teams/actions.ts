'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { requireAdmin } from '@/lib/adminAuth';
import { createTeam, reorderTeams, setTeamLogo, updateTeam } from '@/lib/admin';
import { validateLogo } from '@/lib/logoValidation';

export type TeamState = { ok?: true; error?: string } | undefined;

const fields = {
  name: z.string().trim().min(1, 'Name is required.').max(80, 'Name must be 80 characters or fewer.'),
  slug: z
    .string()
    .trim()
    .max(40, 'Slug must be 40 characters or fewer.')
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug may use lowercase letters, numbers and single hyphens.'),
  accent: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/, 'Accent colour must look like #1A2B3C.')
    .nullable(),
};
const createSchema = z.object(fields);
const updateSchema = z.object({ id: z.guid(), ...fields, isActive: z.boolean() });

function accentOf(formData: FormData): string | null {
  if (formData.get('noAccent') === 'on') return null;
  const v = String(formData.get('accent') ?? '').trim();
  return v === '' ? null : v;
}

function revalidateAll() {
  revalidatePath('/admin/teams');
  revalidatePath('/results');
  revalidatePath('/vote', 'layout');
}

function duplicate(e: unknown): boolean {
  return e instanceof Error && e.message === 'duplicate_slug';
}

function logoOf(formData: FormData): File | null {
  const f = formData.get('logo');
  return f instanceof File && f.size > 0 ? f : null;
}

async function uploadLogo(id: string, file: File): Promise<TeamState> {
  try {
    await setTeamLogo(id, { bytes: await file.arrayBuffer(), type: file.type });
  } catch (e) {
    if (e instanceof Error && e.message === 'not_found') return { error: 'Team not found.' };
    if (e instanceof Error && e.message === 'too_large') return { error: 'Image must be 1 MB or smaller.' };
    if (e instanceof Error && e.message === 'unsupported_type') return { error: 'Use a PNG, JPG or WEBP image.' };
    throw e;
  }
  return undefined;
}

export async function createTeamAction(_prev: TeamState, formData: FormData): Promise<TeamState> {
  await requireAdmin();
  const parsed = createSchema.safeParse({
    name: formData.get('name'),
    slug: formData.get('slug'),
    accent: accentOf(formData),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Invalid input.' };
  const logo = logoOf(formData);
  if (logo) {
    const v = validateLogo(logo);
    if (!v.ok) return { error: v.error };
  }
  const { name, slug, accent } = parsed.data;
  let id: string;
  try {
    id = await createTeam({ name, slug, accentColor: accent });
  } catch (e) {
    if (duplicate(e)) return { error: 'That slug is already used.' };
    throw e;
  }
  if (logo) {
    const err = await uploadLogo(id, logo);
    if (err) {
      revalidateAll();
      return err;
    }
  }
  revalidateAll();
  return { ok: true };
}

export async function updateTeamAction(_prev: TeamState, formData: FormData): Promise<TeamState> {
  await requireAdmin();
  const parsed = updateSchema.safeParse({
    id: formData.get('id'),
    name: formData.get('name'),
    slug: formData.get('slug'),
    accent: accentOf(formData),
    isActive: formData.get('isActive') === 'on',
  });
  if (!parsed.success) {
    if (parsed.error.issues.some((i) => i.path[0] === 'id')) return { error: 'Team not found.' };
    return { error: parsed.error.issues[0]?.message ?? 'Invalid input.' };
  }
  const logo = logoOf(formData);
  if (logo) {
    const v = validateLogo(logo);
    if (!v.ok) return { error: v.error };
  }
  const { id, name, slug, accent, isActive } = parsed.data;
  try {
    await updateTeam(id, { name, slug, accentColor: accent, isActive });
  } catch (e) {
    if (duplicate(e)) return { error: 'That slug is already used.' };
    if (e instanceof Error && e.message === 'not_found') return { error: 'Team not found.' };
    throw e;
  }
  if (logo) {
    const err = await uploadLogo(id, logo);
    if (err) {
      revalidateAll();
      return err;
    }
  }
  revalidateAll();
  return { ok: true };
}

export async function reorderTeamsAction(ids: string[]): Promise<TeamState> {
  await requireAdmin();
  try {
    await reorderTeams(ids);
  } catch (e) {
    if (e instanceof Error && e.message === 'stale_list') {
      return { error: 'The team list changed. Reload and try again.' };
    }
    throw e;
  }
  revalidateAll();
  return { ok: true };
}
