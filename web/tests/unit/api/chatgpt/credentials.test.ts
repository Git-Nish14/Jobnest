import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { adminFixture, ORIGIN, TOKEN, USER_ID } from "./helpers";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));

import * as route from "@/app/api/integrations/chatgpt/credentials/route";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

let admin: ReturnType<typeof adminFixture>;
let getUser: ReturnType<typeof vi.fn>;
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("NEXT_PUBLIC_APP_URL", ORIGIN);
  admin = adminFixture();
  getUser = vi.fn().mockResolvedValue({ data: { user: { id: USER_ID } }, error: null });
  vi.mocked(createAdminClient).mockReturnValue(admin as never);
  vi.mocked(createClient).mockResolvedValue({ auth: { getUser } } as never);
});
afterEach(() => vi.unstubAllEnvs());

function disconnect(origin: string | null = ORIGIN, url = ORIGIN) {
  return new Request(`${url}/api/integrations/chatgpt/credentials?user_id=other-account`, {
    method: "DELETE", headers: origin === null ? {} : { origin },
  });
}

describe("ChatGPT connection settings", () => {
  it("does not expose a browser key-generation endpoint", () => {
    expect(route).not.toHaveProperty("POST");
  });

  it("requires a verified cookie session for metadata and disconnection", async () => {
    getUser.mockResolvedValue({ data: { user: null }, error: null });
    expect((await route.GET()).status).toBe(401);
    expect((await route.DELETE(disconnect())).status).toBe(401);
    expect(admin.from).not.toHaveBeenCalled();
    expect(admin.rpc).not.toHaveBeenCalled();
  });

  it("selects only non-secret metadata for the signed-in account", async () => {
    const metadata = { id: "credential-1", key_prefix: TOKEN.slice(0, 15), created_at: "2026-09-21T00:00:00Z", last_used_at: null, expires_at: "2027-09-21T00:00:00Z" };
    admin.credentials.maybeSingle.mockResolvedValue({ data: metadata, error: null });
    const response = await route.GET();
    expect(response.status).toBe(200);
    expect(admin.credentials.select).toHaveBeenCalledWith("id,key_prefix,created_at,last_used_at,expires_at");
    expect(admin.credentials.eq).toHaveBeenCalledWith("user_id", USER_ID);
    expect(await response.json()).toEqual({ credential: metadata });
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });

  it("represents a disconnected account with null metadata", async () => {
    admin.credentials.maybeSingle.mockResolvedValue({ data: null, error: null });
    expect(await (await route.GET()).json()).toEqual({ credential: null });
  });

  it.each([null, "null", "https://attacker.example.com"])("rejects absent/foreign Origin %s before disconnection", async (origin) => {
    expect((await route.DELETE(disconnect(origin))).status).toBe(403);
    expect(admin.rpc).not.toHaveBeenCalled();
  });

  it("does not accept spoofed host headers as a production Origin", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const request = disconnect("https://attacker.example.com");
    request.headers.set("host", "attacker.example.com");
    request.headers.set("x-forwarded-host", "attacker.example.com");
    expect((await route.DELETE(request)).status).toBe(403);
    expect(admin.rpc).not.toHaveBeenCalled();
  });

  it("revokes only the authenticated user's connection, ignoring query-string ownership", async () => {
    admin.rpc.mockResolvedValue({ data: null, error: null });
    const response = await route.DELETE(disconnect());
    expect(response.status).toBe(200);
    expect(admin.rpc).toHaveBeenCalledWith("revoke_chatgpt_credential", { p_user_id: USER_ID });
    expect(await response.json()).toEqual({ success: true });
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });

  it("reports a failed disconnect without claiming success", async () => {
    admin.rpc.mockResolvedValue({ data: null, error: { message: `private ${TOKEN}` } });
    const response = await route.DELETE(disconnect());
    expect(response.status).toBe(500);
    const body = await response.text();
    expect(body).not.toContain(TOKEN);
    expect(body).not.toContain("API key");
  });

  it("reports a failed metadata lookup without leaking database details", async () => {
    admin.credentials.maybeSingle.mockResolvedValue({ data: null, error: { message: TOKEN } });
    const response = await route.GET();
    expect(response.status).toBe(500);
    expect(await response.text()).not.toContain(TOKEN);
  });
});
