export const VOTER_COOKIE = 'dipl_vid';

const DAY = 86400;

/** Cookie lives until voting_end + 7 days (minimum 1 day). */
export function voterCookieOptions(
  votingEnd: Date,
  now: Date = new Date(),
  isProd: boolean = process.env.NODE_ENV === 'production',
): { httpOnly: true; sameSite: 'lax'; path: '/'; secure: boolean; maxAge: number } {
  const seconds = Math.floor((votingEnd.getTime() + 7 * DAY * 1000 - now.getTime()) / 1000);
  return {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    secure: isProd,
    maxAge: Math.max(DAY, seconds),
  };
}
