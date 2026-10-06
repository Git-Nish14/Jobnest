import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { PrepHub } from "@/components/prep";

export const dynamic = "force-dynamic";

export default async function PrepPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

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
