/**
 * Unit tests — applicationSchema (lib/validations/application.ts)
 *
 * Focused on the fields added / changed in the ats_provider + performance
 * sprint:
 *   - ats_provider: enum-constrained, optional, null-coerced
 *   - Core required fields still reject bad values
 *   - secureUrlField rejects dangerous schemes (existing behaviour, regression
 *     guard for the job_url field touched in the same diff)
 */
import { describe, it, expect } from "vitest";
import { applicationSchema } from "@/lib/validations/application";
import { APPLICATION_PROVIDERS } from "@/config/constants";

// Minimal valid base — only the required fields
const BASE = {
  company:      "Acme Corp",
  position:     "Software Engineer",
  status:       "Applied" as const,
  applied_date: "2026-05-15",
};

// ── ats_provider ─────────────────────────────────────────────────────────────

describe("applicationSchema — ats_provider", () => {
  it("accepts every value in APPLICATION_PROVIDERS", () => {
    for (const provider of APPLICATION_PROVIDERS) {
      const result = applicationSchema.safeParse({ ...BASE, ats_provider: provider });
      expect(result.success, `expected '${provider}' to be valid`).toBe(true);
    }
  });

  it("accepts undefined (field is optional)", () => {
    const result = applicationSchema.safeParse({ ...BASE });
    expect(result.success).toBe(true);
  });

  it("accepts empty string (maps to null in the form's cleanData)", () => {
    const result = applicationSchema.safeParse({ ...BASE, ats_provider: "" });
    expect(result.success).toBe(true);
  });

  it("rejects an arbitrary string not in the enum", () => {
    const result = applicationSchema.safeParse({ ...BASE, ats_provider: "NotARealATS" });
    expect(result.success).toBe(false);
  });

  it("rejects a near-match with wrong casing", () => {
    const result = applicationSchema.safeParse({ ...BASE, ats_provider: "workday" });
    expect(result.success).toBe(false);
  });

  it("rejects a SQL-injection-style string", () => {
    const result = applicationSchema.safeParse({ ...BASE, ats_provider: "'; DROP TABLE job_applications;--" });
    expect(result.success).toBe(false);
  });
});

// ── Required fields ───────────────────────────────────────────────────────────

describe("applicationSchema — required fields", () => {
  it("rejects missing company", () => {
    const { company: _c, ...rest } = BASE;
    expect(applicationSchema.safeParse(rest).success).toBe(false);
  });

  it("rejects empty company", () => {
    expect(applicationSchema.safeParse({ ...BASE, company: "" }).success).toBe(false);
  });

  it("rejects missing position", () => {
    const { position: _p, ...rest } = BASE;
    expect(applicationSchema.safeParse(rest).success).toBe(false);
  });

  it("rejects invalid status", () => {
    expect(applicationSchema.safeParse({ ...BASE, status: "Hired" }).success).toBe(false);
  });

  it("rejects malformed applied_date", () => {
    expect(applicationSchema.safeParse({ ...BASE, applied_date: "15-05-2026" }).success).toBe(false);
  });
});

// ── notes field — new max constraint ─────────────────────────────────────────

describe("applicationSchema — notes field (max 50 000 chars)", () => {
  it("accepts notes within the limit", () => {
    expect(applicationSchema.safeParse({ ...BASE, notes: "a".repeat(50000) }).success).toBe(true);
  });

  it("rejects notes exceeding 50 000 characters", () => {
    const result = applicationSchema.safeParse({ ...BASE, notes: "a".repeat(50001) });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe("Notes cannot exceed 50 000 characters");
  });

  it("accepts undefined notes (field is optional)", () => {
    expect(applicationSchema.safeParse({ ...BASE }).success).toBe(true);
  });

  it("accepts an empty string for notes", () => {
    expect(applicationSchema.safeParse({ ...BASE, notes: "" }).success).toBe(true);
  });

  it("accepts multi-line notes with newlines and unicode", () => {
    const notes = "Line one\nLine two\n• Bullet ✓ emoji 🎉 — unicode safe\n".repeat(100);
    expect(applicationSchema.safeParse({ ...BASE, notes }).success).toBe(true);
  });
});

// ── company_tier ─────────────────────────────────────────────────────────────

describe("applicationSchema — company_tier", () => {
  it("accepts every valid tier value", () => {
    for (const tier of ["FAANG", "Tier 1", "Tier 2", "Tier 3", "Startup"] as const) {
      const result = applicationSchema.safeParse({ ...BASE, company_tier: tier });
      expect(result.success, `expected '${tier}' to be valid`).toBe(true);
    }
  });

  it("accepts undefined (field is optional)", () => {
    const result = applicationSchema.safeParse({ ...BASE });
    expect(result.success).toBe(true);
  });

  it("accepts empty string (maps to null in form cleanData)", () => {
    const result = applicationSchema.safeParse({ ...BASE, company_tier: "" });
    expect(result.success).toBe(true);
  });

  it("rejects an arbitrary string not in the enum", () => {
    const result = applicationSchema.safeParse({ ...BASE, company_tier: "Unicorn" });
    expect(result.success).toBe(false);
  });

  it("rejects wrong casing ('faang')", () => {
    const result = applicationSchema.safeParse({ ...BASE, company_tier: "faang" });
    expect(result.success).toBe(false);
  });

  it("rejects an injection-style string", () => {
    const result = applicationSchema.safeParse({ ...BASE, company_tier: "'; DROP TABLE job_applications;--" });
    expect(result.success).toBe(false);
  });
});

// ── source field (existing, regression guard) ─────────────────────────────────

describe("applicationSchema — source", () => {
  it("accepts a valid source", () => {
    expect(applicationSchema.safeParse({ ...BASE, source: "LinkedIn" }).success).toBe(true);
  });

  it("accepts empty string for source", () => {
    expect(applicationSchema.safeParse({ ...BASE, source: "" }).success).toBe(true);
  });

  it("rejects an invalid source", () => {
    expect(applicationSchema.safeParse({ ...BASE, source: "TikTok" }).success).toBe(false);
  });
});

// ── job_url — secureUrlField (regression guard) ───────────────────────────────

describe("applicationSchema — job_url security", () => {
  it("accepts a valid https URL", () => {
    expect(applicationSchema.safeParse({ ...BASE, job_url: "https://example.com/jobs/1" }).success).toBe(true);
  });

  it("accepts empty string (no URL set)", () => {
    expect(applicationSchema.safeParse({ ...BASE, job_url: "" }).success).toBe(true);
  });

  it("rejects a javascript: scheme URL", () => {
    expect(applicationSchema.safeParse({ ...BASE, job_url: "javascript:alert(1)" }).success).toBe(false);
  });

  it("rejects a data: scheme URL", () => {
    expect(applicationSchema.safeParse({ ...BASE, job_url: "data:text/html,<script>alert(1)</script>" }).success).toBe(false);
  });

  it("rejects a plain string that is not a URL", () => {
    expect(applicationSchema.safeParse({ ...BASE, job_url: "not-a-url" }).success).toBe(false);
  });
});

// ── secureUrlField — tab-character bypass regression (security fix) ───────────

describe("applicationSchema — job_url tab-bypass (secureUrlField security)", () => {
  it("rejects javascript\t: scheme — tab interleaved to bypass startsWith denylist", () => {
    // The WHATWG URL parser strips tabs before resolving the scheme, so
    // "javascript\t:" is equivalent to "javascript:" in browsers.
    // The fix uses new URL(v).protocol allowlist instead of raw startsWith().
    expect(
      applicationSchema.safeParse({ ...BASE, job_url: "javascript\t:alert(1)" }).success
    ).toBe(false);
  });

  it("rejects vbscript: scheme", () => {
    expect(
      applicationSchema.safeParse({ ...BASE, job_url: "vbscript:msgbox(1)" }).success
    ).toBe(false);
  });

  it("rejects ftp:// scheme — only http and https are allowed", () => {
    expect(
      applicationSchema.safeParse({ ...BASE, job_url: "ftp://files.example.com/resume.pdf" }).success
    ).toBe(false);
  });

  it("accepts http:// (not just https)", () => {
    expect(
      applicationSchema.safeParse({ ...BASE, job_url: "http://example.com/jobs/1" }).success
    ).toBe(true);
  });

  it("rejects javascript: with leading whitespace (belt-and-suspenders)", () => {
    expect(
      applicationSchema.safeParse({ ...BASE, job_url: "  javascript:alert(1)" }).success
    ).toBe(false);
  });
});

// ── glassdoor_rating — schema is unaffected (field managed as separate state) ─

describe("applicationSchema — glassdoor_rating is not a schema field", () => {
  it("schema parse succeeds without glassdoor_rating (field is optional out-of-band state)", () => {
    expect(applicationSchema.safeParse({ ...BASE }).success).toBe(true);
  });
});
