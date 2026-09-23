import "server-only";

import { createHash, randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { ApiError, errorResponse } from "@/lib/api/errors";
import { createAdminClient } from "@/lib/supabase/admin";
import { getChatGptSetup } from "@/lib/chatgpt/setup";

export const CHATGPT_CREDENTIAL_FIELDS = "id,key_prefix,created_at,last_used_at,expires_at";
const ACCESS_TOKEN_PATTERN = /^jobnest_[a-f0-9]{64}$/;
export const CHATGPT_MAX_BODY_BYTES = 64 * 1024;

export type ChatGptCredential = {
  id: string;
  key_prefix: string;
  created_at: string;
  last_used_at: string | null;
  expires_at: string;
};

export function hashChatGptKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}

export function generateChatGptKey() {
  const apiKey = `jobnest_${randomBytes(32).toString("hex")}`;
  return {
    apiKey,
    keyHash: hashChatGptKey(apiKey),
    keyPrefix: apiKey.slice(0, 15),
  };
}

/** Reject cookies, query-string credentials and malformed bearer tokens. */
export function getChatGptKeyHash(request: Request): string {
  const authorization = request.headers.get("authorization");
  const match = authorization?.match(/^Bearer (\S+)$/i);
  if (!match || !ACCESS_TOKEN_PATTERN.test(match[1])) {
    throw ApiError.unauthorized("A valid Jobnest connection is required. Connect Jobnest in ChatGPT to continue.");
  }
  return hashChatGptKey(match[1]);
}

export function chatGptJson(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store", Pragma: "no-cache" },
  });
}

/** Never log unexpected objects: SDK errors can contain request credentials. */
export function chatGptError(error: unknown) {
  const response = errorResponse(
    error instanceof ApiError ? error : ApiError.internal("The ChatGPT integration is temporarily unavailable. Please try again."),
  );
  response.headers.set("Cache-Control", "no-store");
  response.headers.set("Pragma", "no-cache");
  if (response.status === 401) response.headers.set("WWW-Authenticate", "Bearer");
  return response;
}

export async function findChatGptCredential(keyHash: string) {
  const setup = getChatGptSetup(process.env.NEXT_PUBLIC_APP_URL || "");
  if (!setup.ready) throw ApiError.serviceUnavailable("The Jobnest integration URL has not been configured correctly.");
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("chatgpt_credentials")
    .select("id,user_id,expires_at,resource,scope")
    .eq("key_hash", keyHash)
    .maybeSingle();
  if (error) throw ApiError.internal("Unable to verify your Jobnest connection. Please try again.");
  if (!data || data.resource !== setup.mcpUrl || data.scope !== "applications:read applications:write" ||
    !Number.isFinite(Date.parse(data.expires_at)) || Date.parse(data.expires_at) <= Date.now()) {
    throw ApiError.unauthorized("Your Jobnest connection is invalid, expired, or disconnected. Reconnect Jobnest in ChatGPT.");
  }
  return { admin, credential: data as { id: string; user_id: string; expires_at: string; resource: string; scope: string } };
}

/** Authenticate MCP protocol requests as well as tool calls. */
export async function authenticateChatGpt(request: Request) {
  const { admin, credential } = await findChatGptCredential(getChatGptKeyHash(request));
  const { data, error } = await admin.auth.admin.getUserById(credential.user_id);
  const account = data?.user as { banned_until?: string; deleted_at?: string } | null;
  if (error) throw ApiError.internal("Unable to verify your Jobnest connection. Please try again.");
  if (!account || account.deleted_at || (account.banned_until && Date.parse(account.banned_until) > Date.now())) {
    throw ApiError.unauthorized("Your Jobnest connection is no longer active. Reconnect from Jobnest settings.");
  }
  const { data: pendingDeletion, error: deletionError } = await admin.from("pending_deletions")
    .select("id").eq("user_id", credential.user_id).is("cancelled_at", null).is("deleted_at", null).maybeSingle();
  if (deletionError) throw ApiError.internal("Unable to verify your Jobnest connection. Please try again.");
  if (pendingDeletion) throw ApiError.unauthorized("Your Jobnest account is scheduled for deletion. Reactivate it before reconnecting.");
  return credential;
}

/** Enforce bytes as they arrive, including chunked requests without Content-Length. */
export async function readChatGptJson(request: Request): Promise<unknown> {
  if (request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "application/json") {
    throw new ApiError("Use Content-Type: application/json.", 415, "UNSUPPORTED_MEDIA_TYPE");
  }
  const length = request.headers.get("content-length");
  if (length && Number(length) > CHATGPT_MAX_BODY_BYTES) {
    throw new ApiError("The job details exceed the 64 KiB request limit.", 413, "PAYLOAD_TOO_LARGE");
  }
  if (!request.body) throw ApiError.badRequest("A JSON request body is required.");

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > CHATGPT_MAX_BODY_BYTES) {
        await reader.cancel().catch(() => undefined);
        throw new ApiError("The job details exceed the 64 KiB request limit.", 413, "PAYLOAD_TOO_LARGE");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  try {
    return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(Buffer.concat(chunks)));
  } catch {
    throw ApiError.badRequest("Invalid JSON request body.");
  }
}
