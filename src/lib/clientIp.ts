/** First x-forwarded-for entry (trimmed), else x-real-ip, else null. */
export function getClientIp(headers: Headers): string | null {
  const xff = headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  if (xff) return xff;
  const real = headers.get('x-real-ip')?.trim();
  return real || null;
}
