import { ChatGPTOAuthError, chatGPTOAuthErrorResponse, chatGPTOAuthJson, exchangeChatGPTOAuthCode, limitChatGPTOAuthRequest, readChatGPTOAuthBody } from "@/lib/chatgpt/oauth";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    await limitChatGPTOAuthRequest(request, "token", 60);
    if (request.headers.has("authorization")) throw new ChatGPTOAuthError("invalid_client", "Use public client authentication (none).");
    const body = await readChatGPTOAuthBody(request, "application/x-www-form-urlencoded");
    return chatGPTOAuthJson(await exchangeChatGPTOAuthCode(new URLSearchParams(body)));
  } catch (error) { return chatGPTOAuthErrorResponse(error); }
}
