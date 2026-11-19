import { execSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';

const out = execSync('npx supabase status -o env', { encoding: 'utf8' });
const env = {};
for (const line of out.split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)="?(.*?)"?$/);
  if (m) env[m[1]] = m[2];
}
const url = env.API_URL;
const service = env.SERVICE_ROLE_KEY ?? env.SECRET_KEY;
const anon = env.ANON_KEY ?? env.PUBLISHABLE_KEY;
if (!url || !service || !anon) {
  console.error('Missing keys in supabase status output:', Object.keys(env).join(', '));
  process.exit(1);
}
writeFileSync(
  '.env.test.local',
  `SUPABASE_URL=${url}\nSUPABASE_SERVICE_ROLE_KEY=${service}\nSUPABASE_ANON_KEY=${anon}\n`,
);
console.log('Wrote .env.test.local');
