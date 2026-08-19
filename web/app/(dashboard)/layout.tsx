import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { Navbar, BottomTabBar, ScrollRestorer } from "@/components/layout";
import { NPSFeedback } from "@/components/layout/NPSFeedback";
import { DeletionBanner } from "@/components/profile";
import { AuthSync } from "@/components/auth/auth-sync";
import { CommandPalette } from "@/components/ui/command-palette";
import { redirect } from "next/navigation";
import "./dashboard.css";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  const user = data.user;

  if (error?.status === 401 || !user) {
    redirect("/login");
  }

  let pendingDeletion: { scheduled_deletion_at: string } | null = null;
  try {
    const supabaseAdmin = createAdminClient();
    const { data: pd } = await supabaseAdmin
      .from("pending_deletions")
      .select("scheduled_deletion_at")
      .eq("user_id", user.id)
      .is("cancelled_at", null)
      .single();
    pendingDeletion = pd ?? null;
  } catch {
    // non-critical
  }

  return (
    <div className="min-h-screen db-root">
      <ScrollRestorer />
      <AuthSync />
      <CommandPalette />
      <Navbar user={{
        email: user.email,
        // user_metadata is typed as {[key:string]:any}; guard at runtime so a
        // non-string value never reaches <img src>.
        avatarUrl: typeof user.user_metadata?.avatar_url === "string"
          ? user.user_metadata.avatar_url
          : null,
      }} />
      {pendingDeletion && (
        <DeletionBanner scheduledDeletionAt={pendingDeletion.scheduled_deletion_at} />
      )}
      {/* Top padding: 16px mobile → 24px sm → 32px lg (progressive).
          Bottom: pb-36 clears the floating glass tab bar + NESTAi input area. */}
      <main id="main-content" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4 sm:pt-6 lg:pt-8 pb-36 md:pb-8">
        {children}
      </main>
      <BottomTabBar />
      <NPSFeedback />
    </div>
  );
}
