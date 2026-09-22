import { z } from "zod";
import { ChatGPTOAuthError, chatGPTOAuthErrorResponse, chatGPTOAuthJson, completeChatGPTOAuthConsent, getChatGPTOAuthIssuer, getOAuthAuthorizationRequest, limitChatGPTOAuthRequest, readChatGPTOAuthJson, requireChatGPTOAuthUser } from "@/lib/chatgpt/oauth";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const userId = await requireChatGPTOAuthUser();
    await limitChatGPTOAuthRequest(request, "consent", 30, userId);
    const parameters = new URL(request.url).searchParams;
    if (parameters.getAll("request").length !== 1) throw new ChatGPTOAuthError("invalid_request", "A connection request is required.");
    return chatGPTOAuthJson(await getOAuthAuthorizationRequest(parameters.get("request") ?? "", userId));
  } catch (error) { return chatGPTOAuthErrorResponse(error); }
}

const consentSchema = z.object({ requestId: z.string(), approved: z.boolean() }).strict();

export async function POST(request: Request) {
  try {
    // Consent is a browser-only mutation; trust the configured issuer, never Host.
    if (request.headers.get("origin") !== getChatGPTOAuthIssuer()) throw new ChatGPTOAuthError("access_denied", "Invalid request origin.", 403);
    const userId = await requireChatGPTOAuthUser();
    await limitChatGPTOAuthRequest(request, "consent", 30, userId);
    const parsed = consentSchema.safeParse(await readChatGPTOAuthJson(request));
    if (!parsed.success) throw new ChatGPTOAuthError("invalid_request", "A connection request and approval decision are required.");
    return chatGPTOAuthJson({ redirectUrl: await completeChatGPTOAuthConsent(parsed.data.requestId, userId, parsed.data.approved) });
  } catch (error) { return chatGPTOAuthErrorResponse(error); }
}
