'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { requireAdmin } from '@/lib/adminAuth';
import { createTeam, setTeamLogo, updateTeam } from '@/lib/admin';
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
  displayOrder: z.coerce
    .number({ error: 'Display order must be a number.' })
    .int('Display order must be a whole number.')
    .min(0, 'Display order must be 0 to 10000.')
    .max(10000, 'Display order must be 0 to 10000.'),
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

export async function createTeamAction(_prev: TeamState, formData: FormData): Promise<TeamState> {
  await requireAdmin();
  const parsed = createSchema.safeParse({
    name: formData.get('name'),
    slug: formData.get('slug'),
    accent: accentOf(formData),
    displayOrder: formData.get('displayOrder'),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Invalid input.' };
  const { name, slug, accent, displayOrder } = parsed.data;
  try {
    await createTeam({ name, slug, accentColor: accent, displayOrder });
  } catch (e) {
    if (duplicate(e)) return { error: 'That slug is already used.' };
    throw e;
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
    displayOrder: formData.get('displayOrder'),
    isActive: formData.get('isActive') === 'on',
  });
  if (!parsed.success) {
    if (parsed.error.issues.some((i) => i.path[0] === 'id')) return { error: 'Team not found.' };
    return { error: parsed.error.issues[0]?.message ?? 'Invalid input.' };
  }
  const { id, name, slug, accent, displayOrder, isActive } = parsed.data;
  try {
    await updateTeam(id, { name, slug, accentColor: accent, displayOrder, isActive });
  } catch (e) {
    if (duplicate(e)) return { error: 'That slug is already used.' };
    if (e instanceof Error && e.message === 'not_found') return { error: 'Team not found.' };
    throw e;
  }
  revalidateAll();
  return { ok: true };
}

export async function uploadLogoAction(_prev: TeamState, formData: FormData): Promise<TeamState> {
  await requireAdmin();
  const id = String(formData.get('id') ?? '');
  const file = formData.get('logo');
  if (!z.guid().safeParse(id).success) return { error: 'Team not found.' };
  if (!(file instanceof File) || file.size === 0) return { error: 'Choose an image to upload.' };
  const v = validateLogo(file);
  if (!v.ok) return { error: v.error };
  try {
    await setTeamLogo(id, { bytes: await file.arrayBuffer(), type: file.type });
  } catch (e) {
    if (e instanceof Error && e.message === 'too_large') return { error: 'Image must be 1 MB or smaller.' };
    if (e instanceof Error && e.message === 'unsupported_type') return { error: 'Use a PNG, JPG or WEBP image.' };
    throw e;
  }
  revalidateAll();
  return { ok: true };
}
