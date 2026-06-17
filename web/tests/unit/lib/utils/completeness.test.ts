import { describe, it, expect } from "vitest";
import { computeCompleteness, completenessColor, type CompletenessExtras } from "@/lib/utils/completeness";
import type { JobApplication } from "@/types";

function makeApp(overrides: Partial<JobApplication> = {}): JobApplication {
  return {
    id: "app-1",
    user_id: "user-1",
    company: "Acme",
    position: "Engineer",
    status: "Applied",
    applied_date: "2026-01-01",
    job_id: null,
    job_url: null,
    salary_range: null,
    location: null,
    notes: null,
    job_description: null,
    source: null,
    ats_score: null,
    resume_path: null,
    cover_letter_path: null,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

describe("computeCompleteness", () => {
  it("scores 0 for a bare application", () => {
    const { score, total, pct, missing } = computeCompleteness(makeApp());
    expect(score).toBe(0);
    expect(total).toBe(10);
    expect(pct).toBe(0);
    expect(missing).toHaveLength(10);
  });

  it("scores 10 when all fields are filled", () => {
    const { score, missing } = computeCompleteness(makeApp({
      resume_path:      "path/resume.pdf",
      cover_letter_path:"path/cl.pdf",
      job_description:  "We need a senior engineer",
      salary_range:     "$120k",
      job_url:          "https://example.com/job",
      location:         "Remote",
      source:           "LinkedIn",
      notes:            "Great company",
      job_id:           "JOB-123",
      ats_score:        85,
    }));
    expect(score).toBe(10);
    expect(missing).toHaveLength(0);
  });

  it("scores 1 for resume_path only", () => {
    const { score, missing } = computeCompleteness(makeApp({ resume_path: "path/r.pdf" }));
    expect(score).toBe(1);
    expect(missing).not.toContain("Resume uploaded");
    expect(missing).toContain("Cover letter");
  });

  it("counts ats_score=0 as complete", () => {
    const { score } = computeCompleteness(makeApp({ ats_score: 0 }));
    expect(score).toBe(1);
  });

  it("does not count ats_score=null as complete", () => {
    const { score } = computeCompleteness(makeApp({ ats_score: null }));
    expect(score).toBe(0);
  });

  it("pct reflects score proportionally", () => {
    const { pct } = computeCompleteness(makeApp({ job_url: "https://x.com", location: "NYC" }));
    expect(pct).toBe(20);
  });
});

describe("computeCompleteness — extras (application_documents fallback)", () => {
  it("hasResumeDoc marks 'Resume uploaded' as met when resume_path is null", () => {
    const extras: CompletenessExtras = { hasResumeDoc: true };
    const { score, missing } = computeCompleteness(makeApp(), extras);
    expect(score).toBe(1);
    expect(missing).not.toContain("Resume uploaded");
    expect(missing).toContain("Cover letter");
  });

  it("hasCoverLetterDoc marks 'Cover letter' as met when cover_letter_path is null", () => {
    const extras: CompletenessExtras = { hasCoverLetterDoc: true };
    const { score, missing } = computeCompleteness(makeApp(), extras);
    expect(score).toBe(1);
    expect(missing).not.toContain("Cover letter");
    expect(missing).toContain("Resume uploaded");
  });

  it("both extras together score 2 with no legacy paths", () => {
    const extras: CompletenessExtras = { hasResumeDoc: true, hasCoverLetterDoc: true };
    const { score, missing } = computeCompleteness(makeApp(), extras);
    expect(score).toBe(2);
    expect(missing).not.toContain("Resume uploaded");
    expect(missing).not.toContain("Cover letter");
  });

  it("extras do not double-count when legacy paths are already set", () => {
    const extras: CompletenessExtras = { hasResumeDoc: true, hasCoverLetterDoc: true };
    const { score } = computeCompleteness(
      makeApp({ resume_path: "p/r.pdf", cover_letter_path: "p/cl.pdf" }),
      extras,
    );
    // Score should still be 2 for these two fields — not 4
    expect(score).toBe(2);
  });

  it("calling without extras is backward-compatible (no extras → resume_path drives score)", () => {
    const { score, missing } = computeCompleteness(makeApp({ resume_path: "p/r.pdf" }));
    expect(score).toBe(1);
    expect(missing).not.toContain("Resume uploaded");
  });

  it("false extras leave fields as unmet when legacy paths are also null", () => {
    const extras: CompletenessExtras = { hasResumeDoc: false, hasCoverLetterDoc: false };
    const { score } = computeCompleteness(makeApp(), extras);
    expect(score).toBe(0);
  });

  it("pct reflects score including extras correctly", () => {
    const extras: CompletenessExtras = { hasResumeDoc: true };
    const { pct } = computeCompleteness(makeApp({ job_url: "https://x.com" }), extras);
    // resume (1) + job_url (1) = 2 → 20%
    expect(pct).toBe(20);
  });
});

describe("completenessColor", () => {
  it("returns emerald for score >= 8", () => {
    expect(completenessColor(8)).toBe("emerald");
    expect(completenessColor(10)).toBe("emerald");
  });

  it("returns amber for score 5–7", () => {
    expect(completenessColor(5)).toBe("amber");
    expect(completenessColor(7)).toBe("amber");
  });

  it("returns red for score < 5", () => {
    expect(completenessColor(0)).toBe("red");
    expect(completenessColor(4)).toBe("red");
  });
});
