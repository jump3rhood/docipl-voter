export const MAX_LOGO_BYTES = 1024 * 1024;
const EXT: Record<string, 'png' | 'jpg' | 'webp'> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
};

export function validateLogo(file: {
  type: string;
  size: number;
}): { ok: true; ext: 'png' | 'jpg' | 'webp' } | { ok: false; error: string } {
  const ext = EXT[file.type];
  if (!ext) return { ok: false, error: 'Use a PNG, JPG or WEBP image.' };
  if (file.size > MAX_LOGO_BYTES) return { ok: false, error: 'Image must be 1 MB or smaller.' };
  return { ok: true, ext };
}
