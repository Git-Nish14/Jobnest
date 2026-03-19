import { createClient } from "@/lib/supabase/server";
import { Navbar } from "@/components/layout";
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

  return (
    <div className="min-h-screen bg-muted/30">
      <Navbar user={{ email: user.email }} />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        {children}
      </main>
    </div>
  );
}
