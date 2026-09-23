import { ApiError, zodErrorToApiError } from "@/lib/api/errors";
import { chatGptDuplicateCheckSchema } from "@/lib/chatgpt/schema";
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

type DuplicateCheckResult = {
  match?: boolean;
  application?: {
    id: string;
    company: string;
    position: string;
    location: string | null;
    status: string;
    applied_date: string;
    job_url: string | null;
  };
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
    const ipLimit = await checkRateLimit(`chatgpt-check-ip:${hashChatGptKey(ip)}`, { maxRequests: 120, windowMs: 60_000 });
    if (!ipLimit.allowed) throw ApiError.tooManyRequests("Too many duplicate checks. Please try again in a minute.");

    const keyHash = getChatGptKeyHash(request);
    const { admin, credential } = await findChatGptCredential(keyHash);
    const accountLimit = await checkRateLimit(`chatgpt-check:${credential.user_id}`, { maxRequests: 60, windowMs: 60_000 });
    if (!accountLimit.allowed) throw ApiError.tooManyRequests("Too many duplicate checks. Please try again in a minute.");

    const parsed = chatGptDuplicateCheckSchema.safeParse(await readChatGptJson(request));
    if (!parsed.success) throw zodErrorToApiError(parsed.error);

    const { data, error } = await admin.rpc("check_chatgpt_application_duplicate", {
      p_key_hash: keyHash,
      p_resource: credential.resource,
      p_company: parsed.data.company,
      p_position: parsed.data.position,
      p_location: parsed.data.location,
    });
    if (error || !data) throw ApiError.internal("Unable to check existing applications. Please try again.");
    const result = data as DuplicateCheckResult;
    if (result.error === "invalid_key") {
      throw ApiError.unauthorized("Your Jobnest connection is invalid, expired, disconnected, or missing read permission. Reconnect Jobnest in ChatGPT.");
    }
    if (result.error || typeof result.match !== "boolean") {
      throw ApiError.internal("Unable to check existing applications. Please try again.");
    }
    if (!result.match || !result.application) return chatGptJson({ match: false });

    return chatGptJson({
      match: true,
      application: result.application,
      url: `${applicationBaseUrl()}/applications/${encodeURIComponent(result.application.id)}`,
      warning: "A Jobnest application already exists for the same company, role, and location. Do not apply again unless this is a different requisition.",
    });
  } catch (error) {
    return chatGptError(error);
  }
}
