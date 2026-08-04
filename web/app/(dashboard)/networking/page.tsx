import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { NetworkingHub } from "@/components/networking/networking-hub";

export const dynamic = "force-dynamic";

export default async function NetworkingPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [
    { data: contacts },
    { data: referrals },
    { data: chats },
    { data: applications },
    { data: education },
  ] = await Promise.all([
    supabase
      .from("contacts")
      .select("*")
      .eq("user_id", user.id)
      .order("name", { ascending: true }),

    supabase
      .from("referrals")
      .select(`
        *,
        contact:contacts(name, title, company),
        application:job_applications(company, position, status)
      `)
      .eq("user_id", user.id)
      .order("created_at", { ascending: false }),

    supabase
      .from("coffee_chats")
      .select("*, contact:contacts(name, title, company)")
      .eq("user_id", user.id)
      .order("scheduled_at", { ascending: true }),

    supabase
      .from("job_applications")
      .select("id, company, position")
      .eq("user_id", user.id)
      .in("status", ["Applied", "Phone Screen", "Interview", "Offer"])
      .order("applied_date", { ascending: false })
      .limit(50),

    supabase
      .from("education")
      .select("institution")
      .eq("user_id", user.id),
  ]);

  // Weekly goal from user_metadata (server-readable, no timezone dependency)
  const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
  const initialGoal: number = typeof meta.weekly_connection_goal === "number"
    ? meta.weekly_connection_goal
    : 5;

  const userSchools = (education ?? [])
    .map((e: { institution: string }) => e.institution)
    .filter(Boolean);

  return (
    <main id="main-content" className="db-main">
      <div className="db-page-header">
        <div>
          <h1 className="db-page-title">Networking</h1>
          <p className="db-page-subtitle">
            Track outreach, referrals, and coffee chats to build relationships that accelerate your job search.
          </p>
        </div>
      </div>

      {/* thisWeekCount is computed client-side in NetworkingHub using the
          browser's local timezone so it reflects the user's actual week. */}
      <NetworkingHub
        contacts={contacts ?? []}
        referrals={referrals ?? []}
        chats={chats ?? []}
        applications={applications ?? []}
        userSchools={userSchools}
        initialGoal={initialGoal}
      />
    </main>
  );
}
