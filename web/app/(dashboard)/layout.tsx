import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { Newsreader, Manrope } from "next/font/google";
import { Navbar, BottomTabBar } from "@/components/layout";
import { DeletionBanner } from "@/components/profile";
import { AuthSync } from "@/components/auth/auth-sync";
import { redirect } from "next/navigation";
import "./dashboard.css";

export const dynamic = "force-dynamic";

const newsreader = Newsreader({
  subsets: ["latin"],
  variable: "--font-newsreader",
  display: "swap",
  style: ["normal", "italic"],
  weight: ["400", "500", "600", "700"],
});

const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-manrope",
  display: "swap",
});

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
    <div className={`${newsreader.variable} ${manrope.variable} min-h-screen db-root`}>
      <AuthSync />
      <Navbar user={{ email: user.email }} />
      {pendingDeletion && (
        <DeletionBanner scheduledDeletionAt={pendingDeletion.scheduled_deletion_at} />
      )}
      {/* pb-36: clears bottom tab bar (4rem) + NESTAi fixed input on mobile */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 pb-36 md:pb-8">
        {children}
      </main>
      <BottomTabBar />
    </div>
  );
}
