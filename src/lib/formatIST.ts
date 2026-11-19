const fmt = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Asia/Kolkata',
  weekday: 'long',
  day: 'numeric',
  month: 'short',
  hour: 'numeric',
  minute: '2-digit',
  hour12: true,
});

export function formatIST(d: Date): string {
  const p: Record<string, string> = {};
  for (const part of fmt.formatToParts(d)) p[part.type] = part.value;
  const hour = String(Number(p.hour));
  const period = (p.dayPeriod ?? '').toUpperCase();
  return `${p.weekday}, ${p.day} ${p.month}, ${hour}:${p.minute} ${period}`;
}
