import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyOrigin } from "@/lib/security/csrf";

export async function POST(request: NextRequest) {
  if (!verifyOrigin(request)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { timezone, utcOffsetHours } = body as { timezone?: unknown; utcOffsetHours?: unknown };

  if (typeof utcOffsetHours !== "number" || utcOffsetHours < -14 || utcOffsetHours > 14) {
    return NextResponse.json({ error: "Invalid utcOffsetHours" }, { status: 400 });
  }
  if (typeof timezone !== "string" || timezone.length > 64) {
    return NextResponse.json({ error: "Invalid timezone" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: existing } = await admin.auth.admin.getUserById(user.id);
  await admin.auth.admin.updateUserById(user.id, {
    user_metadata: {
      ...(existing?.user?.user_metadata ?? {}),
      utc_offset_hours: utcOffsetHours,
      timezone,
    },
  });

  return NextResponse.json({ ok: true });
}
