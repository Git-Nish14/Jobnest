import { beforeEach, describe, expect, it, vi } from "vitest";
import { makeChain } from "@/tests/helpers/supabase-mock";
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/security/rate-limit", () => ({ checkRateLimit: vi.fn() }));
vi.mock("@/lib/security/csrf", () => ({ verifyOrigin: vi.fn(() => true) }));
import { createClient } from "@/lib/supabase/server";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { verifyOrigin } from "@/lib/security/csrf";
import { POST as saveTemplate } from "@/app/api/nesta-ai/templates/route";
import { PUT as saveEquity } from "@/app/api/applications/[id]/equity/route";
import { GET as exportCalendar } from "@/app/api/interviews/[id]/calendar/route";

const id = "11111111-1111-4111-8111-111111111111", owner = "owner-id";
const context = { params: Promise.resolve({ id }) };
const template = { name: "Follow up", subject: "Thank you", body: "Hello [Company]", category: "Thank You" };
const equity = { equity_details: { total_shares: 1000, current_price: 5, grant_date: "2026-10-15", cliff_months: 12, vest_months: 48 } };
const request = (body: unknown, method = "POST", origin = "http://localhost") => new Request("http://localhost/api", { method, headers: { "content-type": "application/json", ...(origin ? { origin } : {}) }, body: JSON.stringify(body) });
const interview = { id, application_id: id, scheduled_at: "2026-11-01T05:30:00Z", duration_minutes: 60, type: "Technical", round: 1, status: "Scheduled" };
let chains: Record<string, ReturnType<typeof makeChain>>;
let from: ReturnType<typeof vi.fn>;
beforeEach(() => {
  vi.clearAllMocks(); vi.mocked(verifyOrigin).mockReturnValue(true);
  vi.mocked(checkRateLimit).mockReturnValue({ allowed: true, remaining: 9, resetTime: Date.now() + 60_000 });
  chains = {
    email_templates: makeChain({ data: { id, name: template.name }, error: null }),
    job_applications: makeChain({ data: { id, company: "Example", position: "Engineer" }, error: null }),
    salary_details: makeChain({ data: equity, error: null }), interviews: makeChain({ data: interview, error: null }),
  };
  from = vi.fn((table: string) => chains[table]);
  vi.mocked(createClient).mockResolvedValue({ auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: owner } }, error: null }) }, from } as never);
});
describe("template saving", () => {
  it("assigns the authenticated owner and returns the saved template", async () => {
    const response = await saveTemplate(request(template));
    expect(response.status).toBe(201);
    expect(chains.email_templates.insert).toHaveBeenCalledWith({ ...template, user_id: owner });
  });
  it.each([{ user_id: "attacker" }, { category: "Unknown" }, { name: " " }, { body: "x".repeat(10001) }])("rejects invalid or injected fields %j", async fields => {
    expect((await saveTemplate(request({ ...template, ...fields }))).status).toBe(422);
    expect(chains.email_templates.insert).not.toHaveBeenCalled();
  });
  it("reports a failed insert", async () => {
    chains.email_templates = makeChain({ data: null, error: { message: "failed" } });
    expect((await saveTemplate(request(template))).status).toBe(500);
  });
});
describe("equity saving", () => {
  it("checks application ownership and upserts only equity fields", async () => {
    const response = await saveEquity(request(equity, "PUT"), context);
    expect(response.status).toBe(200);
    expect(chains.job_applications.eq).toHaveBeenCalledWith("user_id", owner);
    expect(chains.salary_details.upsert).toHaveBeenCalledWith({ application_id: id, ...equity }, { onConflict: "application_id" });
  });
  it("does not write to an inaccessible application", async () => {
    chains.job_applications = makeChain({ data: null, error: null });
    expect((await saveEquity(request(equity, "PUT"), context)).status).toBe(404);
    expect(chains.salary_details.upsert).not.toHaveBeenCalled();
  });
  it("rejects salary field injection and invalid cliff lengths", async () => {
    expect((await saveEquity(request({ ...equity, base_salary: 100 }, "PUT"), context)).status).toBe(422);
    expect((await saveEquity(request({ equity_details: { ...equity.equity_details, cliff_months: 49 } }, "PUT"), context)).status).toBe(422);
    expect(chains.salary_details.upsert).not.toHaveBeenCalled();
  });
  it("reports failed persistence rather than success", async () => {
    chains.salary_details = makeChain({ data: null, error: { message: "failed" } });
    expect((await saveEquity(request(equity, "PUT"), context)).status).toBe(500);
  });
});
describe("private API guards", () => {
  it("requires authentication for every endpoint", async () => {
    vi.mocked(createClient).mockResolvedValue({ auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }) } } as never);
    expect((await saveTemplate(request(template))).status).toBe(401);
    expect((await saveEquity(request(equity, "PUT"), context)).status).toBe(401);
    expect((await exportCalendar(new Request("http://localhost"), context)).status).toBe(401);
    expect(from).not.toHaveBeenCalled();
  });
  it("blocks missing and foreign origins on writes", async () => {
    expect((await saveTemplate(request(template, "POST", ""))).status).toBe(403);
    vi.mocked(verifyOrigin).mockReturnValue(false);
    expect((await saveEquity(request(equity, "PUT"), context)).status).toBe(403);
    expect(from).not.toHaveBeenCalled();
  });
  it("enforces rate limits", async () => {
    vi.mocked(checkRateLimit).mockReturnValue({ allowed: false, remaining: 0, resetTime: Date.now() + 60_000 });
    expect((await saveTemplate(request(template))).status).toBe(429);
    expect((await saveEquity(request(equity, "PUT"), context)).status).toBe(429);
    expect((await exportCalendar(new Request("http://localhost"), context)).status).toBe(429);
  });
});
describe("calendar export authorization", () => {
  it("scopes interview and application to the current user and returns an attachment", async () => {
    const response = await exportCalendar(new Request("http://localhost"), context);
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/calendar");
    expect(response.headers.get("content-disposition")).toContain(`${id}.ics`);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(chains.interviews.eq).toHaveBeenCalledWith("user_id", owner);
    expect(chains.job_applications.eq).toHaveBeenCalledWith("user_id", owner);
    expect(await response.text()).toContain("BEGIN:VEVENT");
  });
  it("hides inaccessible interviews and applications", async () => {
    chains.interviews = makeChain({ data: null, error: null });
    expect((await exportCalendar(new Request("http://localhost"), context)).status).toBe(404);
    expect(chains.job_applications.select).not.toHaveBeenCalled();
    chains.interviews = makeChain({ data: interview, error: null });
    chains.job_applications = makeChain({ data: null, error: null });
    expect((await exportCalendar(new Request("http://localhost"), context)).status).toBe(404);
  });
  it("rejects malformed identifiers", async () => expect((await exportCalendar(new Request("http://localhost"), { params: Promise.resolve({ id: "bad" }) })).status).toBe(400));
});
