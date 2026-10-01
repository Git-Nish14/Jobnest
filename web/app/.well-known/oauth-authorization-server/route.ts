import { chatGPTOAuthErrorResponse, chatGPTOAuthJson, CHATGPT_OAUTH_SCOPES, getChatGPTOAuthIssuer } from "@/lib/chatgpt/oauth";

export const runtime = "nodejs";

export async function GET() {
  try {
    const issuer = getChatGPTOAuthIssuer();
    const base = `${issuer}/api/integrations/chatgpt/oauth`;
    return chatGPTOAuthJson({
      issuer,
      authorization_endpoint: `${base}/authorize`,
      token_endpoint: `${base}/token`,
      registration_endpoint: `${base}/register`,
      response_types_supported: ["code"],
      response_modes_supported: ["query"],
      grant_types_supported: ["authorization_code"],
      token_endpoint_auth_methods_supported: ["none"],
      code_challenge_methods_supported: ["S256"],
      scopes_supported: [...CHATGPT_OAUTH_SCOPES],
      authorization_response_iss_parameter_supported: true,
    });
  } catch (error) { return chatGPTOAuthErrorResponse(error); }
}
