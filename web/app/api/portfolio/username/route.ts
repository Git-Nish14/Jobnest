import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ApiError, errorResponse, validateBody } from "@/lib/api/errors";
import { verifyOrigin } from "@/lib/security/csrf";
import { z } from "zod";

const USERNAME_RE = /^[a-z0-9][a-z0-9-]{1,28}[a-z0-9]$/;
const COOLDOWN_DAYS = 30;

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

function daysUntilNextChange(changedAt: string): number {
  const changed = new Date(changedAt).getTime();
  const nextAllowed = changed + COOLDOWN_DAYS * 86_400_000;
  return Math.ceil((nextAllowed - Date.now()) / 86_400_000);
}

/** GET /api/portfolio/username?u=<username> — check availability or return current */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) throw ApiError.unauthorized();

    const candidate = request.nextUrl.searchParams.get("u")?.toLowerCase();
    if (!candidate) {
      const meta = user.user_metadata ?? {};
      return NextResponse.json({
        username: meta.username ?? null,
        username_changed_at: meta.username_changed_at ?? null,
      });
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
    return NextResponse.json({ available: !existing || isMine, is_current: isMine });
  } catch (e) {
    return errorResponse(e);
  }
}

/** POST /api/portfolio/username — claim / update username (once per 30 days) */
export async function POST(request: NextRequest) {
  try {
    if (!verifyOrigin(request)) throw ApiError.forbidden("Invalid request origin.");

    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) throw ApiError.unauthorized();

    const { username } = await validateBody(request, setSchema);
    if (RESERVED.has(username)) throw ApiError.conflict("That username is reserved.");

    const meta = user.user_metadata ?? {};
    const currentUsername: string | null = meta.username ?? null;

    // Enforce 30-day cooldown on changes (not on first-time claim).
    // Note: user_metadata can be partially overwritten by the client via
    // supabase.auth.updateUser(). A motivated user could clear username_changed_at
    // to bypass the cooldown. Low-impact (only affects username change frequency);
    // a proper fix requires a server-managed table with admin-only write access.
    if (currentUsername && username !== currentUsername) {
      const changedAt: string | null = meta.username_changed_at ?? null;
      if (changedAt) {
        const daysLeft = daysUntilNextChange(changedAt);
        if (daysLeft > 0) {
          const nextDate = new Date(
            new Date(changedAt).getTime() + COOLDOWN_DAYS * 86_400_000
          ).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
          throw ApiError.conflict(
            `You can only change your username once every ${COOLDOWN_DAYS} days. Next change available on ${nextDate}.`
          );
        }
      }
    }

    const admin = createAdminClient();

    // Conflict check
    const { data: conflict } = await admin
      .from("usernames")
      .select("user_id")
      .eq("username", username)
      .neq("user_id", user.id)
      .maybeSingle();
    if (conflict) throw ApiError.conflict("Username is already taken.");

    // Replace in usernames table
    await admin.from("usernames").delete().eq("user_id", user.id);
    const { error: insertErr } = await admin.from("usernames").insert({ username, user_id: user.id });
    if (insertErr) {
      if (insertErr.code === "23505") throw ApiError.conflict("Username is already taken.");
      throw ApiError.internal("Failed to save username.");
    }

    const now = new Date().toISOString();
    await admin.auth.admin.updateUserById(user.id, {
      user_metadata: {
        ...meta,
        username,
        username_changed_at: now,
      },
    });

    return NextResponse.json({ username, username_changed_at: now });
  } catch (e) {
    return errorResponse(e);
  }
}

/** DELETE /api/portfolio/username — remove portfolio username entirely */
export async function DELETE(request: NextRequest) {
  try {
    if (!verifyOrigin(request)) throw ApiError.forbidden("Invalid request origin.");

    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) throw ApiError.unauthorized();

    const admin = createAdminClient();

    await admin.from("usernames").delete().eq("user_id", user.id);

    const meta = user.user_metadata ?? {};
    await admin.auth.admin.updateUserById(user.id, {
      user_metadata: {
        ...meta,
        username: null,
        username_changed_at: null,
        portfolio_public: false,
      },
    });

    return NextResponse.json({ deleted: true });
  } catch (e) {
    return errorResponse(e);
  }
}
