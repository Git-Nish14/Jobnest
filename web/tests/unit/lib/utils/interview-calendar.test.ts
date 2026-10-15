import { describe, expect, it } from "vitest";
import { foldCalendarLine, interviewCalendar } from "@/lib/utils/interview-calendar";
import type { Interview } from "@/types";

const interview = { id: "11111111-1111-4111-8111-111111111111", type: "Technical", round: 2,
  scheduled_at: "2026-11-01T01:30:00-04:00", duration_minutes: 60, timezone: "America/New_York", status: "Scheduled",
  location: "Office, Floor 2; West", meeting_url: "https://meet.example.test/join?a=1&b=2",
  updated_at: "2026-10-15T12:00:00Z", preparation_notes: "PRIVATE PREPARATION", post_interview_notes: "PRIVATE NOTES" } as Interview;
const company = { company: "Example", position: "Engineer" };
const now = new Date("2026-10-15T12:01:00Z");

describe("interview calendar", () => {
  it("preserves the instant across a daylight-saving transition", () => {
    const value = interviewCalendar(interview, company, now);
    expect(value).toContain("DTSTART:20261101T053000Z\r\nDTEND:20261101T063000Z");
    expect(value).toContain("UID:11111111-1111-4111-8111-111111111111@jobnest");
    expect(value).toContain("DTSTAMP:20261015T120100Z");
    expect(value).toContain("Interview timezone: America/New_York");
    expect(value).not.toContain("PRIVATE");
    expect(value.endsWith("END:VCALENDAR\r\n")).toBe(true);
    expect(value.replaceAll("\r\n", "")).not.toMatch(/[\r\n]/);
  });
  it("escapes text and prevents new properties through untrusted text", () => {
    const value = interviewCalendar({ ...interview, location: "Room\\A, B; C\r\nATTENDEE:evil" }, company, now);
    expect(value).toContain("LOCATION:Room\\\\A\\, B\\; C\\nATTENDEE:evil");
    expect(value).not.toContain("\r\nATTENDEE:");
  });
  it("folds unicode without corrupting characters or exceeding 75 bytes", () => {
    const original = "SUMMARY:" + "🪺履歴書 é".repeat(40);
    const folded = foldCalendarLine(original);
    expect(folded.replaceAll("\r\n ", "")).toBe(original);
    for (const line of folded.split("\r\n")) expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75);
  });
  it.each(["javascript:alert(1)", "data:text/plain,evil", "https://user:secret@example.com", "invalid"])("omits unsafe meeting URL %s", meeting_url => {
    expect(interviewCalendar({ ...interview, meeting_url }, company, now)).not.toMatch(/\r\nURL:/);
  });
  it("marks cancellations and defaults absent duration to an hour", () => {
    const value = interviewCalendar({ ...interview, status: "Cancelled", duration_minutes: null } as unknown as Interview, company, now);
    expect(value).toContain("STATUS:CANCELLED"); expect(value).toContain("DTEND:20261101T063000Z");
  });
  it.each([0, -10, Infinity, NaN, 1441])("rejects invalid duration %s", duration_minutes => {
    expect(() => interviewCalendar({ ...interview, duration_minutes }, company, now)).toThrow();
  });
  it("rejects corrupt timestamps and identifiers", () => {
    expect(() => interviewCalendar({ ...interview, scheduled_at: "invalid" }, company, now)).toThrow();
    expect(() => interviewCalendar({ ...interview, id: "bad\r\nUID:injected" }, company, now)).toThrow();
  });
});
