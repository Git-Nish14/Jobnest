"use client";

import { useState, useTransition } from "react";
import { Plus, Trash2, MessageSquare } from "lucide-react";
import type { InterviewQuestion, QuestionCategory, ProblemDifficulty } from "@/types/prep";
import type { Interview } from "./prep-hub";
import { formatShortDate, formatDate } from "@/lib/utils/date";

// Supabase join can return job_applications as object or array depending on query depth
function resolveCompany(
  ja: { company?: string } | { company?: string }[] | null | undefined
): string {
  if (!ja) return "Unknown";
  if (Array.isArray(ja)) return ja[0]?.company ?? "Unknown";
  return ja.company ?? "Unknown";
}

const CATEGORY_STYLES: Record<QuestionCategory, string> = {
  DSA:               "bg-[#99462a]/10 text-[#99462a]",
  Behavioral:        "bg-[#006d34]/10 text-[#006d34]",
  "System Design":   "bg-[#1e4a8a]/10 text-[#1e4a8a]",
  "Domain Knowledge":"bg-[#7c5200]/10 text-[#7c5200]",
  "Culture Fit":     "bg-[#55433d]/8 text-[#55433d]",
  Other:             "bg-[#dbc1b9]/40 text-[#55433d]",
};

const DIFF_STYLES: Record<ProblemDifficulty, string> = {
  Easy:   "bg-[#006d34]/10 text-[#006d34]",
  Medium: "bg-[#7c5200]/10 text-[#7c5200]",
  Hard:   "bg-[#ba1a1a]/10 text-[#ba1a1a]",
};

interface Props {
  questions: InterviewQuestion[];
  interviews: Interview[];
  onChange: (updated: InterviewQuestion[]) => void;
}

interface AddForm {
  interview_id: string;
  question: string;
  category: QuestionCategory | "";
  difficulty: ProblemDifficulty | "";
  notes: string;
}

const defaultForm: AddForm = { interview_id: "", question: "", category: "", difficulty: "", notes: "" };

export function InterviewQuestionLog({ questions, interviews, onChange }: Props) {
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState<AddForm>(defaultForm);
  const [filterCategory, setFilterCategory] = useState("all");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const filtered = questions.filter(q => filterCategory === "all" || q.category === filterCategory);

  // Group by interview
  const byInterview = filtered.reduce<Record<string, InterviewQuestion[]>>((acc, q) => {
    const key = q.interview_id;
    if (!acc[key]) acc[key] = [];
    acc[key].push(q);
    return acc;
  }, {});

  const handleAdd = () => {
    if (!form.interview_id) { setError("Please select an interview"); return; }
    if (!form.question.trim()) { setError("Question is required"); return; }
    setError(null);
    startTransition(async () => {
      const res = await fetch("/api/prep/interview-questions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          interview_id: form.interview_id,
          question: form.question,
          category: form.category || null,
          difficulty: form.difficulty || null,
          notes: form.notes || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Failed to log question"); return; }
      onChange([data.question, ...questions]);
      setForm({ ...defaultForm, interview_id: form.interview_id });
    });
  };

  const handleDelete = (id: string) => {
    startTransition(async () => {
      const res = await fetch(`/api/prep/interview-questions/${id}`, { method: "DELETE" });
      if (res.ok) onChange(questions.filter(q => q.id !== id));
    });
  };

  const getInterviewLabel = (interview: InterviewQuestion["interviews"]) => {
    if (!interview) return "Unknown interview";
    const company = interview.job_applications?.company ?? "Unknown";
    const date = formatShortDate(interview.scheduled_at);
    return `${company} — ${date}`;
  };

  return (
    <div className="space-y-6">
      {/* Toolbar */}
      <div className="db-filter-bar">
        <div className="db-filter-pills">
          {["all", "DSA", "Behavioral", "System Design", "Domain Knowledge", "Culture Fit", "Other"].map(c => (
            <button type="button" key={c} onClick={() => setFilterCategory(c)}
              className={`db-filter-pill ${filterCategory === c ? "db-filter-pill-active" : "db-filter-pill-inactive"}`}>
              {c === "all" ? "All" : c}
            </button>
          ))}
        </div>
        <button type="button" onClick={() => setShowAdd(v => !v)} className="db-btn-page-primary shrink-0 flex items-center gap-1.5">
          <Plus className="w-4 h-4" /> Log Question
        </button>
      </div>

      {/* Add form */}
      {showAdd && (
        <div className="db-content-card space-y-4">
          <h3 className="db-headline text-lg font-semibold text-[#1a1c1b]">Log Interview Question</h3>
          {error && <p className="text-sm text-[#ba1a1a] bg-[#ba1a1a]/8 rounded-lg px-3 py-2">{error}</p>}
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="text-xs font-bold uppercase tracking-wider text-[#55433d] opacity-60 block mb-1.5">Interview *</label>
              <select
                aria-label="Select interview"
                value={form.interview_id}
                onChange={e => setForm(f => ({...f, interview_id: e.target.value}))}
                className="w-full bg-[#f4f3f1] border-none rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-[#99462a]/30 text-[#1a1c1b]"
              >
                <option value="">Select interview…</option>
                {interviews.map(i => (
                  <option key={i.id} value={i.id}>
                    {resolveCompany(i.job_applications)} — {i.type} — {formatDate(i.scheduled_at)}
                  </option>
                ))}
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="text-xs font-bold uppercase tracking-wider text-[#55433d] opacity-60 block mb-1.5">Question *</label>
              <textarea value={form.question} onChange={e => setForm(f => ({...f, question: e.target.value}))}
                rows={2} placeholder="What was the exact question asked?"
                className="w-full bg-[#f4f3f1] border-none rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-[#99462a]/30 text-[#1a1c1b] placeholder:text-[#55433d]/50 resize-none" />
            </div>
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-[#55433d] opacity-60 block mb-1.5">Category</label>
              <select
                aria-label="Question category"
                value={form.category}
                onChange={e => setForm(f => ({...f, category: e.target.value as QuestionCategory | ""}))}
                className="w-full bg-[#f4f3f1] border-none rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-[#99462a]/30 text-[#1a1c1b]"
              >
                <option value="">Unknown</option>
                {(["DSA", "Behavioral", "System Design", "Domain Knowledge", "Culture Fit", "Other"] as const).map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-[#55433d] opacity-60 block mb-1.5">Difficulty</label>
              <select
                aria-label="Question difficulty"
                value={form.difficulty}
                onChange={e => setForm(f => ({...f, difficulty: e.target.value as ProblemDifficulty | ""}))}
                className="w-full bg-[#f4f3f1] border-none rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-[#99462a]/30 text-[#1a1c1b]"
              >
                <option value="">Unknown</option>
                {(["Easy", "Medium", "Hard"] as const).map(d => <option key={d}>{d}</option>)}
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="text-xs font-bold uppercase tracking-wider text-[#55433d] opacity-60 block mb-1.5">Notes / How you answered</label>
              <textarea value={form.notes} onChange={e => setForm(f => ({...f, notes: e.target.value}))}
                rows={2} placeholder="Your approach, what you'd do differently..."
                className="w-full bg-[#f4f3f1] border-none rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-[#99462a]/30 text-[#1a1c1b] placeholder:text-[#55433d]/50 resize-none" />
            </div>
          </div>
          <div className="flex gap-3">
            <button type="button" onClick={handleAdd} disabled={isPending} className="db-btn-page-primary">{isPending ? "Logging…" : "Log Question"}</button>
            <button type="button" onClick={() => { setShowAdd(false); setError(null); setForm(defaultForm); }} className="db-btn-page-secondary">Cancel</button>
          </div>
        </div>
      )}

      {/* Grouped by interview */}
      {Object.keys(byInterview).length === 0 ? (
        <div className="db-content-card text-center py-16">
          <MessageSquare className="w-10 h-10 mx-auto mb-4 text-[#55433d] opacity-30" />
          <h3 className="db-headline text-lg font-semibold text-[#1a1c1b] mb-1">No questions logged yet</h3>
          <p className="text-sm text-[#55433d] opacity-60">After each interview, log the questions asked to build your personal question bank.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(byInterview).map(([interviewId, qs]) => {
            const label = getInterviewLabel(qs[0].interviews);
            return (
              <div key={interviewId} className="db-content-card space-y-3">
                <h4 className="db-headline font-semibold text-[#1a1c1b] text-sm border-b border-[#dbc1b9]/20 pb-2">{label}</h4>
                {qs.map(q => (
                  <div key={q.id} className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        {q.category && <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${CATEGORY_STYLES[q.category]}`}>{q.category}</span>}
                        {q.difficulty && <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${DIFF_STYLES[q.difficulty]}`}>{q.difficulty}</span>}
                      </div>
                      <p className="text-sm text-[#1a1c1b] font-medium leading-snug">{q.question}</p>
                      {q.notes && <p className="text-xs text-[#55433d] opacity-60 mt-1 italic">{q.notes}</p>}
                    </div>
                    <button
                      type="button"
                      aria-label={`Delete question: ${q.question.slice(0, 40)}`}
                      onClick={() => handleDelete(q.id)}
                      className="shrink-0 text-[#ba1a1a] opacity-30 hover:opacity-70 transition-opacity"
                    >
                      <Trash2 className="w-4 h-4" aria-hidden="true" />
                    </button>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
