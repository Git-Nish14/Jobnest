import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api/errors";

vi.mock("@/lib/chatgpt/credentials", () => ({
  authenticateChatGpt: vi.fn(),
  hashChatGptKey: (value: string) => `hash:${value}`,
  readChatGptJson: async (request: Request) => request.json(),
}));
vi.mock("@/lib/chatgpt/oauth", () => ({
  CHATGPT_OAUTH_SCOPE: "applications:write",
  getChatGPTOAuthIssuer: () => "https://jobnest.example.com",
  getChatGPTProtectedResourceMetadataUrl: () => "https://jobnest.example.com/.well-known/oauth-protected-resource/api/integrations/chatgpt/mcp",
}));
vi.mock("@/lib/security/rate-limit", () => ({ checkRateLimit: vi.fn() }));
vi.mock("@/app/api/integrations/chatgpt/applications/route", () => ({ POST: vi.fn() }));

import { POST, GET, DELETE } from "@/app/api/integrations/chatgpt/mcp/route";
import { authenticateChatGpt } from "@/lib/chatgpt/credentials";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { POST as saveApplication } from "@/app/api/integrations/chatgpt/applications/route";

function request(method: string, params?: unknown, headers: Record<string, string> = {}) {
  return new Request("https://jobnest.example.com/api/integrations/chatgpt/mcp", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json, text/event-stream", Authorization: "Bearer test-token", ...headers },
    body: JSON.stringify({ jsonrpc: "2.0", id: "req-1", method, ...(params === undefined ? {} : { params }) }),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(authenticateChatGpt).mockResolvedValue({ id: "token1", user_id: "user1", expires_at: "2027-09-21T00:00:00Z" });
  vi.mocked(checkRateLimit).mockResolvedValue({ allowed: true, remaining: 59, resetTime: Date.now() + 60000 });
});

describe("ChatGPT MCP transport", () => {
  it("negotiates initialization and supplies JOBNEST instructions", async () => {
    const response = await POST(request("initialize", { protocolVersion: "future-version", capabilities: {}, clientInfo: { name: "test", version: "1" } }));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toMatchObject({ jsonrpc: "2.0", id: "req-1", result: { protocolVersion: "2025-11-25", capabilities: { tools: { listChanged: false } } } });
    expect(body.result.instructions).toContain("JOBNEST");
    expect(body.result.instructions).toContain("Always attach a non-empty job_description");
    expect(body.result.instructions).toContain("Do not ask whether they applied");
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("mcp-session-id")).toBeNull();
  });

  it("lists only the scoped write tool, with strict required input fields", async () => {
    const { result } = await (await POST(request("tools/list"))).json();
    expect(result.tools).toHaveLength(1);
    expect(result.tools[0]).toMatchObject({
      name: "save_job_application",
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
      securitySchemes: [{ type: "oauth2", scopes: ["applications:write"] }],
      inputSchema: { additionalProperties: false, required: ["request_id", "company", "position", "job_description"] },
    });
    expect(result.tools[0].inputSchema.properties.user_id).toBeUndefined();
    expect(result.tools[0].inputSchema.properties.job_description.description).toContain("complete job-description text");
    expect(result.tools[0].inputSchema.properties.job_description.description).toContain("Required for every save");
    expect(result.tools[0].inputSchema.properties.applied_date.description).toContain("Do not ask for the date");
    expect(result.tools[0].inputSchema.properties).toEqual(expect.objectContaining({
      ats_provider: expect.any(Object),
      requires_sponsorship: expect.any(Object),
      company_tier: expect.any(Object),
      glassdoor_rating: expect.any(Object),
    }));
  });

  it("returns OAuth discovery on unauthenticated POST and GET", async () => {
    vi.mocked(authenticateChatGpt).mockRejectedValue(ApiError.unauthorized());
    for (const handler of [POST, GET]) {
      const response = await handler(request("tools/list"));
      expect(response.status).toBe(401);
      expect(response.headers.get("www-authenticate")).toContain('resource_metadata="https://jobnest.example.com/.well-known/oauth-protected-resource/api/integrations/chatgpt/mcp"');
      expect(response.headers.get("www-authenticate")).toContain('scope="applications:write"');
    }
    expect(saveApplication).not.toHaveBeenCalled();
  });

  it("rejects hostile origins and unsupported protocol headers", async () => {
    expect((await POST(request("tools/list", {}, { Origin: "https://evil.example.com" }))).status).toBe(403);
    expect(authenticateChatGpt).not.toHaveBeenCalled();
    const response = await POST(request("tools/list", {}, { "MCP-Protocol-Version": "invalid" }));
    expect(response.status).toBe(400);
    expect((await response.json()).error).toMatchObject({ code: -32022, data: { requested: "invalid", supported: expect.arrayContaining(["2026-07-28"]) } });
  });

  it("requires both Streamable HTTP accept types", async () => {
    expect((await POST(request("ping", {}, { Accept: "application/json" }))).status).toBe(406);
  });

  it("accepts notifications without executing tools", async () => {
    const makeNotification = (method: string) => new Request("https://jobnest.example.com/api/integrations/chatgpt/mcp", {
      method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json, text/event-stream" },
      body: JSON.stringify({ jsonrpc: "2.0", method }),
    });
    expect((await POST(makeNotification("notifications/initialized"))).status).toBe(202);
    expect((await POST(makeNotification("tools/call"))).status).toBe(400);
    expect(saveApplication).not.toHaveBeenCalled();
  });

  it("returns structured saved data from the authenticated save service", async () => {
    const data = { success: true, duplicate: false, application: { id: "a1", company: "Acme", position: "Engineer" }, url: "https://jobnest.example.com/applications/a1" };
    vi.mocked(saveApplication).mockResolvedValue(Response.json(data, { status: 201 }) as never);
    const args = { request_id: "save1", company: "Acme", position: "Engineer", applied_date: "2026-09-22" };
    const { result } = await (await POST(request("tools/call", { name: "save_job_application", arguments: args }))).json();
    expect(result.structuredContent).toEqual(data);
    expect(JSON.parse(result.content[0].text)).toEqual(data);
    const forwarded = vi.mocked(saveApplication).mock.calls[0][0];
    expect(forwarded.headers.get("authorization")).toBe("Bearer test-token");
    expect(await forwarded.json()).toEqual(args);
    expect(forwarded.headers.has("cookie")).toBe(false);
  });

  it("preserves backend failures as tool errors, never success", async () => {
    vi.mocked(saveApplication).mockResolvedValue(Response.json({ error: "Invalid job date", details: { applied_date: ["Invalid date"] } }, { status: 422 }) as never);
    const { result } = await (await POST(request("tools/call", { name: "save_job_application", arguments: {} }))).json();
    expect(result.isError).toBe(true);
    expect(result.structuredContent).toBeUndefined();
    expect(result.content[0].text).toContain("applied_date");
  });

  it("challenges again if the token is revoked between protocol auth and save", async () => {
    vi.mocked(saveApplication).mockResolvedValue(Response.json({ error: "Revoked" }, { status: 401 }) as never);
    const response = await POST(request("tools/call", { name: "save_job_application", arguments: {} }));
    expect(response.status).toBe(401);
    expect(response.headers.get("www-authenticate")).toContain("resource_metadata");
  });

  it("declines unknown methods/tools and malformed arguments", async () => {
    expect((await (await POST(request("unknown"))).json()).error.code).toBe(-32601);
    expect((await (await POST(request("tools/call", { name: "read_jobs" }))).json()).error.code).toBe(-32602);
    expect((await (await POST(request("tools/call", []))).json()).error.code).toBe(-32602);
    expect(saveApplication).not.toHaveBeenCalled();
  });

  it("declines optional SSE and session deletion", async () => {
    expect((await GET(request("ping"))).status).toBe(405);
    expect((await DELETE(request("ping"))).status).toBe(405);
  });
});

describe("current MCP per-request protocol", () => {
  const meta = {
    "io.modelcontextprotocol/protocolVersion": "2026-07-28",
    "io.modelcontextprotocol/clientCapabilities": {},
  };
  function modernRequest(method: string, params: Record<string, unknown> = {}, headers: Record<string, string> = {}) {
    return request(method, { _meta: meta, ...params }, {
      "MCP-Protocol-Version": "2026-07-28", "Mcp-Method": method,
      ...(params.name ? { "Mcp-Name": String(params.name) } : {}), ...headers,
    });
  }
  it("supports discovery without an initialization handshake", async () => {
    const response = await POST(modernRequest("server/discover"));
    expect(response.status).toBe(200);
    expect((await response.json()).result).toMatchObject({
      resultType: "complete", supportedVersions: expect.arrayContaining(["2026-07-28", "2025-11-25"]),
      _meta: { "io.modelcontextprotocol/serverInfo": { name: "jobnest", version: "1.0.0" } },
    });
  });
  it("lists tools with the current result envelope", async () => {
    expect((await (await POST(modernRequest("tools/list"))).json()).result).toMatchObject({ resultType: "complete", tools: [expect.objectContaining({ name: "save_job_application" })] });
  });
  it("rejects missing per-request metadata", async () => {
    const response = await POST(modernRequest("tools/list", { _meta: {} }));
    expect(response.status).toBe(400);
    expect((await response.json()).error.code).toBe(-32602);
  });
  it.each([
    { "Mcp-Method": "ping" }, { "Mcp-Name": "other_tool" }, { "MCP-Protocol-Version": "2025-11-25" },
  ])("rejects mismatched routing headers before calling a tool %j", async (headers) => {
    const response = await POST(modernRequest("tools/call", { name: "save_job_application", arguments: {} }, headers));
    expect(response.status).toBe(400);
    expect((await response.json()).error.code).toBe(-32020);
    expect(saveApplication).not.toHaveBeenCalled();
  });
  it("decodes a standard base64 MCP name header", async () => {
    vi.mocked(saveApplication).mockResolvedValue(Response.json({ success: true }) as never);
    const name = `=?base64?${Buffer.from("save_job_application").toString("base64")}?=`;
    const response = await POST(modernRequest("tools/call", { name: "save_job_application", arguments: {} }, { "Mcp-Name": name }));
    expect((await response.json()).result).toMatchObject({ resultType: "complete", structuredContent: { success: true } });
  });
  it("returns HTTP 404 for unimplemented modern methods", async () => {
    const response = await POST(modernRequest("resources/list"));
    expect(response.status).toBe(404);
    expect((await response.json()).error.code).toBe(-32601);
  });
});
