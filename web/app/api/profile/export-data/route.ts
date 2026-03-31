import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { ApiError, errorResponse } from "@/lib/api/errors";

/**
 * GDPR Art. 20 — Right to Data Portability
 * Returns a JSON archive of all personal data associated with the account.
 * Rate-limited to 3 exports per 24 hours.
 */
export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) throw ApiError.unauthorized();

    const rl = await checkRateLimit(`gdpr-export:${user.id}`, {
      maxRequests: 3,
      windowMs: 24 * 60 * 60 * 1000,
    });

    if (!rl.allowed) {
      throw ApiError.tooManyRequests(
        "Export limit reached. You can request your data up to 3 times per 24 hours."
      );
    }

    const admin = createAdminClient();

    // Run all data fetches in parallel
    const [
      applications,
      contacts,
      interviews,
      reminders,
      salaryEntries,
      templates,
      documents,
      nestaiSessions,
      pendingDeletion,
    ] = await Promise.all([
      admin.from("job_applications").select("*").eq("user_id", user.id),
      admin.from("contacts").select("*").eq("user_id", user.id),
      admin.from("interviews").select("*").eq("user_id", user.id),
      admin.from("reminders").select("*").eq("user_id", user.id),
      admin.from("salary_entries").select("*").eq("user_id", user.id),
      admin.from("email_templates").select("*").eq("user_id", user.id),
      admin
        .from("application_documents")
        .select("id, name, type, size_bytes, created_at, updated_at, is_shared, share_expires_at")
        .eq("user_id", user.id),
      admin
        .from("nesta_ai_sessions")
        .select("id, title, created_at, updated_at")
        .eq("user_id", user.id),
      admin
        .from("pending_deletions")
        .select("scheduled_deletion_at, created_at, cancelled_at, reason")
        .eq("user_id", user.id)
        .is("cancelled_at", null)
        .maybeSingle(),
    ]);

    const payload = {
      _meta: {
        exported_at: new Date().toISOString(),
        user_id: user.id,
        format_version: "1.0",
        notice:
          "This file contains all personal data held by Jobnest for your account, " +
          "exported under GDPR Article 20 (Right to Data Portability). " +
          "To request erasure, visit your Profile → Delete Account.",
      },
      profile: {
        id: user.id,
        email: user.email,
        created_at: user.created_at,
        last_sign_in_at: user.last_sign_in_at,
        display_name: user.user_metadata?.display_name ?? null,
        full_name: user.user_metadata?.full_name ?? null,
        about_me: user.user_metadata?.about_me ?? null,
        notification_prefs: user.user_metadata?.notification_prefs ?? null,
      },
      job_applications: applications.data ?? [],
      contacts: contacts.data ?? [],
      interviews: interviews.data ?? [],
      reminders: reminders.data ?? [],
      salary_entries: salaryEntries.data ?? [],
      email_templates: templates.data ?? [],
      documents: documents.data ?? [],
      nestai_sessions: nestaiSessions.data ?? [],
      account_status: {
        pending_deletion: pendingDeletion.data ?? null,
      },
    };

    return new NextResponse(JSON.stringify(payload, null, 2), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="jobnest-data-export-${new Date().toISOString().slice(0, 10)}.json"`,
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
