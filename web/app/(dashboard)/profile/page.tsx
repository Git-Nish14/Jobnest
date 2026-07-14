import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import { ProfileClient } from "@/components/profile";
import { DeveloperIdentity } from "@/components/profile/developer-identity";
import { WORK_AUTHORIZATION_OPTIONS, type WorkAuthorization } from "@/config";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Fetch active pending deletion so the client knows the current state on page load
  let pendingDeletion: { scheduled_deletion_at: string; created_at: string } | null = null;
  try {
    const supabaseAdmin = createAdminClient();
    const { data } = await supabaseAdmin
      .from("pending_deletions")
      .select("scheduled_deletion_at, created_at")
      .eq("user_id", user.id)
      .is("cancelled_at", null)
      .single();
    pendingDeletion = data ?? null;
  } catch {
    // Non-critical — don't block the page
  }

  const notificationPrefs = user.user_metadata?.notification_prefs ?? {};
  // user has a password only if they have an email/password identity
  const identities: { provider: string }[] = user.identities ?? [];
  const hasPassword = identities.some((id) => id.provider === "email");
  // Collect distinct OAuth providers (google, github, etc.)
  const oauthProviders = [...new Set(
    identities
      .map((id) => id.provider)
      .filter((p) => p !== "email")
  )];

  return (
    <>
    <ProfileClient
      user={{
        id: user.id,
        email: user.email ?? "",
        displayName: user.user_metadata?.display_name ?? user.user_metadata?.full_name ?? "",
        avatarUrl: user.user_metadata?.avatar_url ?? null,
        createdAt: user.created_at,
        passwordChangedAt: user.user_metadata?.password_changed_at ?? null,
        aboutMe: user.user_metadata?.about_me ?? "",
        nestaiContext: user.user_metadata?.nestai_context ?? "",
        workAuthorization: (WORK_AUTHORIZATION_OPTIONS as readonly string[]).includes(
          user.user_metadata?.work_authorization
        )
          ? (user.user_metadata.work_authorization as WorkAuthorization)
          : null,
        optStartDate: user.user_metadata?.opt_start_date ?? null,
        stemExtension: user.user_metadata?.stem_extension ?? false,
        hasPassword,
        oauthProviders,
        notificationPrefs: {
          overdueReminders:   notificationPrefs.overdue_reminders    ?? true,
          weeklyDigest:       notificationPrefs.weekly_digest         ?? false,
          reEngagementEmails: notificationPrefs.re_engagement_emails  ?? true,
        },
        weeklyGoal: (() => {
          const v = user.user_metadata?.weekly_goal;
          return typeof v === "number" && v >= 1 && v <= 100 ? v : 5;
        })(),
      }}
      pendingDeletion={pendingDeletion}
    />

    {/* ── Developer Identity — skills, certifications, education ── */}
    <div className="mt-8">
      <DeveloperIdentity />
    </div>
    </>
  );
}
