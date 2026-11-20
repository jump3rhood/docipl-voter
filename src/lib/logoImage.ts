const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);

/**
 * Only remote https logos go through the Next image optimizer. Local hosts
 * (local Supabase) stay unoptimized because Next refuses local IPs by default.
 */
export function shouldOptimizeLogo(url: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  if (parsed.protocol !== 'https:') return false;
  return !LOCAL_HOSTS.has(parsed.hostname);
}
