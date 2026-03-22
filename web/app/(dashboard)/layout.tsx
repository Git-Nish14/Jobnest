import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { Navbar } from "@/components/layout";
import { DeletionBanner } from "@/components/profile";
import { redirect } from "next/navigation";

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

  // Check for a pending account deletion (soft-delete grace period)
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
    // Non-critical — don't block the page if this query fails
  }

  return (
    <div className="min-h-screen bg-muted/30">
      <Navbar user={{ email: user.email }} />
      {pendingDeletion && (
        <DeletionBanner scheduledDeletionAt={pendingDeletion.scheduled_deletion_at} />
      )}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        {children}
      </main>
    </div>
  );
}
