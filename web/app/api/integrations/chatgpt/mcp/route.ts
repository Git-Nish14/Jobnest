import { NextResponse } from "next/server";
import { ApiError } from "@/lib/api/errors";
import { authenticateChatGpt, hashChatGptKey, readChatGptJson } from "@/lib/chatgpt/credentials";
import { getChatGptInputSchema } from "@/lib/chatgpt/schema";
import { CHATGPT_INSTRUCTIONS } from "@/lib/chatgpt/setup";
import { CHATGPT_OAUTH_SCOPE, getChatGPTOAuthIssuer, getChatGPTProtectedResourceMetadataUrl } from "@/lib/chatgpt/oauth";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { POST as saveApplication } from "@/app/api/integrations/chatgpt/applications/route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Stateless Streamable HTTP: JSON responses, no server-initiated messages or
// session IDs. Negotiating a documented version keeps client behavior explicit.
const PROTOCOL_VERSION = "2026-07-28";
const LEGACY_VERSION = "2025-11-25";
const SUPPORTED_VERSIONS = new Set([PROTOCOL_VERSION, LEGACY_VERSION, "2025-06-18", "2025-03-26"]);
const SERVER_INFO = { name: "jobnest", title: "Jobnest", version: "1.0.0" };
type RpcId = string | number | null;

function json(body: unknown, status = 200, headers?: HeadersInit) {
  const response = NextResponse.json(body, { status, headers });
  response.headers.set("Cache-Control", "no-store");
  response.headers.set("Pragma", "no-cache");
  return response;
}

function rpcError(id: RpcId, code: number, message: string, status = 200, data?: unknown) {
  return json({ jsonrpc: "2.0", id, error: { code, message, ...(data === undefined ? {} : { data }) } }, status);
}

function authChallenge() {
  return `Bearer resource_metadata="${getChatGPTProtectedResourceMetadataUrl()}", scope="${CHATGPT_OAUTH_SCOPE}"`;
}

function httpError(error: unknown, id: RpcId) {
  const status = error instanceof ApiError ? error.statusCode : 503;
  const message = error instanceof ApiError ? error.message : "The Jobnest plugin is temporarily unavailable.";
  const response = rpcError(id, -32000, message, status);
  if (status === 401) response.headers.set("WWW-Authenticate", authChallenge());
  if (status === 429) response.headers.set("Retry-After", "60");
  return response;
}

function validateTransport(request: Request) {
  // No Origin is normal for ChatGPT's server-to-server requests. Never accept
  // arbitrary browser origins, even if they possess a cookie for this site.
  const origin = request.headers.get("origin");
  const allowedOrigins = new Set([getChatGPTOAuthIssuer(), "https://chatgpt.com", "https://chat.openai.com"]);
  if (origin && !allowedOrigins.has(origin)) throw ApiError.forbidden("Invalid request origin.");
}

function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function decodedMcpName(value: string | null) {
  if (!value?.startsWith("=?base64?") || !value.endsWith("?=")) return value;
  const encoded = value.slice(9, -2);
  const bytes = Buffer.from(encoded, "base64");
  return bytes.toString("base64") === encoded ? bytes.toString("utf8") : null;
}

function toolDefinition() {
  const securitySchemes = [{ type: "oauth2", scopes: [CHATGPT_OAUTH_SCOPE] }];
  return {
    name: "save_job_application",
    title: "Save an applied job to Jobnest",
    description: "Use when the user says JOBNEST or explicitly asks to save an applied job from this conversation. JOBNEST confirms the user applied: do not ask for confirmation or the application date; set status to Applied and use today's date unless another date is explicitly known. Ask only if company or position cannot be recovered. Always attach job_description: use the complete posting text found anywhere in the chat, or create a detailed factual description from known chat details prefixed 'Generated from conversation:'. Extract every supported optional field available and omit unknown values. Put useful details without dedicated fields in notes, without credentials or full resumes. Reuse request_id and identical arguments on retries. This records a job; it does not submit an employer application.",
    inputSchema: getChatGptInputSchema(),
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    securitySchemes,
    _meta: { securitySchemes },
  };
}

export async function POST(request: Request) {
  let id: RpcId = null;
  try {
    validateTransport(request);
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0].trim() || "unknown";
    const limit = await checkRateLimit(`chatgpt-mcp:${hashChatGptKey(ip)}`, { maxRequests: 180, windowMs: 60_000 });
    if (!limit.allowed) throw ApiError.tooManyRequests("Too many plugin requests. Try again in a minute.");
    await authenticateChatGpt(request);

    const accept = request.headers.get("accept") ?? "";
    if (!accept.includes("application/json") || !accept.includes("text/event-stream")) {
      return rpcError(null, -32600, "Accept must include application/json and text/event-stream.", 406);
    }
    let body: unknown;
    try { body = await readChatGptJson(request); }
    catch (error) {
      if (error instanceof ApiError && error.statusCode === 400) return rpcError(null, -32700, "Invalid JSON.", 400);
      throw error;
    }
    if (!body || typeof body !== "object" || Array.isArray(body)) return rpcError(null, -32600, "A single JSON-RPC message is required.", 400);
    const rpc = body as Record<string, unknown>;
    if (rpc.jsonrpc !== "2.0" || typeof rpc.method !== "string") return rpcError(null, -32600, "Invalid JSON-RPC request.", 400);
    if (Object.hasOwn(rpc, "id")) {
      if (typeof rpc.id !== "string" && (typeof rpc.id !== "number" || !Number.isFinite(rpc.id))) return rpcError(null, -32600, "Invalid request ID.", 400);
      id = rpc.id as string | number;
    } else {
      if (request.headers.get("mcp-protocol-version") !== PROTOCOL_VERSION &&
        (rpc.method === "notifications/initialized" || rpc.method === "notifications/cancelled")) {
        return new NextResponse(null, { status: 202, headers: { "Cache-Control": "no-store" } });
      }
      // Notifications can never cause writes.
      return rpcError(null, -32600, "This method requires a request ID.", 400);
    }
    if (rpc.params !== undefined && (!rpc.params || typeof rpc.params !== "object" || Array.isArray(rpc.params))) {
      return rpcError(id, -32602, "Parameters must be an object.");
    }
    const params = (rpc.params ?? {}) as Record<string, unknown>;
    const headerVersion = request.headers.get("mcp-protocol-version");
    const meta = isObject(params._meta) ? params._meta : {};
    const bodyVersion = meta["io.modelcontextprotocol/protocolVersion"];
    const modern = headerVersion === PROTOCOL_VERSION || bodyVersion !== undefined;
    const requestedVersion = bodyVersion ?? headerVersion;
    if (requestedVersion !== undefined && requestedVersion !== null &&
      (typeof requestedVersion !== "string" || !SUPPORTED_VERSIONS.has(requestedVersion))) {
      return rpcError(id, -32022, "Unsupported protocol version", 400, { supported: [...SUPPORTED_VERSIONS], requested: requestedVersion });
    }
    if (modern) {
      if (typeof bodyVersion !== "string" || !isObject(meta["io.modelcontextprotocol/clientCapabilities"])) {
        return rpcError(id, -32602, "Per-request protocolVersion and clientCapabilities metadata are required.", 400);
      }
      if (bodyVersion !== headerVersion || request.headers.get("mcp-method") !== rpc.method ||
        (rpc.method === "tools/call" && decodedMcpName(request.headers.get("mcp-name")) !== params.name)) {
        return rpcError(id, -32020, "Required MCP headers are missing or do not match the request body.", 400);
      }
      if (bodyVersion !== PROTOCOL_VERSION) return rpcError(id, -32602, "Use initialize for legacy protocol revisions.", 400);
    }
    const result = (value: Record<string, unknown>) => json({ jsonrpc: "2.0", id, result: modern ? {
      ...value, resultType: "complete", _meta: { "io.modelcontextprotocol/serverInfo": SERVER_INFO },
    } : value });
    switch (rpc.method) {
      case "server/discover":
        return result({ supportedVersions: [...SUPPORTED_VERSIONS], capabilities: { tools: { listChanged: false } }, instructions: CHATGPT_INSTRUCTIONS });
      case "initialize":
        if (modern) return rpcError(id, -32601, "Use server/discover for this protocol version.", 404);
        if (typeof params.protocolVersion !== "string" || !params.capabilities || typeof params.capabilities !== "object" || !params.clientInfo || typeof params.clientInfo !== "object") {
          return rpcError(id, -32602, "Initialization requires protocolVersion, capabilities, and clientInfo.");
        }
        return result({
          protocolVersion: SUPPORTED_VERSIONS.has(params.protocolVersion) && params.protocolVersion !== PROTOCOL_VERSION ? params.protocolVersion : LEGACY_VERSION,
          capabilities: { tools: { listChanged: false } },
          serverInfo: SERVER_INFO,
          instructions: CHATGPT_INSTRUCTIONS,
        });
      case "ping": return result({});
      case "tools/list": return result({ tools: [toolDefinition()] });
      case "tools/call": {
        if (params.name !== "save_job_application") return rpcError(id, -32602, "Unknown tool.");
        const headers = new Headers({ "Content-Type": "application/json", Authorization: request.headers.get("authorization")! });
        if (request.headers.has("x-forwarded-for")) headers.set("x-forwarded-for", request.headers.get("x-forwarded-for")!);
        // Reuse the save handler in process, never a network fetch or user URL.
        const saved = await saveApplication(new Request(`${getChatGPTOAuthIssuer()}/api/integrations/chatgpt/applications`, {
          method: "POST", headers, body: JSON.stringify(params.arguments ?? {}),
        }));
        const data = await saved.json();
        if (saved.status === 401) throw ApiError.unauthorized("Reconnect Jobnest in ChatGPT to save jobs.");
        if (!saved.ok) {
          return result({ isError: true, content: [{ type: "text", text: JSON.stringify(data) }] });
        }
        return result({ structuredContent: data, content: [{ type: "text", text: JSON.stringify(data) }] });
      }
      default: return rpcError(id, -32601, "Method not found.", modern ? 404 : 200);
    }
  } catch (error) {
    return httpError(error, id);
  }
}

// Streaming and session deletion are optional. The stateless server explicitly
// declines both; unauthenticated probes still receive OAuth discovery.
async function unsupportedMethod(request: Request) {
  try {
    validateTransport(request);
    await authenticateChatGpt(request);
    return json({ error: "Use POST for this stateless MCP server." }, 405, { Allow: "POST" });
  } catch (error) { return httpError(error, null); }
}

export const GET = unsupportedMethod;
export const DELETE = unsupportedMethod;
