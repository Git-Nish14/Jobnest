import { ApiError } from "@/lib/api/errors";
import {
  CHATGPT_CREDENTIAL_FIELDS,
  chatGptError,
  chatGptJson,
} from "@/lib/chatgpt/credentials";
import { verifyOrigin } from "@/lib/security/csrf";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function authenticatedUser() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) throw ApiError.unauthorized("Sign in to manage your ChatGPT connection.");
  return user;
}

function requireSameOrigin(request: Request) {
  // Browser writes always send Origin. Reject absent Origin as well, since this
  // endpoint uses cookies and is never part of the server-to-server MCP API.
  if (!request.headers.get("origin") || !verifyOrigin(request)) {
    throw ApiError.forbidden("Invalid request origin.");
  }
}

export async function GET() {
  try {
    const user = await authenticatedUser();
    const { data, error } = await createAdminClient()
      .from("chatgpt_credentials")
      .select(CHATGPT_CREDENTIAL_FIELDS)
      .eq("user_id", user.id)
      .maybeSingle();
    if (error) throw ApiError.internal("Unable to load your ChatGPT connection.");
    return chatGptJson({ credential: data });
  } catch (error) {
    return chatGptError(error);
  }
}

export async function DELETE(request: Request) {
  try {
    requireSameOrigin(request);
    const user = await authenticatedUser();
    const { error } = await createAdminClient().rpc("revoke_chatgpt_credential", { p_user_id: user.id });
    if (error) throw ApiError.internal("Unable to disconnect ChatGPT. Please try again.");
    return chatGptJson({ success: true });
  } catch (error) {
    return chatGptError(error);
  }
}
