import { describe, it, expect } from "vitest";
import { computeCompleteness, completenessColor } from "@/lib/utils/completeness";
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
