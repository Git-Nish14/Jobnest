import { beforeEach, describe, expect, it, vi } from "vitest";
import { makeChain } from "@/tests/helpers/supabase-mock";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/security/rate-limit", () => ({ checkRateLimit: vi.fn() }));

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { checkRateLimit } from "@/lib/security/rate-limit";
import {
  beginChatGPTOAuthAuthorization, completeChatGPTOAuthConsent, exchangeChatGPTOAuthCode,
  getChatGPTOAuthIssuer, hashOAuthSecret, isPublicHttpsRedirect, pkceChallenge, uniqueOAuthParameters,
} from "@/lib/chatgpt/oauth";
import { POST as register } from "@/app/api/integrations/chatgpt/oauth/register/route";
import { GET as authorize } from "@/app/api/integrations/chatgpt/oauth/authorize/route";
import { GET as getConsent, POST as consent } from "@/app/api/integrations/chatgpt/oauth/consent/route";
import { POST as token } from "@/app/api/integrations/chatgpt/oauth/token/route";
import { GET as authorizationMetadata } from "@/app/.well-known/oauth-authorization-server/route";
import { GET as resourceMetadata } from "@/app/.well-known/oauth-protected-resource/api/integrations/chatgpt/mcp/route";

const issuer = "https://jobnest.app";
const resource = `${issuer}/api/integrations/chatgpt/mcp`;
const redirectUri = "https://chatgpt.com/connector_platform_oauth_redirect";
const clientId = `jobnest_client_${"a".repeat(32)}`;
const requestId = "r".repeat(43);
const code = "c".repeat(43);
const verifier = "v".repeat(43);
const userId = "00000000-0000-4000-8000-000000000001";
let from: ReturnType<typeof vi.fn>;
let rpc: ReturnType<typeof vi.fn>;
let getUser: ReturnType<typeof vi.fn>;

function authParameters(overrides: Record<string, string> = {}) {
  return new URLSearchParams({ response_type: "code", client_id: clientId, redirect_uri: redirectUri,
    state: "state_from_chatgpt", code_challenge: pkceChallenge(verifier), code_challenge_method: "S256",
    resource, scope: "applications:read applications:write", ...overrides });
}

function tokenParameters(overrides: Record<string, string> = {}) {
  return new URLSearchParams({ grant_type: "authorization_code", client_id: clientId, redirect_uri: redirectUri,
    code, code_verifier: verifier, resource, ...overrides });
}

function jsonRequest(path: string, body: unknown, origin: string | null = issuer) {
  return new Request(`${issuer}/api/integrations/chatgpt/oauth/${path}`, {
    method: "POST", headers: { "content-type": "application/json", ...(origin ? { origin } : {}) }, body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.resetAllMocks();
  process.env.NEXT_PUBLIC_APP_URL = issuer;
  from = vi.fn().mockReturnValue(makeChain({ data: { redirect_uris: [redirectUri] }, error: null }));
  rpc = vi.fn().mockResolvedValue({ data: null, error: null });
  getUser = vi.fn().mockResolvedValue({ data: { user: { id: userId } }, error: null });
  vi.mocked(createAdminClient).mockReturnValue({ from, rpc } as never);
  vi.mocked(createClient).mockResolvedValue({ auth: { getUser } } as never);
  vi.mocked(checkRateLimit).mockResolvedValue({ allowed: true } as never);
});

describe("OAuth discovery and canonical URLs", () => {
  it("advertises matching resources, exact issuer, DCR, S256, and only implemented grants", async () => {
    const auth = await authorizationMetadata();
    const metadata = await auth.json();
    const protectedResource = await (await resourceMetadata()).json();
    expect(metadata).toMatchObject({ issuer, token_endpoint_auth_methods_supported: ["none"],
      grant_types_supported: ["authorization_code"], code_challenge_methods_supported: ["S256"],
      authorization_response_iss_parameter_supported: true, scopes_supported: ["applications:read", "applications:write"] });
    expect(metadata.registration_endpoint).toBe(`${issuer}/api/integrations/chatgpt/oauth/register`);
    expect(protectedResource).toMatchObject({ resource, authorization_servers: [issuer], bearer_methods_supported: ["header"] });
    expect(auth.headers.get("cache-control")).toBe("no-store");
  });

  it.each(["http://jobnest.app", `https://user:${"password"}@jobnest.app`, "https://jobnest.app/path", "https://127.0.0.1", "https://jobnest.app?x=y"])("rejects unsafe issuer %s", (value) => {
    process.env.NEXT_PUBLIC_APP_URL = value;
    expect(getChatGPTOAuthIssuer).toThrow();
  });

  it("requires NEXT_PUBLIC_APP_URL even when the legacy SITE variable exists", () => {
    delete process.env.NEXT_PUBLIC_APP_URL;
    process.env.NEXT_PUBLIC_SITE_URL = issuer;
    expect(getChatGPTOAuthIssuer).toThrow();
    delete process.env.NEXT_PUBLIC_SITE_URL;
  });
});

describe("dynamic public-client registration", () => {
  it("registers exact HTTPS redirects without creating a secret or trusting unrequested grants", async () => {
    const chain = makeChain();
    from.mockReturnValue(chain);
    const response = await register(jsonRequest("register", { client_name: "ChatGPT", redirect_uris: [redirectUri] }));
    expect(response.status).toBe(201);
    const body = await response.json();
    expect(body.client_id).toMatch(/^jobnest_client_[a-f0-9]{32}$/);
    expect(body).toMatchObject({ redirect_uris: [redirectUri], token_endpoint_auth_method: "none", grant_types: ["authorization_code"] });
    expect(body).not.toHaveProperty("client_secret");
    expect(chain.insert).toHaveBeenCalledWith(expect.objectContaining({ client_id: body.client_id, redirect_uris: [redirectUri] }));
  });

  it("accepts broader ChatGPT DCR metadata and returns only capabilities Jobnest supports", async () => {
    const chain = makeChain();
    from.mockReturnValue(chain);
    const callbackRedirect = "https://chatgpt.com/connector/oauth/callback-id";
    const response = await register(jsonRequest("register", {
      client_name: "ChatGPT Plugin Connector",
      redirect_uris: [callbackRedirect, callbackRedirect],
      token_endpoint_auth_method: "none",
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
      scope: "applications:write offline_access",
      application_type: "web",
    }));
    expect(response.status).toBe(201);
    expect(await response.json()).toMatchObject({
      client_name: "ChatGPT Plugin Connector",
      redirect_uris: [callbackRedirect],
      token_endpoint_auth_method: "none",
      grant_types: ["authorization_code"],
      response_types: ["code"],
      scope: "applications:read applications:write",
    });
    expect(chain.insert).toHaveBeenCalledWith(expect.objectContaining({ redirect_uris: [callbackRedirect] }));
  });

  it.each(["http://chatgpt.com/callback", "https://localhost/callback", "https://127.0.0.1/callback",
    "https://[::1]/callback", "https://a.internal/callback", "https://chatgpt.com/#fragment",
    `https://user:${"pass"}@chatgpt.com/callback`, "https://chatgpt.com:8443/callback", "https://chatgpt.com\\@evil.com/callback"])("rejects unsafe redirect %s", async (uri) => {
    expect(isPublicHttpsRedirect(uri)).toBe(false);
    const response = await register(jsonRequest("register", { redirect_uris: [uri] }));
    expect(response.status).toBe(400);
    expect(from).not.toHaveBeenCalled();
  });

  it.each([{ token_endpoint_auth_method: "client_secret_basic" }, { grant_types: ["refresh_token"] }, { response_types: ["token"] }])("rejects registration metadata without the required public authorization-code flow %o", async (extra) => {
    const response = await register(jsonRequest("register", { redirect_uris: [redirectUri], ...extra }));
    expect(response.status).toBe(400);
    expect((await response.json()).error_description).toMatch(/Invalid client metadata fields:/);
  });
});

describe("authorization and explicit account consent", () => {
  it("stores only the request hash, ties the request to PKCE/resource, and redirects to consent", async () => {
    const insert = makeChain();
    from.mockReturnValueOnce(makeChain({ data: { redirect_uris: [redirectUri] }, error: null })).mockReturnValueOnce(insert);
    const response = await authorize(new Request(`${issuer}/api/integrations/chatgpt/oauth/authorize?${authParameters()}`,
      { headers: { host: "attacker.com", "x-forwarded-host": "attacker.com" } }));
    expect(response.status).toBe(303);
    const location = new URL(response.headers.get("location")!);
    expect(location.origin).toBe(issuer);
    expect(location.pathname).toBe("/integrations/chatgpt/authorize");
    const id = location.searchParams.get("request")!;
    expect(id).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(insert.insert).toHaveBeenCalledWith(expect.objectContaining({ request_hash: hashOAuthSecret(id),
      code_challenge: pkceChallenge(verifier), redirect_uri: redirectUri, resource, scope: "applications:read applications:write" }));
    expect(JSON.stringify(vi.mocked(insert.insert).mock.calls)).not.toContain(id);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("accepts the exact granted scope set in either OAuth ordering and stores it canonically", async () => {
    const insert = makeChain();
    from.mockReturnValueOnce(makeChain({ data: { redirect_uris: [redirectUri] }, error: null })).mockReturnValueOnce(insert);
    const consentUrl = await beginChatGPTOAuthAuthorization(authParameters({ scope: "applications:write applications:read" }));
    expect(new URL(consentUrl).pathname).toBe("/integrations/chatgpt/authorize");
    expect(insert.insert).toHaveBeenCalledWith(expect.objectContaining({ scope: "applications:read applications:write" }));
  });

  it("does not redirect to a URI that differs from the registered URI", async () => {
    const response = await authorize(new Request(`${issuer}/api/integrations/chatgpt/oauth/authorize?${authParameters({ redirect_uri: `${redirectUri}/other` })}`));
    expect(response.status).toBe(400);
    expect(response.headers.has("location")).toBe(false);
  });

  it.each([{ code_challenge_method: "plain" }, { scope: "applications:read" }, { resource: "https://other.app/mcp" }, { response_type: "token" }])("returns issuer-identified error to verified callback for %o", async (extra) => {
    const url = new URL(await beginChatGPTOAuthAuthorization(authParameters(extra)));
    expect(`${url.origin}${url.pathname}`).toBe(redirectUri);
    expect(url.searchParams.get("iss")).toBe(issuer);
    expect(url.searchParams.get("state")).toBe("state_from_chatgpt");
    expect(url.searchParams.has("error")).toBe(true);
    expect(url.searchParams.has("code")).toBe(false);
  });

  it("rejects repeated parameters including prototype property names", () => {
    expect(() => uniqueOAuthParameters(new URLSearchParams("resource=a&resource=b"))).toThrow();
    expect(() => uniqueOAuthParameters(new URLSearchParams("__proto__=a&__proto__=b"))).toThrow();
  });

  it("requires a signed-in account before reading consent", async () => {
    getUser.mockResolvedValue({ data: { user: null }, error: null });
    const response = await getConsent(new Request(`${issuer}/api/integrations/chatgpt/oauth/consent?request=${requestId}`));
    expect(response.status).toBe(401);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("claims consent for the cookie account and exposes only display metadata", async () => {
    rpc.mockResolvedValue({ data: { client_name: "ChatGPT", redirect_uri: redirectUri, expires_at: "2026-09-22T12:00:00Z" }, error: null });
    const response = await getConsent(new Request(`${issuer}/api/integrations/chatgpt/oauth/consent?request=${requestId}`));
    expect(await response.json()).toEqual({ clientName: "ChatGPT", redirectHost: "chatgpt.com", expiresAt: "2026-09-22T12:00:00Z", scope: "applications:read applications:write" });
    expect(rpc).toHaveBeenCalledWith("claim_chatgpt_oauth_request", { p_request_hash: hashOAuthSecret(requestId), p_user_id: userId });
  });

  it.each([null, "https://evil.app"])("requires a trusted browser Origin for approval (%s)", async (origin) => {
    const response = await consent(jsonRequest("consent", { requestId, approved: true }, origin));
    expect(response.status).toBe(403);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("ignores no identity override from the browser", async () => {
    const response = await consent(jsonRequest("consent", { requestId, approved: true, userId: "another-user" }));
    expect(response.status).toBe(400);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("returns one-time code and issuer after explicit approval without storing the raw code", async () => {
    rpc.mockResolvedValue({ data: { redirect_uri: redirectUri, state: "original-state" }, error: null });
    const response = await consent(jsonRequest("consent", { requestId, approved: true }));
    const location = new URL((await response.json()).redirectUrl);
    const issuedCode = location.searchParams.get("code")!;
    expect(issuedCode).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(location.searchParams.get("iss")).toBe(issuer);
    expect(location.searchParams.get("state")).toBe("original-state");
    expect(rpc).toHaveBeenCalledWith("complete_chatgpt_oauth_consent", { p_request_hash: hashOAuthSecret(requestId), p_user_id: userId, p_code_hash: hashOAuthSecret(issuedCode) });
  });

  it("cancels with access_denied and iss, removing injected response query fields", async () => {
    rpc.mockResolvedValue({ data: { redirect_uri: `${redirectUri}?code=injected&error=other&custom=kept`, state: "original-state" }, error: null });
    const location = new URL(await completeChatGPTOAuthConsent(requestId, userId, false));
    expect(location.searchParams.get("error")).toBe("access_denied");
    expect(location.searchParams.get("iss")).toBe(issuer);
    expect(location.searchParams.get("custom")).toBe("kept");
    expect(location.searchParams.has("code")).toBe(false);
    expect(rpc).toHaveBeenCalledWith("complete_chatgpt_oauth_consent", expect.objectContaining({ p_code_hash: null }));
  });

  it("fails closed when the database rejects expired, reused, or account-mismatched consent", async () => {
    const response = await consent(jsonRequest("consent", { requestId, approved: true }));
    expect(response.status).toBe(400);
    expect(await response.json()).not.toHaveProperty("redirectUrl");
  });
});

describe("code exchange", () => {
  it("binds client, redirect, resource and S256 while returning only the raw token to the OAuth client", async () => {
    rpc.mockResolvedValue({ data: { expires_at: new Date(Date.now() + 365 * 86400 * 1000).toISOString() }, error: null });
    const result = await exchangeChatGPTOAuthCode(tokenParameters());
    expect(result.access_token).toMatch(/^jobnest_[a-f0-9]{64}$/);
    expect(result.token_type).toBe("Bearer");
    expect(result.scope).toBe("applications:read applications:write");
    expect(result.expires_in).toBeGreaterThan(365 * 86400 - 3);
    expect(result.expires_in).toBeLessThanOrEqual(365 * 86400);
    expect(rpc).toHaveBeenCalledWith("exchange_chatgpt_oauth_code", {
      p_code_hash: hashOAuthSecret(code), p_client_id: clientId, p_redirect_uri: redirectUri,
      p_resource: resource, p_code_challenge: pkceChallenge(verifier),
      p_key_hash: hashOAuthSecret(result.access_token), p_key_prefix: result.access_token.slice(0, 15),
    });
    expect(JSON.stringify(rpc.mock.calls)).not.toContain(result.access_token);
  });

  it.each([{ grant_type: "refresh_token" }, { resource: "https://other.app/mcp" }, { code_verifier: "short" },
    { client_secret: "unused" }, { client_assertion: "unsupported" }])("rejects invalid token request before database exchange %o", async (extra) => {
    await expect(exchangeChatGPTOAuthCode(tokenParameters(extra))).rejects.toThrow();
    expect(rpc).not.toHaveBeenCalled();
  });

  it("returns invalid_grant for a code rejected atomically by the database", async () => {
    const response = await token(new Request(`${issuer}/api/integrations/chatgpt/oauth/token`, {
      method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: tokenParameters(),
    }));
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ error: "invalid_grant" });
    expect(response.headers.get("cache-control")).toBe("no-store");
  });

  it("rejects client authentication headers instead of silently treating them as public authentication", async () => {
    const response = await token(new Request(`${issuer}/api/integrations/chatgpt/oauth/token`, {
      method: "POST", headers: { "content-type": "application/x-www-form-urlencoded", authorization: "Basic unused" }, body: tokenParameters(),
    }));
    expect(response.status).toBe(400);
    expect(rpc).not.toHaveBeenCalled();
  });
});

describe("OAuth HTTP safety", () => {
  it("limits payload bytes even without Content-Length", async () => {
    const response = await register(jsonRequest("register", { client_name: "a".repeat(17000), redirect_uris: [redirectUri] }));
    expect(response.status).toBe(413);
    expect(from).not.toHaveBeenCalled();
  });

  it("does not reveal database errors or secrets", async () => {
    from.mockReturnValue(makeChain({ error: { message: "secret-code-and-database-information" } }));
    const response = await register(jsonRequest("register", { redirect_uris: [redirectUri] }));
    expect(response.status).toBe(503);
    expect(await response.text()).not.toContain("secret-code-and-database-information");
  });

  it("enforces rate limits before registration", async () => {
    vi.mocked(checkRateLimit).mockResolvedValue({ allowed: false } as never);
    const response = await register(jsonRequest("register", { redirect_uris: [redirectUri] }));
    expect(response.status).toBe(429);
    expect(from).not.toHaveBeenCalled();
  });

  it("rejects malformed JSON", async () => {
    const response = await register(new Request(`${issuer}/api/integrations/chatgpt/oauth/register`, {
      method: "POST", headers: { "content-type": "application/json" }, body: "{broken",
    }));
    expect(response.status).toBe(400);
  });
});
