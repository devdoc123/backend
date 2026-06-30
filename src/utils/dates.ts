/** Return a YYYY-MM-DD string for a Date (UTC date portion). */
export function toDateString(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Add days to a YYYY-MM-DD date string and return a new YYYY-MM-DD string. */
export function addDays(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return toDateString(d);
}

export function today(): string {
  return toDateString(new Date());
}

/** Number of whole days between two YYYY-MM-DD dates (b - a). */
export function daysBetween(a: string, b: string): number {
  const da = new Date(`${a}T00:00:00Z`).getTime();
  const db = new Date(`${b}T00:00:00Z`).getTime();
  return Math.round((db - da) / 86_400_000);
}
