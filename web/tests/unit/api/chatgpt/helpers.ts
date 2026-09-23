import { vi } from "vitest";

export const TOKEN = `jobnest_${"a".repeat(64)}`;
export const ORIGIN = "https://jobnest.example.com";
export const RESOURCE = `${ORIGIN}/api/integrations/chatgpt/mcp`;
export const USER_ID = "00000000-0000-4000-8000-000000000001";
export const credential = {
  id: "credential-1", user_id: USER_ID, expires_at: "2099-01-01T00:00:00.000Z",
  resource: RESOURCE, scope: "applications:read applications:write",
};
export const job = {
  request_id: "request-1", company: "Acme", position: "Engineer", applied_date: "2026-09-21",
  job_url: "https://acme.example.com/jobs/engineer",
  location: "Chicago, IL (Hybrid)",
  job_description: "Build and maintain Acme's software products.",
};
export const savedApplication = { id: "application-1", company: job.company, position: job.position, applied_date: job.applied_date, status: "Applied" };

export function chain(data: unknown, error: unknown = null) {
  return {
    select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), is: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({ data, error }),
  };
}

export function adminFixture() {
  const credentials = chain(credential);
  const deletion = chain(null);
  return {
    from: vi.fn((table: string) => {
      if (table === "chatgpt_credentials") return credentials;
      if (table === "pending_deletions") return deletion;
      throw new Error(`Unexpected table ${table}`);
    }),
    rpc: vi.fn().mockResolvedValue({ data: { application: savedApplication, duplicate: false }, error: null }),
    auth: { admin: { getUserById: vi.fn().mockResolvedValue({ data: { user: { id: USER_ID } }, error: null }) } },
    credentials, deletion,
  };
}

export function saveRequest(body: unknown = job, headers: Record<string, string> = {}) {
  return new Request(`${ORIGIN}/api/integrations/chatgpt/applications`, {
    method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${TOKEN}`, ...headers },
    body: JSON.stringify(body),
  });
}
