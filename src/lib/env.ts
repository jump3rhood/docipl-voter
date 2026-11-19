import 'server-only';
import { z } from 'zod';

export type RateLimit = { max: number; windowSeconds: number };

export type ServerEnv = {
  SITE_URL: string;
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  TURNSTILE_SITE_KEY: string;
  TURNSTILE_SECRET_KEY: string;
  HASH_SECRET: string;
  ADMIN_PASSWORD: string;
  ADMIN_SESSION_SECRET: string;
  rateLimits: {
    mint: RateLimit;
    vote: RateLimit;
    status: RateLimit;
    adminLogin: RateLimit;
  };
};

// "max/windowSeconds"; an unset or empty variable falls back to the default.
const rateLimit = (fallback: string) =>
  z
    .string()
    .optional()
    .transform((v) => (v === undefined || v.trim() === '' ? fallback : v.trim()))
    .pipe(
      z.string().regex(/^[1-9]\d*\/[1-9]\d*$/, 'must be "max/windowSeconds", e.g. 30/600'),
    )
    .refine((v) => Number(v.split('/')[1]) <= 3600, 'window must be at most 3600 seconds')
    .transform((v): RateLimit => {
      const [max, windowSeconds] = v.split('/').map(Number);
      return { max, windowSeconds };
    });

const schema = z.object({
  NEXT_PUBLIC_SITE_URL: z.string().url(),
  SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  NEXT_PUBLIC_TURNSTILE_SITE_KEY: z.string().min(1),
  TURNSTILE_SECRET_KEY: z.string().min(1),
  HASH_SECRET: z.string().min(32),
  ADMIN_PASSWORD: z.string().min(8),
  ADMIN_SESSION_SECRET: z.string().min(32),
  RATE_LIMIT_MINT: rateLimit('60/600'),
  RATE_LIMIT_VOTE: rateLimit('30/600'),
  RATE_LIMIT_STATUS: rateLimit('120/60'),
  RATE_LIMIT_ADMIN_LOGIN: rateLimit('10/900'),
});

export function parseServerEnv(source: Record<string, string | undefined>): ServerEnv {
  const result = schema.safeParse(source);
  if (!result.success) {
    const names = [...new Set(result.error.issues.map((i) => i.path.join('.')))];
    throw new Error(`Invalid or missing environment variables: ${names.join(', ')}`);
  }
  const d = result.data;
  return {
    SITE_URL: d.NEXT_PUBLIC_SITE_URL,
    SUPABASE_URL: d.SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY: d.SUPABASE_SERVICE_ROLE_KEY,
    TURNSTILE_SITE_KEY: d.NEXT_PUBLIC_TURNSTILE_SITE_KEY,
    TURNSTILE_SECRET_KEY: d.TURNSTILE_SECRET_KEY,
    HASH_SECRET: d.HASH_SECRET,
    ADMIN_PASSWORD: d.ADMIN_PASSWORD,
    ADMIN_SESSION_SECRET: d.ADMIN_SESSION_SECRET,
    rateLimits: {
      mint: d.RATE_LIMIT_MINT,
      vote: d.RATE_LIMIT_VOTE,
      status: d.RATE_LIMIT_STATUS,
      adminLogin: d.RATE_LIMIT_ADMIN_LOGIN,
    },
  };
}

let cached: ServerEnv | undefined;

export function getServerEnv(): ServerEnv {
  return (cached ??= parseServerEnv(process.env));
}
