import { chatGPTOAuthErrorResponse, chatGPTOAuthJson, limitChatGPTOAuthRequest, readChatGPTOAuthJson, registerChatGPTOAuthClient } from "@/lib/chatgpt/oauth";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    await limitChatGPTOAuthRequest(request, "register", 10);
    return chatGPTOAuthJson(await registerChatGPTOAuthClient(await readChatGPTOAuthJson(request)), 201);
  } catch (error) { return chatGPTOAuthErrorResponse(error); }
}
