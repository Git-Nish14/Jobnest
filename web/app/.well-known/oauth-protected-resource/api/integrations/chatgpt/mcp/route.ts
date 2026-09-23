import { chatGPTOAuthErrorResponse, chatGPTOAuthJson, CHATGPT_OAUTH_SCOPES, getChatGPTMcpResource, getChatGPTOAuthIssuer } from "@/lib/chatgpt/oauth";

export const runtime = "nodejs";

export async function GET() {
  try {
    return chatGPTOAuthJson({
      resource: getChatGPTMcpResource(),
      authorization_servers: [getChatGPTOAuthIssuer()],
      scopes_supported: [...CHATGPT_OAUTH_SCOPES],
      bearer_methods_supported: ["header"],
      resource_name: "Jobnest job applications",
      resource_policy_uri: `${getChatGPTOAuthIssuer()}/privacy`,
    });
  } catch (error) { return chatGPTOAuthErrorResponse(error); }
}
