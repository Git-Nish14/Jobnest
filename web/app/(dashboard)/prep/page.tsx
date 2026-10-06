import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { PrepHub } from "@/components/prep";

export const dynamic = "force-dynamic";

export default async function PrepPage({ searchParams }: { searchParams: Promise<{ tab?: string; interview?: string }> }) {
  const params = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  let context = null;
  if (params.interview && /^[0-9a-f-]{36}$/i.test(params.interview)) {
    const { data: interview } = await supabase.from("interviews")
      .select("application_id,type,preparation_notes,job_applications(company,position,job_description)")
      .eq("id", params.interview).eq("user_id", user.id).maybeSingle();
    if (interview) {
      const role = (Array.isArray(interview.job_applications) ? interview.job_applications[0] : interview.job_applications) as { company: string; position: string; job_description: string | null } | null;
      if (role) context = { company: role.company, position: role.position, href: `/applications/${interview.application_id}`, type: interview.type as string, notes: interview.preparation_notes as string | null, description: role.job_description };
    }
  }

  // Fetch all prep data server-side for initial render
  const [
    { data: problems },
    { data: assessments },
    { data: behavioral },
    { data: mockInterviews },
    { data: interviewQuestions },
    { data: streak },
    { data: interviews },
  ] = await Promise.all([
    supabase.from("coding_problems").select("*").eq("user_id", user.id).order("created_at", { ascending: false }),
    supabase.from("assessments").select("*, job_applications(company, position)").eq("user_id", user.id).order("created_at", { ascending: false }),
    supabase.from("behavioral_answers").select("*").eq("user_id", user.id).order("last_updated", { ascending: false }),
    supabase.from("mock_interviews").select("*").eq("user_id", user.id).order("scheduled_at", { ascending: false }),
    supabase.from("interview_questions").select("*, interviews(scheduled_at, job_applications(company, position))").eq("user_id", user.id).order("created_at", { ascending: false }).limit(50),
    supabase.from("prep_streaks").select("*").eq("user_id", user.id).single(),
    supabase.from("interviews").select("id, scheduled_at, type, job_applications(company, position)").eq("user_id", user.id).order("scheduled_at", { ascending: false }).limit(20),
  ]);

  return (
    <PrepHub
      key={`${params.interview ?? "all"}-${params.tab ?? "problems"}`}
      initialTab={params.tab === "assessments" ? "assessments" : context?.type === "Behavioral" ? "behavioral" : context?.type === "Phone Screen" ? "behavioral" : "problems"}
      context={context}
      initialProblems={problems ?? []}
      initialAssessments={assessments ?? []}
      initialBehavioral={behavioral ?? []}
      initialMockInterviews={mockInterviews ?? []}
      initialInterviewQuestions={interviewQuestions ?? []}
      initialStreak={streak ?? null}
      interviews={interviews ?? []}
    />
  );
}
