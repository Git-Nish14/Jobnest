import { describe, expect, it } from "vitest";
import { chatGptApplicationSchema } from "@/lib/chatgpt/schema";
import { getChatGptSetup } from "@/lib/chatgpt/setup";
import { safeAuthRedirect } from "@/lib/auth/redirect";

const validJob = { request_id: "save-1", company: "Acme", position: "Engineer", applied_date: "2026-09-22" };

describe("ChatGPT job validation", () => {
  it("trims inputs and defaults only the status", () => {
    expect(chatGptApplicationSchema.parse({ ...validJob, company: " Acme " })).toEqual({ ...validJob, status: "Applied" });
  });
  it.each([
    { company: "   " }, { position: " " }, { applied_date: "2026-02-30" }, { applied_date: "2026-02-29" },
    { request_id: "" }, { job_url: "javascript:alert(1)" }, { job_url: "https://" },
    { user_id: "someone-else" }, { resume_path: "private/resume.pdf" }, { notes: "x".repeat(5001) },
  ])("rejects unsafe or invalid inputs %j", (patch) => {
    expect(chatGptApplicationSchema.safeParse({ ...validJob, ...patch }).success).toBe(false);
  });
  it("accepts leap dates and known job sources", () => {
    expect(chatGptApplicationSchema.safeParse({ ...validJob, applied_date: "2024-02-29", source: "LinkedIn", job_url: "https://acme.example.com/jobs/123" }).success).toBe(true);
  });
});

describe("plugin configuration", () => {
  it("uses a public configured HTTPS origin", () => {
    expect(getChatGptSetup("https://jobnest.example.com/")).toEqual({ ready: true, mcpUrl: "https://jobnest.example.com/api/integrations/chatgpt/mcp" });
  });
  it.each(["", "oops", "http://localhost:3000", "https://localhost", "https://127.0.0.1", "https://test.local", "https://user:secret@jobnest.example.com", "https://jobnest.example.com/subpath", "https://jobnest.example.com?token=secret"])("rejects unusable origin %s", (origin) => {
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
