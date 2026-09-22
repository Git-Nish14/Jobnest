import "server-only";

import { createHash, randomBytes } from "node:crypto";
import { isIP } from "node:net";
import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { generateChatGptKey } from "@/lib/chatgpt/credentials";
import { getChatGptSetup } from "@/lib/chatgpt/setup";

export const CHATGPT_OAUTH_SCOPE = "applications:write";
export const CHATGPT_OAUTH_REQUEST_LIFETIME_MS = 10 * 60 * 1000;
const OAUTH_BODY_LIMIT = 16 * 1024;
const OPAQUE_PATTERN = /^[A-Za-z0-9_-]{43}$/;
const CLIENT_PATTERN = /^jobnest_client_[a-f0-9]{32}$/;

export class ChatGPTOAuthError extends Error {
  constructor(public readonly code: string, message: string, public readonly status = 400) {
    super(message);
  }
}

/** Canonical configuration only: proxy headers cannot change token audiences or redirects. */
export function getChatGPTOAuthIssuer(): string {
  const configured = process.env.NEXT_PUBLIC_APP_URL;
  if (!configured) throw new ChatGPTOAuthError("server_error", "The Jobnest public HTTPS URL is not configured.", 503);
  try {
    const url = new URL(configured);
    if (!getChatGptSetup(configured).ready) {
      throw new Error("invalid issuer");
    }
    return url.origin;
  } catch {
    throw new ChatGPTOAuthError("server_error", "The Jobnest public URL must be an HTTPS origin.", 503);
  }
}

export function getChatGPTMcpResource(): string {
  return `${getChatGPTOAuthIssuer()}/api/integrations/chatgpt/mcp`;
}

export function getChatGPTProtectedResourceMetadataUrl(): string {
  return `${getChatGPTOAuthIssuer()}/.well-known/oauth-protected-resource/api/integrations/chatgpt/mcp`;
}

export function chatGPTOAuthJson(body: unknown, status = 200): NextResponse {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store", Pragma: "no-cache", "Referrer-Policy": "no-referrer" },
  });
}

/** Never serialize or log unexpected database errors, which can contain OAuth secrets. */
export function chatGPTOAuthErrorResponse(error: unknown): NextResponse {
  const safe = error instanceof ChatGPTOAuthError
    ? error
    : new ChatGPTOAuthError("server_error", "The Jobnest connection is temporarily unavailable.", 503);
  return chatGPTOAuthJson({ error: safe.code, error_description: safe.message }, safe.status);
}

export function hashOAuthSecret(secret: string): string {
  return createHash("sha256").update(secret).digest("hex");
}

export function pkceChallenge(verifier: string): string {
  return createHash("sha256").update(verifier).digest("base64url");
}

export function isPublicHttpsRedirect(value: string): boolean {
  if (value.length > 2048 || value.includes("#") || /[\u0000-\u0020\u007f\\]/.test(value)) return false;
  try {
    const url = new URL(value);
    const hostname = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");
    return url.protocol === "https:" && !url.username && !url.password && !url.port
      && hostname.includes(".") && !isIP(hostname) && !hostname.endsWith(".")
      && !/(^|\.)(localhost|local|internal|test|invalid|example)$/.test(hostname);
  } catch {
    return false;
  }
}

const registrationSchema = z.object({
  client_name: z.string().trim().min(1).max(200).regex(/^[^\u0000-\u001f\u007f]+$/).default("ChatGPT"),
  redirect_uris: z.array(z.string().refine(isPublicHttpsRedirect)).min(1).max(10),
  token_endpoint_auth_method: z.string().max(64).default("none"),
  grant_types: z.array(z.string().max(64)).min(1).max(5).default(["authorization_code"]),
  response_types: z.array(z.string().max(64)).min(1).max(5).default(["code"]),
  scope: z.string().trim().max(512).optional(),
}).superRefine((metadata, context) => {
  if (metadata.token_endpoint_auth_method !== "none") {
    context.addIssue({ code: "custom", path: ["token_endpoint_auth_method"], message: "Public client authentication is required." });
  }
  if (!metadata.grant_types.includes("authorization_code")) {
    context.addIssue({ code: "custom", path: ["grant_types"], message: "The authorization_code grant is required." });
  }
  if (!metadata.response_types.includes("code")) {
    context.addIssue({ code: "custom", path: ["response_types"], message: "The code response type is required." });
  }
});

export async function registerChatGPTOAuthClient(body: unknown) {
  const parsed = registrationSchema.safeParse(body);
  if (!parsed.success) {
    const fields = [...new Set(parsed.error.issues.map((issue) => String(issue.path[0] ?? "request")))].join(", ");
    throw new ChatGPTOAuthError("invalid_client_metadata", `Invalid client metadata fields: ${fields}. Use HTTPS redirect URIs, authorization_code, response type code, and public client authentication (none).`);
  }
  const metadata = parsed.data;
  const clientId = `jobnest_client_${randomBytes(16).toString("hex")}`;
  const { error } = await createAdminClient().from("chatgpt_oauth_clients").insert({
    client_id: clientId,
    client_name: metadata.client_name,
    redirect_uris: [...new Set(metadata.redirect_uris)],
  });
  if (error) throw new ChatGPTOAuthError("server_error", "Unable to register the connection.", 503);
  return {
    client_name: metadata.client_name,
    redirect_uris: [...new Set(metadata.redirect_uris)],
    token_endpoint_auth_method: "none",
    grant_types: ["authorization_code"],
    response_types: ["code"],
    scope: CHATGPT_OAUTH_SCOPE,
    client_id: clientId,
    client_id_issued_at: Math.floor(Date.now() / 1000),
  };
}

/** Reject repeated parameters rather than allowing different parsers to select different values. */
export function uniqueOAuthParameters(parameters: URLSearchParams): Record<string, string> {
  const result: Record<string, string> = Object.create(null);
  for (const [key, value] of parameters) {
    if (Object.hasOwn(result, key)) throw new ChatGPTOAuthError("invalid_request", "Repeated OAuth parameters are not supported.");
    result[key] = value;
  }
  return result;
}

const authorizationSchema = z.object({
  response_type: z.literal("code"),
  client_id: z.string().regex(CLIENT_PATTERN),
  redirect_uri: z.string().refine(isPublicHttpsRedirect),
  code_challenge: z.string().regex(OPAQUE_PATTERN),
  code_challenge_method: z.literal("S256"),
  state: z.string().min(1).max(1024).regex(/^[^\u0000-\u001f\u007f]+$/),
  resource: z.string().max(2048),
  scope: z.literal(CHATGPT_OAUTH_SCOPE),
  response_mode: z.literal("query").optional(),
});

function authorizationCallback(redirectUri: string, state: string, result: Record<string, string>): string {
  const callback = new URL(redirectUri);
  // Preserve custom registered query fields, but never mix attacker-supplied
  // response fields from the registered URI with the actual OAuth response.
  for (const key of ["code", "error", "error_description", "state", "iss"]) callback.searchParams.delete(key);
  callback.searchParams.set("state", state);
  callback.searchParams.set("iss", getChatGPTOAuthIssuer());
  for (const [key, value] of Object.entries(result)) callback.searchParams.set(key, value);
  return callback.toString();
}

export async function beginChatGPTOAuthAuthorization(parameters: URLSearchParams): Promise<string> {
  const values = uniqueOAuthParameters(parameters);
  const recipient = authorizationSchema.pick({ client_id: true, redirect_uri: true, state: true }).safeParse(values);
  if (!recipient.success) throw new ChatGPTOAuthError("invalid_request", "The connection requires a registered client, exact redirect URI, and state.");
  const resource = getChatGPTMcpResource();
  const admin = createAdminClient();
  const { data: client, error: clientError } = await admin.from("chatgpt_oauth_clients")
    .select("redirect_uris").eq("client_id", recipient.data.client_id).maybeSingle();
  if (clientError) throw new ChatGPTOAuthError("server_error", "Unable to verify the connection.", 503);
  if (!client || !Array.isArray(client.redirect_uris) || !client.redirect_uris.includes(recipient.data.redirect_uri)) {
    // Never redirect an unverified client or redirect URI.
    throw new ChatGPTOAuthError("invalid_request", "The client or redirect URI is not registered.");
  }
  const parsed = authorizationSchema.safeParse(values);
  if (!parsed.success) return authorizationCallback(recipient.data.redirect_uri, recipient.data.state, {
    error: "invalid_request", error_description: "Use response type code, applications:write scope, and S256 PKCE.",
  });
  const input = parsed.data;
  if (input.resource !== resource) return authorizationCallback(input.redirect_uri, input.state, {
    error: "invalid_target", error_description: "The requested resource is not the Jobnest MCP server.",
  });
  const requestId = randomBytes(32).toString("base64url");
  const { error } = await admin.from("chatgpt_oauth_requests").insert({
    request_hash: hashOAuthSecret(requestId),
    client_id: input.client_id,
    redirect_uri: input.redirect_uri,
    state: input.state,
    code_challenge: input.code_challenge,
    resource: input.resource,
    scope: CHATGPT_OAUTH_SCOPE,
    expires_at: new Date(Date.now() + CHATGPT_OAUTH_REQUEST_LIFETIME_MS).toISOString(),
  });
  if (error) throw new ChatGPTOAuthError("server_error", "Unable to start the connection.", 503);
  const consent = new URL("/integrations/chatgpt/authorize", getChatGPTOAuthIssuer());
  consent.searchParams.set("request", requestId);
  return consent.toString();
}

export async function requireChatGPTOAuthUser(): Promise<string> {
  const client = await createClient();
  const { data: { user }, error } = await client.auth.getUser();
  if (error || !user) throw new ChatGPTOAuthError("login_required", "Sign in to Jobnest to connect ChatGPT.", 401);
  return user.id;
}

function validateRequestId(requestId: string): void {
  if (!OPAQUE_PATTERN.test(requestId)) throw new ChatGPTOAuthError("invalid_request", "This connection request is invalid or expired.", 400);
}

/** The first signed-in account to open consent owns it; a different account cannot approve it. */
export async function getOAuthAuthorizationRequest(requestId: string, userId: string) {
  validateRequestId(requestId);
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("claim_chatgpt_oauth_request", {
    p_request_hash: hashOAuthSecret(requestId), p_user_id: userId,
  });
  if (error) throw new ChatGPTOAuthError("server_error", "Unable to load the connection request.", 503);
  if (!data) throw new ChatGPTOAuthError("invalid_request", "This connection request is expired, already used, or belongs to another account.");
  return {
    clientName: data.client_name as string,
    redirectHost: new URL(data.redirect_uri as string).hostname,
    expiresAt: data.expires_at as string,
    scope: CHATGPT_OAUTH_SCOPE,
  };
}

export async function completeChatGPTOAuthConsent(requestId: string, userId: string, approved: boolean): Promise<string> {
  validateRequestId(requestId);
  getChatGPTOAuthIssuer();
  const code = approved ? randomBytes(32).toString("base64url") : null;
  const { data, error } = await createAdminClient().rpc("complete_chatgpt_oauth_consent", {
    p_request_hash: hashOAuthSecret(requestId), p_user_id: userId,
    p_code_hash: code ? hashOAuthSecret(code) : null,
  });
  if (error) throw new ChatGPTOAuthError("server_error", "Unable to complete the connection.", 503);
  if (!data) throw new ChatGPTOAuthError("invalid_request", "This connection request is expired, already used, or belongs to another account.");
  return authorizationCallback(data.redirect_uri as string, data.state as string,
    code ? { code } : { error: "access_denied" });
}

const exchangeSchema = z.object({
  grant_type: z.literal("authorization_code"),
  client_id: z.string().regex(CLIENT_PATTERN),
  code: z.string().regex(OPAQUE_PATTERN),
  code_verifier: z.string().min(43).max(128).regex(/^[A-Za-z0-9._~-]+$/),
  redirect_uri: z.string().refine(isPublicHttpsRedirect),
  resource: z.string().max(2048),
});

export async function exchangeChatGPTOAuthCode(parameters: URLSearchParams) {
  const values = uniqueOAuthParameters(parameters);
  if (values.grant_type !== "authorization_code") throw new ChatGPTOAuthError("unsupported_grant_type", "Only authorization_code is supported. Reconnect when the access token expires.");
  if (["client_secret", "client_assertion", "client_assertion_type"].some((key) => Object.hasOwn(values, key))) {
    throw new ChatGPTOAuthError("invalid_client", "This connection uses public client authentication (none).");
  }
  const parsed = exchangeSchema.safeParse(values);
  if (!parsed.success) throw new ChatGPTOAuthError("invalid_request", "The token request is missing valid code, client, redirect URI, resource, or PKCE verifier.");
  const input = parsed.data;
  if (input.resource !== getChatGPTMcpResource()) throw new ChatGPTOAuthError("invalid_target", "The requested resource is not the Jobnest MCP server.");
  const key = generateChatGptKey();
  const { data, error } = await createAdminClient().rpc("exchange_chatgpt_oauth_code", {
    p_code_hash: hashOAuthSecret(input.code),
    p_client_id: input.client_id,
    p_redirect_uri: input.redirect_uri,
    p_resource: input.resource,
    p_code_challenge: pkceChallenge(input.code_verifier),
    p_key_hash: key.keyHash,
    p_key_prefix: key.keyPrefix,
  });
  if (error) throw new ChatGPTOAuthError("server_error", "Unable to issue the connection token.", 503);
  if (!data) throw new ChatGPTOAuthError("invalid_grant", "The authorization code is invalid, expired, already used, or does not match this request.");
  const expiresIn = Math.floor((Date.parse(data.expires_at as string) - Date.now()) / 1000);
  if (!Number.isFinite(expiresIn) || expiresIn <= 0) throw new ChatGPTOAuthError("server_error", "The connection token could not be issued.", 503);
  return { access_token: key.apiKey, token_type: "Bearer", expires_in: expiresIn, scope: CHATGPT_OAUTH_SCOPE };
}

export async function limitChatGPTOAuthRequest(request: Request, action: string, maxRequests: number, userId?: string) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0].trim().slice(0, 128) || "unknown";
  const identity = userId ?? hashOAuthSecret(ip);
  const limit = await checkRateLimit(`chatgpt-oauth:${action}:${identity}`, { maxRequests, windowMs: 60 * 1000 });
  if (!limit.allowed) throw new ChatGPTOAuthError("temporarily_unavailable", "Too many connection requests. Try again in a minute.", 429);
}

export async function readChatGPTOAuthBody(request: Request, contentType: string): Promise<string> {
  if (request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== contentType) {
    throw new ChatGPTOAuthError("invalid_request", `Use Content-Type: ${contentType}.`, 415);
  }
  if (Number(request.headers.get("content-length")) > OAUTH_BODY_LIMIT) throw new ChatGPTOAuthError("invalid_request", "The connection request is too large.", 413);
  if (!request.body) throw new ChatGPTOAuthError("invalid_request", "A request body is required.");
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > OAUTH_BODY_LIMIT) {
        await reader.cancel();
        throw new ChatGPTOAuthError("invalid_request", "The connection request is too large.", 413);
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(Buffer.concat(chunks));
  } catch {
    throw new ChatGPTOAuthError("invalid_request", "The request must be valid UTF-8.");
  }
}

export async function readChatGPTOAuthJson(request: Request): Promise<unknown> {
  const text = await readChatGPTOAuthBody(request, "application/json");
  try { return JSON.parse(text); }
  catch { throw new ChatGPTOAuthError("invalid_request", "The request must be valid JSON."); }
}
