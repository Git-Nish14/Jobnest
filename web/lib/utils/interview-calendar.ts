import type { Interview } from "@/types";

const stamp = (value: string | Date) => {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) throw new Error("Invalid interview date");
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
};
const text = (value: string) => value.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "")
  .replace(/\\/g, "\\\\").replace(/\r\n|\r|\n/g, "\\n").replace(/;/g, "\\;").replace(/,/g, "\\,");

/** Fold on UTF-8 octet boundaries, including the continuation space (RFC 5545). */
export function foldCalendarLine(line: string): string {
  const lines: string[] = [];
  let part = "";
  let bytes = 0;
  for (const character of line) {
    const size = new TextEncoder().encode(character).length;
    if (bytes + size > 75) { lines.push(part); part = " "; bytes = 1; }
    part += character;
    bytes += size;
  }
  lines.push(part);
  return lines.join("\r\n");
}

export function interviewCalendar(interview: Interview, application: { company: string; position: string }, now = new Date()): string {
  if (!/^[a-f0-9-]{36}$/i.test(interview.id)) throw new Error("Invalid interview identifier");
  const start = new Date(interview.scheduled_at);
  const duration = interview.duration_minutes ?? 60;
  if (!Number.isFinite(duration) || duration < 1 || duration > 1440) throw new Error("Invalid duration");
  let meetingUrl: string | null = null;
  try {
    const url = new URL(interview.meeting_url ?? "");
    if (["https:", "http:"].includes(url.protocol) && !url.username && !url.password) meetingUrl = url.href;
  } catch { /* An absent or invalid meeting link is omitted. */ }
  const description = [`${application.position} at ${application.company}`, `Interview timezone: ${interview.timezone || "UTC"}`, meetingUrl ? `Join: ${meetingUrl}` : ""].filter(Boolean).join("\n");
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//JobNest//Interviews//EN", "CALSCALE:GREGORIAN", "BEGIN:VEVENT",
    `UID:${interview.id}@jobnest`, `DTSTAMP:${stamp(now)}`, `DTSTART:${stamp(start)}`,
    `DTEND:${stamp(new Date(start.getTime() + duration * 60_000))}`,
    `SUMMARY:${text(`${interview.type} · Round ${interview.round} · ${application.company}`)}`,
    `DESCRIPTION:${text(description)}`, `STATUS:${interview.status === "Cancelled" ? "CANCELLED" : "CONFIRMED"}`];
  if (interview.location) lines.push(`LOCATION:${text(interview.location)}`);
  if (meetingUrl) lines.push(`URL:${meetingUrl}`);
  if (interview.updated_at) lines.push(`LAST-MODIFIED:${stamp(interview.updated_at)}`);
  lines.push("END:VEVENT", "END:VCALENDAR");
  return lines.map(foldCalendarLine).join("\r\n") + "\r\n";
}
