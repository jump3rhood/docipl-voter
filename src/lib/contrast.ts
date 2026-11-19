const NAVY = '#0B2A5B';
const WHITE = '#FFFFFF';

function parseHex(hex: string): [number, number, number] | null {
  let h = hex.trim().replace(/^#/, '');
  if (/^[0-9a-f]{3}$/i.test(h)) h = h.replace(/./g, (c) => c + c);
  if (!/^[0-9a-f]{6}$/i.test(h)) return null;
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)) as [number, number, number];
}

function luminance([r, g, b]: [number, number, number]): number {
  const [R, G, B] = [r, g, b].map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * R + 0.7152 * G + 0.0722 * B;
}

// Mid-tone accents (red, blue, indigo; L about 0.15-0.24) read better with white text
// even where navy is marginally higher contrast, so switch to navy only on clearly light accents.
const LIGHT_THRESHOLD = 0.3;

/** Navy text on light accents, white on dark/mid accents (WCAG relative luminance). */
export function pickTextColor(hex: string): '#0B2A5B' | '#FFFFFF' {
  const rgb = parseHex(hex);
  if (!rgb) return WHITE;
  return luminance(rgb) > LIGHT_THRESHOLD ? NAVY : WHITE;
}
