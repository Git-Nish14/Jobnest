import { NextResponse } from "next/server";
import { beginChatGPTOAuthAuthorization, chatGPTOAuthErrorResponse, limitChatGPTOAuthRequest } from "@/lib/chatgpt/oauth";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    await limitChatGPTOAuthRequest(request, "authorize", 30);
    const redirect = await beginChatGPTOAuthAuthorization(new URL(request.url).searchParams);
    return NextResponse.redirect(redirect, { status: 303, headers: { "Cache-Control": "no-store", Pragma: "no-cache", "Referrer-Policy": "no-referrer" } });
  } catch (error) { return chatGPTOAuthErrorResponse(error); }
}
