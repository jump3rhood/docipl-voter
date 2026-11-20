export const CELEBRATE_KEY = 'dipl_celebrate';

export function markCelebrate(): void {
  try {
    sessionStorage.setItem(CELEBRATE_KEY, '1');
  } catch {
    // storage unavailable: no celebration
  }
}

export function consumeCelebrate(): boolean {
  try {
    const flagged = sessionStorage.getItem(CELEBRATE_KEY) === '1';
    if (flagged) sessionStorage.removeItem(CELEBRATE_KEY);
    return flagged;
  } catch {
    return false;
  }
}
