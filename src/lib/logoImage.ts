const LOGO_PATH_PREFIX = '/storage/v1/object/public/team-logos/';

/**
 * Only https logos in the hosted Supabase team-logos bucket go through the Next image
 * optimizer; this mirrors the remotePatterns in next.config.ts. Everything else
 * (local Supabase, other hosts or buckets) stays unoptimized.
 */
export function shouldOptimizeLogo(url: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  if (parsed.protocol !== 'https:') return false;
  return parsed.hostname.endsWith('.supabase.co') && parsed.pathname.startsWith(LOGO_PATH_PREFIX);
}
