/** Calendar dates are user-local dates; arithmetic uses UTC to avoid DST drift. */
export function validTimezone(value: unknown): string {
  if (typeof value === "string") {
    try { new Intl.DateTimeFormat("en", { timeZone: value }).format(); return value; } catch { /* fallback */ }
  }
  return "UTC";
}

export function calendarDate(now: Date, timezone: string): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: validTimezone(timezone), year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(now);
  const part = (type: string) => parts.find((p) => p.type === type)!.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}

export function addDays(date: string, days: number): string {
  const result = new Date(`${date}T12:00:00Z`);
  result.setUTCDate(result.getUTCDate() + days);
  return result.toISOString().slice(0, 10);
}

export function weekday(date: string): number {
  return new Date(`${date}T12:00:00Z`).getUTCDay();
}

export function weekStart(date: string, startsOn = 0): string {
  return addDays(date, -((weekday(date) - startsOn + 7) % 7));
}

export function daysBetween(start: string, end: string): number {
  return Math.round((Date.parse(`${end}T12:00:00Z`) - Date.parse(`${start}T12:00:00Z`)) / 86_400_000);
}

export function dateLabel(date: string, options: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" }): string {
  return new Intl.DateTimeFormat("en-US", { ...options, timeZone: "UTC" }).format(new Date(`${date}T12:00:00Z`));
}
