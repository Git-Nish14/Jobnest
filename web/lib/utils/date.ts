/**
 * Shared date/time formatting utilities.
 *
 * All functions read the device's locale and IANA timezone from
 * Intl.DateTimeFormat().resolvedOptions() so dates render consistently
 * in the user's own locale and clock — never hardcoded to en-US.
 *
 * Safe to call on both server (Node) and client; on the server the
 * system locale/timezone is used, which is fine for API responses that
 * are not shown directly to the user as formatted strings.
 */

function deviceLocale(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().locale || "en";
  } catch {
    return "en";
  }
}

function deviceTz(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

/**
 * Parse a date string safely.
 * For date-only strings (YYYY-MM-DD) we anchor at noon local time to avoid
 * UTC-midnight boundary issues that would show the wrong calendar day.
 */
function parseDate(dateStr: string | null | undefined): Date | null {
  if (!dateStr) return null;
  // Date-only: "2026-05-12" → treat as local noon to avoid TZ off-by-one
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(dateStr);
  const d = dateOnly ? new Date(`${dateStr}T12:00:00`) : new Date(dateStr);
  return isNaN(d.getTime()) ? null : d;
}

/** "May 12, 2026" — date only, device locale + timezone */
export function formatDate(dateStr: string | null | undefined): string {
  const d = parseDate(dateStr);
  if (!d) return "—";
  return d.toLocaleDateString(deviceLocale(), {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: deviceTz(),
  });
}

/** "May 12" — short date without year */
export function formatShortDate(dateStr: string | null | undefined): string {
  const d = parseDate(dateStr);
  if (!d) return "—";
  return d.toLocaleDateString(deviceLocale(), {
    month: "short",
    day: "numeric",
    timeZone: deviceTz(),
  });
}

/** "Tuesday, May 12, 2026" — full date with weekday */
export function formatFullDate(dateStr: string | null | undefined): string {
  const d = parseDate(dateStr);
  if (!d) return "—";
  return d.toLocaleDateString(deviceLocale(), {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: deviceTz(),
  });
}

/** "May 12, 2026, 3:45 PM" — full datetime, device locale + timezone */
export function formatDateTime(dateStr: string | null | undefined): string {
  const d = parseDate(dateStr);
  if (!d) return "—";
  return d.toLocaleString(deviceLocale(), {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: deviceTz(),
  });
}

/** "3:45 PM" — time only, device locale + timezone */
export function formatTime(dateStr: string | null | undefined): string {
  const d = parseDate(dateStr);
  if (!d) return "—";
  return d.toLocaleTimeString(deviceLocale(), {
    hour: "numeric",
    minute: "2-digit",
    timeZone: deviceTz(),
  });
}

/** "3:45:09 PM" — time with seconds, device locale + timezone */
export function formatTimeWithSeconds(dateStr: string | null | undefined): string {
  const d = parseDate(dateStr);
  if (!d) return "—";
  return d.toLocaleTimeString(deviceLocale(), {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    timeZone: deviceTz(),
  });
}

/**
 * "today" / "yesterday" / "3 days ago" / falls back to formatDate for older dates.
 * Comparison is done in the device's local calendar day.
 */
export function formatRelativeDate(dateStr: string | null | undefined): string {
  const d = parseDate(dateStr);
  if (!d) return "—";

  const tz = deviceTz();
  // Get the calendar date string for both dates in device timezone
  const opts: Intl.DateTimeFormatOptions = { year: "numeric", month: "2-digit", day: "2-digit", timeZone: tz };
  const locale = deviceLocale();
  const todayStr = new Date().toLocaleDateString(locale, opts);
  const targetStr = d.toLocaleDateString(locale, opts);

  if (targetStr === todayStr) return "today";

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toLocaleDateString(locale, opts);
  if (targetStr === yesterdayStr) return "yesterday";

  const diffMs = Date.now() - d.getTime();
  const diffDays = Math.floor(diffMs / 86_400_000);
  if (diffDays > 0 && diffDays <= 30) return `${diffDays} day${diffDays === 1 ? "" : "s"} ago`;

  return formatDate(dateStr);
}

/** "May 2026" — month and year only */
export function formatMonthYear(dateStr: string | null | undefined): string {
  const d = parseDate(dateStr);
  if (!d) return "—";
  return d.toLocaleDateString(deviceLocale(), {
    month: "long",
    year: "numeric",
    timeZone: deviceTz(),
  });
}

/**
 * "May 12 at 3:45 PM" (current year) or "May 12, 2025 at 3:45 PM" (past year).
 * Designed for compact inline timestamps in list cards.
 */
export function formatCompactDateTime(dateStr: string | null | undefined): string {
  const d = parseDate(dateStr);
  if (!d) return "—";
  const locale = deviceLocale();
  const tz = deviceTz();
  const sameYear = d.getFullYear() === new Date().getFullYear();
  const datePart = d.toLocaleDateString(locale, {
    month: "short",
    day: "numeric",
    ...(sameYear ? {} : { year: "numeric" }),
    timeZone: tz,
  });
  const timePart = d.toLocaleTimeString(locale, {
    hour: "numeric",
    minute: "2-digit",
    timeZone: tz,
  });
  return `${datePart} at ${timePart}`;
}
