const IST_OFFSET_MS = 330 * 60 * 1000;
const RE = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/;

/** `YYYY-MM-DDTHH:mm` (IST wall time) -> Date. Throws on invalid input. */
export function istLocalToDate(v: string): Date {
  const m = RE.exec(v);
  if (!m) throw new Error('invalid_ist_local');
  const [y, mo, d, h, mi] = m.slice(1).map(Number);
  const utc = Date.UTC(y, mo - 1, d, h, mi);
  const date = new Date(utc);
  if (
    date.getUTCFullYear() !== y ||
    date.getUTCMonth() !== mo - 1 ||
    date.getUTCDate() !== d ||
    date.getUTCHours() !== h ||
    date.getUTCMinutes() !== mi
  ) {
    throw new Error('invalid_ist_local');
  }
  return new Date(utc - IST_OFFSET_MS);
}

/** Date -> `YYYY-MM-DDTHH:mm` in IST. */
export function dateToIstLocal(d: Date): string {
  return new Date(d.getTime() + IST_OFFSET_MS).toISOString().slice(0, 16);
}
