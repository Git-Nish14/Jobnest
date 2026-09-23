import { describe, expect, it } from "vitest";
import { chatGptApplicationSchema } from "@/lib/chatgpt/schema";
import { CHATGPT_FOLDER_INSTRUCTION, getChatGptSetup } from "@/lib/chatgpt/setup";
import { safeAuthRedirect } from "@/lib/auth/redirect";

const validJob = {
  request_id: "save-1", company: "Acme", position: "Engineer", applied_date: "2026-09-22",
  job_description: "Build and maintain Acme's software products.",
};

describe("ChatGPT job validation", () => {
  it("trims inputs and defaults only the status", () => {
    expect(chatGptApplicationSchema.parse({ ...validJob, company: " Acme " })).toEqual({ ...validJob, status: "Applied" });
  });
  it("defaults a JOBNEST save to today's application date", () => {
    const { applied_date: _date, ...withoutDate } = validJob;
    expect(chatGptApplicationSchema.parse(withoutDate).applied_date).toBe(new Date().toISOString().slice(0, 10));
  });
  it.each([
    { company: "   " }, { position: " " }, { applied_date: "2026-02-30" }, { applied_date: "2026-02-29" },
    { request_id: "" }, { job_url: "javascript:alert(1)" }, { job_url: "https://" },
    { user_id: "someone-else" }, { resume_path: "private/resume.pdf" }, { notes: "x".repeat(5001) },
    { job_description: " " },
  ])("rejects unsafe or invalid inputs %j", (patch) => {
    expect(chatGptApplicationSchema.safeParse({ ...validJob, ...patch }).success).toBe(false);
  });
  it("accepts leap dates and known job sources", () => {
    expect(chatGptApplicationSchema.safeParse({ ...validJob, applied_date: "2024-02-29", source: "LinkedIn", job_url: "https://acme.example.com/jobs/123" }).success).toBe(true);
  });
  it("requires a description but accepts a factual generated description when posting text is unavailable", () => {
    const { job_description: _description, ...withoutDescription } = validJob;
    expect(chatGptApplicationSchema.safeParse(withoutDescription).success).toBe(false);
    expect(chatGptApplicationSchema.safeParse({
      ...withoutDescription,
      job_description: "Generated from conversation: Front-end role using React and TypeScript in a hybrid New York team.",
    }).success).toBe(true);
  });
  it("accepts every user-editable application detail available to the plugin", () => {
    const parsed = chatGptApplicationSchema.parse({
      ...validJob,
      job_id: "REQ-42",
      job_url: "https://acme.example.com/jobs/42",
      salary_range: "$30-40/hr",
      location: "New York, NY (Hybrid)",
      notes: "Part-time, 20 hours/week. No sponsorship available.",
      job_description: "Complete responsibilities, qualifications, skills, benefits, and schedule from the posting.",
      source: "Handshake",
      ats_provider: "Workday",
      requires_sponsorship: true,
      company_tier: "Startup",
      glassdoor_rating: 4.2,
    });
    expect(parsed).toMatchObject({ ats_provider: "Workday", requires_sponsorship: true, company_tier: "Startup", glassdoor_rating: 4.2 });
  });
  it("preserves a complete job description up to the 20,000 character limit", () => {
    const jobDescription = `Responsibilities and qualifications\n${"x".repeat(19_964)}`;
    const parsed = chatGptApplicationSchema.parse({ ...validJob, job_description: jobDescription });
    expect(parsed.job_description).toBe(jobDescription);
    expect(parsed.job_description).toHaveLength(20_000);
    expect(chatGptApplicationSchema.safeParse({ ...validJob, job_description: `${jobDescription}x` }).success).toBe(false);
  });
  it.each([
    { ats_provider: "Handshake" }, { requires_sponsorship: "yes" },
    { company_tier: "Best company" }, { glassdoor_rating: 0.9 }, { glassdoor_rating: 4.25 },
  ])("rejects invalid extended application details %j", (patch) => {
    expect(chatGptApplicationSchema.safeParse({ ...validJob, ...patch }).success).toBe(false);
  });
});

describe("plugin configuration", () => {
  it("provides the exact instruction users put first in ChatGPT folders", () => {
    expect(CHATGPT_FOLDER_INSTRUCTION).toBe("@Jobnest Keep Jobnest available in this chat. Do not save anything yet. I will say JOBNEST only after I actually apply.");
  });
  it("uses a public configured HTTPS origin", () => {
    expect(getChatGptSetup("https://jobnest.example.com/")).toEqual({ ready: true, mcpUrl: "https://jobnest.example.com/api/integrations/chatgpt/mcp" });
  });
  it.each(["", "oops", "http://localhost:3000", "https://localhost", "https://127.0.0.1", "https://test.local", `https://user:${"secret"}@jobnest.example.com`, "https://jobnest.example.com/subpath", "https://jobnest.example.com?token=secret"])("rejects unusable origin %s", (origin) => {
    expect(getChatGptSetup(origin)).toEqual({ ready: false, mcpUrl: "" });
  });
});

describe("login return path", () => {
  it("preserves the opaque consent request", () => {
    expect(safeAuthRedirect("/integrations/chatgpt/authorize?request=abc")).toBe("/integrations/chatgpt/authorize?request=abc");
  });
  it.each([null, "", "https://evil.example", "//evil.example", "/\\evil.example", "/%5cevil.example", "/%2fevil.example", "/%252fevil.example", "/\n/evil.example", "/login"])("rejects unsafe return path %s", (path) => {
    expect(safeAuthRedirect(path)).toBe("/dashboard");
  });
});
