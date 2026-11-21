// Turns the official logo files into small square WebPs for the app.
// Usage: node scripts/optimize-logos.mjs <folder with the original logos>
// Team logos -> public/teams/<slug>.webp (256px; largest display is 72px, 3x phones need ~216px).
// League logo -> public/brand/docipl-logo.webp (512px).
import sharp from 'sharp';
import { mkdir, stat } from 'node:fs/promises';
import path from 'node:path';

const src = process.argv[2];
if (!src) {
  console.error('Usage: node scripts/optimize-logos.mjs <folder>');
  process.exit(1);
}

// Original filename -> team slug (several filenames differ from the team names).
const TEAMS = {
  'Smash Squad 2.0.jpeg': 'smash-squad',
  'Jagger Shots.png': 'jager-shots',
  'CodeRed.png': 'code-red',
  'The Rush.jpeg': 'the-rush',
  'Dink & Drive.jpeg': 'dink-n-drive',
  'Spin Maveriks.jpeg': 'spin-mavericks',
  'Code Blue.jpeg': 'code-blue',
  'White Coat Warriors.jpeg': 'white-coat-warriors',
  'The Pacemakers.png': 'the-pacemakers',
  'VDC Spartans logo.png': 'vdc-spartans',
  'Dinkin Dragons.jpeg': 'dinking-dragons',
};
const LEAGUE = 'DocIPL_Logo_page-0001.jpg';

const root = path.resolve(import.meta.dirname, '..');

async function convert(file, out, size) {
  // Centre-crop to square (the non-square originals only lose plain background),
  // high-quality Lanczos downscale, flatten (all originals are opaque), WebP q90.
  await sharp(path.join(src, file))
    .rotate()
    .resize(size, size, { fit: 'cover', position: 'centre', kernel: 'lanczos3' })
    .flatten({ background: '#ffffff' })
    .webp({ quality: 90, effort: 6, smartSubsample: true })
    .toFile(out);
  const { size: bytes } = await stat(out);
  console.log(`${file} -> ${path.relative(root, out)} (${(bytes / 1024).toFixed(1)} KB)`);
}

await mkdir(path.join(root, 'public/teams'), { recursive: true });
for (const [file, slug] of Object.entries(TEAMS)) {
  await convert(file, path.join(root, 'public/teams', `${slug}.webp`), 256);
}
await convert(LEAGUE, path.join(root, 'public/brand/docipl-logo.webp'), 512);
