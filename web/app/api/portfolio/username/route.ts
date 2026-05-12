import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ApiError, errorResponse, validateBody } from "@/lib/api/errors";
import { verifyOrigin } from "@/lib/security/csrf";
import { z } from "zod";

const USERNAME_RE = /^[a-z0-9][a-z0-9-]{1,28}[a-z0-9]$/;

const RESERVED = new Set([
  "admin", "api", "app", "blog", "dashboard", "dev", "docs", "home",
  "help", "info", "login", "logout", "mail", "news", "null", "pricing",
  "privacy", "register", "root", "signup", "status", "terms", "www",
  "public", "static", "contact", "about", "team", "jobs", "careers", "p",
]);

const setSchema = z.object({
  username: z
    .string()
    .toLowerCase()
    .regex(USERNAME_RE, "3–30 chars, lowercase letters, numbers, hyphens. Cannot start/end with a hyphen."),
});

/** GET /api/portfolio/username?u=<username> — check availability */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) throw ApiError.unauthorized();

    const candidate = request.nextUrl.searchParams.get("u")?.toLowerCase();
    if (!candidate) {
      // Return current username
      const meta = user.user_metadata ?? {};
      return NextResponse.json({ username: meta.username ?? null });
    }

    if (!USERNAME_RE.test(candidate)) {
      return NextResponse.json({ available: false, reason: "invalid_format" });
    }
    if (RESERVED.has(candidate)) {
      return NextResponse.json({ available: false, reason: "reserved" });
    }

    const admin = createAdminClient();
    const { data: existing } = await admin
      .from("usernames")
      .select("user_id")
      .eq("username", candidate)
      .maybeSingle();

    const isMine = existing?.user_id === user.id;
    const available = !existing || isMine;
    return NextResponse.json({ available, is_current: isMine });
  } catch (e) {
    return errorResponse(e);
  }
}

/** POST /api/portfolio/username — claim / update username */
export async function POST(request: NextRequest) {
  try {
    if (!verifyOrigin(request)) throw ApiError.forbidden("Invalid request origin.");

    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) throw ApiError.unauthorized();

    const { username } = await validateBody(request, setSchema);

    if (RESERVED.has(username)) throw ApiError.conflict("That username is reserved.");

    const admin = createAdminClient();

    // Check for conflict with another user
    const { data: conflict } = await admin
      .from("usernames")
      .select("user_id")
      .eq("username", username)
      .neq("user_id", user.id)
      .maybeSingle();

    if (conflict) throw ApiError.conflict("Username is already taken.");

    // Remove any previous username for this user then claim the new one
    await admin.from("usernames").delete().eq("user_id", user.id);
    const { error: insertErr } = await admin.from("usernames").insert({
      username,
      user_id: user.id,
    });
    if (insertErr) {
      if (insertErr.code === "23505") throw ApiError.conflict("Username is already taken.");
      throw ApiError.internal("Failed to save username.");
    }

    // Mirror into user_metadata for fast reads
    await admin.auth.admin.updateUserById(user.id, {
      user_metadata: { ...user.user_metadata, username },
    });

    return NextResponse.json({ username });
  } catch (e) {
    return errorResponse(e);
  }
}
