import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { adminFixture, credential, ORIGIN, TOKEN, USER_ID } from "./helpers";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));

import { authenticateChatGpt, CHATGPT_MAX_BODY_BYTES, generateChatGptKey, getChatGptKeyHash, hashChatGptKey, readChatGptJson } from "@/lib/chatgpt/credentials";
import { createAdminClient } from "@/lib/supabase/admin";

let admin: ReturnType<typeof adminFixture>;
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("NEXT_PUBLIC_APP_URL", ORIGIN);
  admin = adminFixture();
  vi.mocked(createAdminClient).mockReturnValue(admin as never);
});
afterEach(() => vi.unstubAllEnvs());

function authenticatedRequest() {
  return new Request(ORIGIN, { headers: { authorization: `Bearer ${TOKEN}` } });
}

describe("ChatGPT bearer credential security", () => {
  it("generates unique 256-bit opaque tokens and stores their SHA-256 digest", () => {
    const first = generateChatGptKey();
    const second = generateChatGptKey();
    expect(first.apiKey).toMatch(/^jobnest_[a-f0-9]{64}$/);
    expect(first.apiKey).not.toBe(second.apiKey);
    expect(first.keyHash).toBe(hashChatGptKey(first.apiKey));
    expect(first.keyPrefix).toBe(first.apiKey.slice(0, 15));
  });

  it("does not authenticate with a URL or cookie token", () => {
    expect(() => getChatGptKeyHash(new Request(`${ORIGIN}?access_token=${TOKEN}`, { headers: { cookie: `token=${TOKEN}` } })))
      .toThrow("valid Jobnest connection");
  });

  it("checks the credential's account before allowing MCP protocol requests", async () => {
    expect(await authenticateChatGpt(authenticatedRequest())).toEqual(credential);
    expect(admin.auth.admin.getUserById).toHaveBeenCalledWith(USER_ID);
    expect(admin.deletion.eq).toHaveBeenCalledWith("user_id", USER_ID);
  });

  it.each([
    null, { id: USER_ID, banned_until: "2099-01-01T00:00:00Z" }, { id: USER_ID, deleted_at: "2026-09-20T00:00:00Z" },
  ])("rejects missing, banned and deleted accounts", async (user) => {
    admin.auth.admin.getUserById.mockResolvedValue({ data: { user }, error: null });
    await expect(authenticateChatGpt(authenticatedRequest())).rejects.toMatchObject({ statusCode: 401 });
  });

  it("rejects an account scheduled for deletion", async () => {
    admin.deletion.maybeSingle.mockResolvedValue({ data: { id: "pending-1" }, error: null });
    await expect(authenticateChatGpt(authenticatedRequest())).rejects.toMatchObject({ statusCode: 401 });
  });

  it("fails closed when account availability cannot be checked", async () => {
    admin.deletion.maybeSingle.mockResolvedValue({ data: null, error: { message: "unavailable" } });
    await expect(authenticateChatGpt(authenticatedRequest())).rejects.toMatchObject({ statusCode: 500 });
  });

  it("accepts an elapsed account ban", async () => {
    admin.auth.admin.getUserById.mockResolvedValue({ data: { user: { id: USER_ID, banned_until: "2000-01-01T00:00:00Z" } }, error: null });
    expect(await authenticateChatGpt(authenticatedRequest())).toEqual(credential);
  });
});

describe("ChatGPT bounded JSON reader", () => {
  function request(body: BodyInit | null, headers: Record<string, string> = {}) {
    return new Request(ORIGIN, { method: "POST", body, headers: { "content-type": "application/json", ...headers } });
  }

  it("accepts JSON with an explicit UTF-8 charset", async () => {
    expect(await readChatGptJson(request('{"company":"Acme"}', { "content-type": "application/json; charset=utf-8" }))).toEqual({ company: "Acme" });
  });

  it("requires JSON content type", async () => {
    await expect(readChatGptJson(request("{}", { "content-type": "text/plain" }))).rejects.toMatchObject({ statusCode: 415 });
  });

  it.each([null, "", "{malformed"])("rejects missing or invalid JSON %s", async (body) => {
    await expect(readChatGptJson(request(body))).rejects.toMatchObject({ statusCode: 400 });
  });

  it("rejects an advertised oversize body before reading", async () => {
    const input = request("{}", { "content-length": String(CHATGPT_MAX_BODY_BYTES + 1) });
    await expect(readChatGptJson(input)).rejects.toMatchObject({ statusCode: 413 });
    expect(input.bodyUsed).toBe(false);
  });

  it("rejects oversized chunked input even with absent or lying Content-Length", async () => {
    const body = JSON.stringify({ notes: "x".repeat(CHATGPT_MAX_BODY_BYTES) });
    await expect(readChatGptJson(request(body))).rejects.toMatchObject({ statusCode: 413 });
    await expect(readChatGptJson(request(body, { "content-length": "2" }))).rejects.toMatchObject({ statusCode: 413 });
  });

  it("limits UTF-8 bytes, not JavaScript character count", async () => {
    const body = JSON.stringify({ notes: "\u20ac".repeat(24_000) });
    expect(body.length).toBeLessThan(CHATGPT_MAX_BODY_BYTES);
    await expect(readChatGptJson(request(body))).rejects.toMatchObject({ statusCode: 413 });
  });

  it("accepts valid JSON at exactly the byte limit", async () => {
    const body = `"${"x".repeat(CHATGPT_MAX_BODY_BYTES - 2)}"`;
    expect(await readChatGptJson(request(body))).toHaveLength(CHATGPT_MAX_BODY_BYTES - 2);
  });

  it("rejects malformed UTF-8 rather than replacing corrupted characters", async () => {
    await expect(readChatGptJson(request(new Uint8Array([0x22, 0xc3, 0x28, 0x22])))).rejects.toMatchObject({ statusCode: 400 });
  });
});
