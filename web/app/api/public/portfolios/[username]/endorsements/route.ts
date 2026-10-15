import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { ApiError, errorResponse } from "@/lib/api/errors";
import { readJsonBody } from "@/lib/api/read-json";
import { verifyOrigin } from "@/lib/security/csrf";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { endorsementIdentity, ENDORSEMENT_COOKIE, ENDORSEMENT_COOKIE_PATH } from "@/lib/security/endorsement-identity";

type Context = { params: Promise<{ username: string }> };
async function handle(request: Request, context: Context, write: boolean) {
  try {
    if (write && (!request.headers.get("origin") || !verifyOrigin(request))) throw ApiError.forbidden("Invalid request origin.");
    const { username } = await context.params;
    if (!/^[a-z0-9][a-z0-9-]{1,28}[a-z0-9]$/.test(username)) throw ApiError.notFound();
    const identity = endorsementIdentity(request);
    if (!(await checkRateLimit(`endorsements:${write ? "write" : "read"}:${identity.networkHash}`, {
      maxRequests: write ? 20 : 60, windowMs: 60_000,
    })).allowed) throw ApiError.tooManyRequests("Please wait before trying again.");
    const input = write ? z.object({ skillId: z.uuid() }).strict().parse(await readJsonBody(request, 2048)) : null;
    const admin = createAdminClient();
    const owner = await admin.from("usernames").select("user_id").eq("username", username).maybeSingle();
    if (owner.error) throw ApiError.serviceUnavailable();
    if (!owner.data) throw ApiError.notFound();
    const profile = await admin.auth.admin.getUserById(owner.data.user_id);
    if (profile.error || profile.data.user?.user_metadata?.portfolio_public !== true) throw ApiError.notFound();
    const args = { p_user_id: owner.data.user_id, p_visitor_hash: identity.visitorHash, p_network_hash: identity.networkHash };
    const result = input
      ? await admin.rpc("endorse_public_skill", { ...args, p_skill_id: input.skillId })
      : await admin.rpc("get_public_skill_endorsements", args);
    if (result.error) {
      if (result.error.message === "endorsement_daily_limit") throw ApiError.tooManyRequests("Daily endorsement limit reached. Please try again tomorrow.");
      if (result.error.message === "endorsement_skill_not_found") throw ApiError.notFound();
      throw ApiError.serviceUnavailable("Endorsements are temporarily unavailable. Please try again later.");
    }
    if (write && !result.data?.length) throw ApiError.notFound();
    const response = NextResponse.json({ skills: result.data ?? [] }, { headers: { "Cache-Control": "private, no-store", "Vary": "Cookie" } });
    response.cookies.set(ENDORSEMENT_COOKIE, identity.cookie, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: ENDORSEMENT_COOKIE_PATH, maxAge: 180 * 24 * 60 * 60 });
    return response;
  } catch (error) { return errorResponse(error); }
}
export const GET = (request: Request, context: Context) => handle(request, context, false);
export const POST = (request: Request, context: Context) => handle(request, context, true);
