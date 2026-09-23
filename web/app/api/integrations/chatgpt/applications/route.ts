import { createHash } from "node:crypto";
import { ApiError, zodErrorToApiError } from "@/lib/api/errors";
import { chatGptApplicationSchema, type ChatGptApplication } from "@/lib/chatgpt/schema";
import {
  chatGptError,
  chatGptJson,
  findChatGptCredential,
  getChatGptKeyHash,
  hashChatGptKey,
  readChatGptJson,
} from "@/lib/chatgpt/credentials";
import { checkRateLimit } from "@/lib/security/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type SaveResult = {
  application?: { id: string } & Omit<ChatGptApplication, "request_id">;
  duplicate?: boolean;
  error?: string;
};

function applicationBaseUrl() {
  const configured = process.env.NEXT_PUBLIC_APP_URL;
  if (!configured) throw ApiError.serviceUnavailable("The Jobnest integration URL has not been configured.");
  const url = new URL(configured);
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) {
    throw ApiError.serviceUnavailable("The Jobnest integration URL has not been configured correctly.");
  }
  return url.origin;
}

export async function POST(request: Request) {
  try {
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0].trim() || request.headers.get("x-real-ip") || "unknown";
    const ipLimit = await checkRateLimit(`chatgpt-ip:${hashChatGptKey(ip)}`, { maxRequests: 120, windowMs: 60_000 });
    if (!ipLimit.allowed) throw ApiError.tooManyRequests("Too many requests. Please try again in a minute.");

    const keyHash = getChatGptKeyHash(request);
    const { admin, credential } = await findChatGptCredential(keyHash);
    const limit = await checkRateLimit(`chatgpt-save:${credential.user_id}`, { maxRequests: 60, windowMs: 60_000 });
    if (!limit.allowed) throw ApiError.tooManyRequests("Too many saves. Please try again in a minute.");

    const parsed = chatGptApplicationSchema.safeParse(await readChatGptJson(request));
    if (!parsed.success) throw zodErrorToApiError(parsed.error);
    const { request_id: requestId, ...application } = parsed.data;
    // Zod constructs known properties in schema order; payload JSON property
    // order and omitted default values therefore do not change the hash.
    const contentHash = createHash("sha256").update(JSON.stringify(application)).digest("hex");
    const baseUrl = applicationBaseUrl();

    // Ownership, key validity, revocation, duplicate detection and insertion are
    // rechecked together under the same database lock used by key management.
    const { data, error } = await admin.rpc("save_chatgpt_application", {
      p_key_hash: keyHash,
      p_resource: credential.resource,
      p_request_id: requestId,
      p_content_hash: contentHash,
      p_application: application,
    });
    if (error || !data) throw ApiError.internal("Unable to save the application. Retry with the same request_id.");
    const result = data as SaveResult;
    if (result.error === "invalid_key") throw ApiError.unauthorized("Your Jobnest connection is invalid, expired, or disconnected. Reconnect Jobnest in ChatGPT.");
    if (result.error === "request_conflict") throw ApiError.conflict("This request_id was already used for different job details. Use a new request_id for a new application.");
    if (result.error === "application_deleted") throw ApiError.conflict("The application saved by this request was deleted. Use a new request_id to save it again.");
    if (result.error === "rate_limited") throw ApiError.tooManyRequests("Too many saves. Please try again in a minute.");
    if (result.error || !result.application) throw ApiError.internal("Unable to save the application. Retry with the same request_id.");

    return chatGptJson({
      success: true,
      application: result.application,
      duplicate: result.duplicate === true,
      url: `${baseUrl}/applications/${encodeURIComponent(result.application.id)}`,
    }, result.duplicate ? 200 : 201);
  } catch (error) {
    return chatGptError(error);
  }
}
