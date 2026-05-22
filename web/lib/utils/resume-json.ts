import { APPLICATION_SOURCES, APPLICATION_PROVIDERS } from "@/config";
import { COMPANY_TIERS } from "@/types/application";
import type { ApplicationFormData } from "@/lib/validations/application";

export interface ApplicationImportResult {
  data: Partial<ApplicationFormData>;
  fieldsImported: string[];
  warnings: string[];
}

const FIELD_LABELS: Record<string, string> = {
  company: "Company",
  position: "Position",
  applied_date: "Applied date",
  job_id: "Job ID",
  job_url: "Job URL",
  salary_range: "Salary range",
  location: "Location",
  source: "Source",
  ats_provider: "ATS provider",
  requires_sponsorship: "Requires sponsorship",
  company_tier: "Company tier",
  notes: "Notes",
  job_description: "Job description",
};

export function getApplicationImportPrompt(todayISO: string): string {
  const sources = APPLICATION_SOURCES.join(" | ");
  const providers = APPLICATION_PROVIDERS.join(" | ");
  const tiers = COMPANY_TIERS.join(" | ");

  return `Fill in the JobNest application JSON using the resume and job posting below.
Return ONLY the raw JSON — no markdown fences, no explanation, no extra text.

{
  "company": "",
  "position": "",
  "applied_date": "${todayISO}",
  "job_id": "",
  "job_url": "",
  "salary_range": "",
  "location": "",
  "source": "",
  "ats_provider": "",
  "requires_sponsorship": false,
  "company_tier": "",
  "notes": "",
  "job_description": ""
}

FIELD REFERENCE
───────────────
company              — Company name (from posting)
position             — Exact job title (from posting)
applied_date         — Today's date: ${todayISO} (keep as-is)
job_id               — Req ID from the posting, e.g. "REQ-12345" (or "")
job_url              — Direct link to this posting, must start with https:// (or "")
salary_range         — Salary if stated, e.g. "$130k – $170k / yr" (or "")
location             — Work location, e.g. "Remote", "New York, NY", "Hybrid – Seattle, WA"
source               — Where the job was found (pick one): ${sources}
ats_provider         — Application portal if identifiable (pick one): ${providers}
requires_sponsorship — true if the posting says it does NOT sponsor visas; false otherwise
company_tier         — Company prestige (pick one): ${tiers} (or "" if unsure)
notes                — 2–3 sentences: why I am a strong fit based on my resume vs. the JD
job_description      — Full job description text from the posting

MY RESUME
─────────
[paste your resume here]

JOB POSTING
───────────
[paste the job posting here]`;
}

export function parseApplicationJSON(raw: string): ApplicationImportResult {
  const warnings: string[] = [];
  const fieldsImported: string[] = [];
  const data: Partial<ApplicationFormData> = {};

  // Strip markdown code fences if the AI wrapped the JSON
  const cleaned = raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    throw new Error("Invalid JSON — check your paste and try again.");
  }

  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new Error("Expected a JSON object ({ ... }), not an array or primitive.");
  }

  // FIX 1 (security): strip null bytes before storing any string. Null bytes in
  // PostgreSQL text columns are valid storage but break some downstream processors
  // (ATS scanner, CSV export, PDF render). CRLF is preserved — it's valid in
  // multi-line fields like notes/job_description.
  const sanitizeStr = (s: string) => s.replace(/\0/g, "");

  const setString = (key: string, maxLen: number) => {
    const val = parsed[key];
    if (val === undefined || val === null || val === "") return;
    if (typeof val !== "string") {
      warnings.push(`${FIELD_LABELS[key] ?? key}: expected a string, skipped.`);
      return;
    }
    const trimmed = sanitizeStr(val).trim().slice(0, maxLen);
    if (trimmed) {
      (data as Record<string, unknown>)[key] = trimmed;
      fieldsImported.push(FIELD_LABELS[key] ?? key);
    }
  };

  const setEnum = (key: string, allowed: readonly string[]) => {
    const val = parsed[key];
    if (val === undefined || val === null || val === "") return;
    if (typeof val !== "string") {
      warnings.push(`${FIELD_LABELS[key] ?? key}: expected a string, skipped.`);
      return;
    }
    const match = allowed.find((a) => a.toLowerCase() === val.trim().toLowerCase());
    if (match) {
      (data as Record<string, unknown>)[key] = match;
      fieldsImported.push(FIELD_LABELS[key] ?? key);
    } else if (val.trim()) {
      warnings.push(`${FIELD_LABELS[key] ?? key}: "${val.trim()}" is not a recognised option, skipped.`);
    }
  };

  // Plain strings
  setString("company", 255);
  setString("position", 255);
  setString("job_id", 100);
  setString("salary_range", 100);
  setString("location", 255);
  setString("notes", 50000);
  setString("job_description", 20000);

  // FIX 2 (data integrity): validate applied_date is a real calendar date, not just
  // YYYY-MM-DD shaped. "2026-99-99" matches the regex but is rejected by the DB with
  // an opaque server error. Date.parse returns NaN for impossible dates in V8.
  const dateVal = parsed["applied_date"];
  if (dateVal !== undefined && dateVal !== null && dateVal !== "") {
    const ds = typeof dateVal === "string" ? dateVal.trim() : "";
    const isValidFormat = /^\d{4}-\d{2}-\d{2}$/.test(ds);
    const isRealDate = isValidFormat && !isNaN(Date.parse(ds));
    if (isRealDate) {
      data.applied_date = ds;
      fieldsImported.push(FIELD_LABELS["applied_date"]);
    } else {
      warnings.push(`Applied date: "${dateVal}" is not a valid YYYY-MM-DD date, skipped.`);
    }
  }

  // FIX 3 (correctness): store the normalised URL (parsedUrl.href) rather than the
  // raw AI string. This lowercases the scheme/host, removes trailing whitespace, and
  // percent-encodes any characters the AI may have left unencoded.
  const urlVal = parsed["job_url"];
  if (urlVal !== undefined && urlVal !== null && urlVal !== "") {
    if (typeof urlVal !== "string") {
      warnings.push("Job URL: expected a string, skipped.");
    } else {
      const url = sanitizeStr(urlVal).trim();
      try {
        const parsedUrl = new URL(url);
        if (parsedUrl.protocol === "https:" || parsedUrl.protocol === "http:") {
          data.job_url = parsedUrl.href; // normalised form
          fieldsImported.push(FIELD_LABELS["job_url"]);
        } else {
          warnings.push(`Job URL: scheme "${parsedUrl.protocol}" is not allowed, skipped.`);
        }
      } catch {
        warnings.push(`Job URL: "${url}" is not a valid URL, skipped.`);
      }
    }
  }

  // Enum fields
  setEnum("source", APPLICATION_SOURCES);
  setEnum("ats_provider", APPLICATION_PROVIDERS);
  setEnum("company_tier", COMPANY_TIERS);

  // requires_sponsorship — boolean (also accepts string/number coercion from AI)
  const sponsorVal = parsed["requires_sponsorship"];
  if (sponsorVal !== undefined && sponsorVal !== null) {
    if (typeof sponsorVal === "boolean") {
      data.requires_sponsorship = sponsorVal;
      fieldsImported.push(FIELD_LABELS["requires_sponsorship"]);
    } else if (sponsorVal === "true" || sponsorVal === 1) {
      data.requires_sponsorship = true;
      fieldsImported.push(FIELD_LABELS["requires_sponsorship"]);
    } else if (sponsorVal === "false" || sponsorVal === 0) {
      data.requires_sponsorship = false;
      fieldsImported.push(FIELD_LABELS["requires_sponsorship"]);
    } else {
      warnings.push("Requires sponsorship: expected true or false, skipped.");
    }
  }

  return { data, fieldsImported, warnings };
}
