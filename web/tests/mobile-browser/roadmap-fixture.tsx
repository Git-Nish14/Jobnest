import { Toaster } from "sonner";
import { UsageSummary } from "@/components/nestai/UsageSummary";
import { SaveDraftTemplateButton } from "@/components/nestai/SaveDraftTemplateButton";
import { PublicSkillEndorsements } from "@/components/portfolio/PublicSkillEndorsements";
import { InterviewCalendarButton } from "@/components/interviews/interview-calendar-button";
import { EquityVestingEditor } from "@/components/salary/EquityVestingEditor";

export const roadmapId = "11111111-1111-4111-8111-111111111111";
export function RoadmapFixture() {
  return <main className="mx-auto max-w-4xl space-y-6 p-4">
    <Toaster />
    <h1 className="text-2xl font-semibold">Job search tools</h1>
    <section className="max-w-xs rounded-xl border"><UsageSummary /></section>
    <section className="space-y-2 rounded-xl border p-4"><h2>Email drafts</h2>
      <p>Hi [Name], thank you for meeting with me.</p><SaveDraftTemplateButton content="Hi [Name], thank you for meeting with me." /></section>
    <section className="space-y-2 rounded-xl border p-4"><h2>Skills</h2>
      <PublicSkillEndorsements username="test-owner" skills={[
        { id: roadmapId, name: "TypeScript", category: "Languages", proficiency: "Advanced" },
        { id: "22222222-2222-4222-8222-222222222222", name: "Accessible interface design", category: "Design", proficiency: "Expert" },
      ]} /></section>
    <section className="space-y-2 rounded-xl border p-4"><h2>Technical interview</h2><InterviewCalendarButton interviewId={roadmapId} /></section>
    <section className="space-y-2 rounded-xl border p-4"><h2>Equity vesting</h2><EquityVestingEditor applicationId={roadmapId} existing={null} currency="CAD" /></section>
  </main>;
}
