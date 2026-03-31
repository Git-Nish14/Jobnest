import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import { ProfileClient } from "@/components/profile";

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
  const hasPassword = (user.identities ?? []).some(
    (id: { provider: string }) => id.provider === "email"
  );

  return (
    <ProfileClient
      user={{
        id: user.id,
        email: user.email ?? "",
        displayName: user.user_metadata?.display_name ?? user.user_metadata?.full_name ?? "",
        createdAt: user.created_at,
        passwordChangedAt: user.user_metadata?.password_changed_at ?? null,
        aboutMe: user.user_metadata?.about_me ?? "",
        nestaiContext: user.user_metadata?.nestai_context ?? "",
        hasPassword,
        notificationPrefs: {
          overdueReminders: notificationPrefs.overdue_reminders ?? true,
          weeklyDigest: notificationPrefs.weekly_digest ?? false,
        },
      }}
      pendingDeletion={pendingDeletion}
    />
  );
}
