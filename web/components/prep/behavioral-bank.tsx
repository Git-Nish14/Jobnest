"use client";

import { useState, useTransition } from "react";
import { Plus, ChevronDown, ChevronUp, Trash2, Save, Brain } from "lucide-react";
import type { BehavioralAnswer, BehavioralCompetency } from "@/types/prep";
import { BEHAVIORAL_QUESTIONS_SEED } from "@/types/prep";

const COMPETENCY_COLORS: Record<BehavioralCompetency, string> = {
  Leadership:        "bg-[#99462a]/10 text-[#99462a]",
  Conflict:          "bg-[#ba1a1a]/10 text-[#ba1a1a]",
  Failure:           "bg-[#55433d]/8 text-[#55433d]",
  Achievement:       "bg-[#006d34]/10 text-[#006d34]",
  Teamwork:          "bg-[#1e4a8a]/10 text-[#1e4a8a]",
  Communication:     "bg-[#7c5200]/10 text-[#7c5200]",
  "Problem Solving": "bg-[#d97757]/15 text-[#7a2f15]",
  Other:             "bg-[#dbc1b9]/40 text-[#55433d]",
};

const COMPETENCIES: BehavioralCompetency[] = [
  "Leadership", "Conflict", "Failure", "Achievement",
  "Teamwork", "Communication", "Problem Solving", "Other",
];

interface Props {
  answers: BehavioralAnswer[];
  onChange: (updated: BehavioralAnswer[]) => void;
  onActivity: () => void;
}

function wordCount(a: BehavioralAnswer): number {
  const text = [a.situation, a.task_desc, a.action, a.result].filter(Boolean).join(" ");
  return text.trim() ? text.trim().split(/\s+/).length : 0;
}

function AnswerCard({ answer, onSave, onDelete }: {
  answer: BehavioralAnswer;
  onSave: (id: string, updates: Partial<BehavioralAnswer>) => void;
  onDelete: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [draft, setDraft] = useState({ situation: answer.situation ?? "", task_desc: answer.task_desc ?? "", action: answer.action ?? "", result: answer.result ?? "" });
  const [isPending, startTransition] = useTransition();
  const [dirty, setDirty] = useState(false);

  const update = (field: string, value: string) => {
    setDraft(d => ({ ...d, [field]: value }));
    setDirty(true);
  };

  const save = () => {
    startTransition(() => {
      onSave(answer.id, draft);
      setDirty(false);
    });
  };

  const wc = wordCount({ ...answer, ...draft });

  return (
    <div className="db-content-card">
      {/* Header */}
      <div className="flex items-start gap-3 cursor-pointer" onClick={() => setExpanded(v => !v)}>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            {answer.competency && (
              <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${COMPETENCY_COLORS[answer.competency]}`}>
                {answer.competency}
              </span>
            )}
            {wc > 0 && <span className="text-[10px] text-[#55433d] opacity-50">{wc} words</span>}
          </div>
          <p className="font-semibold text-sm text-[#1a1c1b] leading-snug">{answer.question}</p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button onClick={e => { e.stopPropagation(); onDelete(answer.id); }}
            className="text-[#ba1a1a] opacity-30 hover:opacity-70 transition-opacity p-1">
            <Trash2 className="w-4 h-4" />
          </button>
          {expanded ? <ChevronUp className="w-4 h-4 text-[#55433d] opacity-40" /> : <ChevronDown className="w-4 h-4 text-[#55433d] opacity-40" />}
        </div>
      </div>

      {/* STAR form */}
      {expanded && (
        <div className="mt-4 space-y-4 border-t border-[#dbc1b9]/20 pt-4">
          {([["situation", "S — Situation", "Set the scene. What was the context?"],
             ["task_desc",  "T — Task",      "What was your specific responsibility or goal?"],
             ["action",     "A — Action",    "What did YOU do? Use I, not we."],
             ["result",     "R — Result",    "What was the outcome? Use numbers if possible."]] as const).map(([field, label, hint]) => (
            <div key={field}>
              <label className="text-xs font-bold uppercase tracking-wider text-[#55433d] opacity-60 block mb-1.5">{label}</label>
              <p className="text-xs text-[#55433d] opacity-40 mb-1.5 italic">{hint}</p>
              <textarea
                value={draft[field]}
                onChange={e => update(field, e.target.value)}
                rows={3}
                className="w-full bg-[#f4f3f1] border-none rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-[#99462a]/30 text-[#1a1c1b] placeholder:text-[#55433d]/50 resize-none"
              />
            </div>
          ))}
          {dirty && (
            <button onClick={save} disabled={isPending} className="db-btn-page-primary flex items-center gap-2">
              <Save className="w-3.5 h-3.5" />
              {isPending ? "Saving…" : "Save Answer"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export function BehavioralBank({ answers, onChange, onActivity }: Props) {
  const [showAdd, setShowAdd] = useState(false);
  const [filterComp, setFilterComp] = useState("all");
  const [customQ, setCustomQ] = useState("");
  const [customComp, setCustomComp] = useState<BehavioralCompetency>("Achievement");
  const [isPending, startTransition] = useTransition();
  const [addError, setAddError] = useState<string | null>(null);

  const filtered = answers.filter(a => filterComp === "all" || a.competency === filterComp);

  const addAnswer = (question: string, competency?: BehavioralCompetency) => {
    if (!question.trim()) { setAddError("Question is required"); return; }
    setAddError(null);
    startTransition(async () => {
      const res = await fetch("/api/prep/behavioral", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question, competency: competency ?? null }),
      });
      const data = await res.json();
      if (!res.ok) { setAddError(data.error ?? "Failed to add question"); return; }
      onChange([data.answer, ...answers]);
      setCustomQ("");
      setShowAdd(false);
      onActivity();
    });
  };

  const saveAnswer = (id: string, updates: Partial<BehavioralAnswer>) => {
    startTransition(async () => {
      const res = await fetch(`/api/prep/behavioral/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      if (res.ok) {
        const { answer } = await res.json();
        onChange(answers.map(a => a.id === id ? answer : a));
        onActivity();
      }
    });
  };

  const deleteAnswer = (id: string) => {
    startTransition(async () => {
      const res = await fetch(`/api/prep/behavioral/${id}`, { method: "DELETE" });
      if (res.ok) onChange(answers.filter(a => a.id !== id));
    });
  };

  const drafted = answers.filter(a => a.situation || a.task_desc || a.action || a.result).length;

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="db-content-card text-center py-4">
          <p className="text-2xl font-bold db-headline text-[#1a1c1b]">{answers.length}</p>
          <p className="text-xs uppercase tracking-wider text-[#55433d] opacity-50 font-semibold">Total</p>
        </div>
        <div className="db-content-card text-center py-4">
          <p className="text-2xl font-bold db-headline text-[#006d34]">{drafted}</p>
          <p className="text-xs uppercase tracking-wider text-[#55433d] opacity-50 font-semibold">Drafted</p>
        </div>
        <div className="db-content-card text-center py-4">
          <p className="text-2xl font-bold db-headline text-[#55433d]">{answers.length - drafted}</p>
          <p className="text-xs uppercase tracking-wider text-[#55433d] opacity-50 font-semibold">Blank</p>
        </div>
      </div>

      {/* Toolbar */}
      <div className="db-filter-bar">
        <div className="db-filter-pills">
          {["all", ...COMPETENCIES].map(c => (
            <button
              key={c}
              onClick={() => setFilterComp(c)}
              className={`db-filter-pill ${filterComp === c ? "db-filter-pill-active" : "db-filter-pill-inactive"}`}
            >
              {c === "all" ? "All" : c}
            </button>
          ))}
        </div>
        <button onClick={() => setShowAdd(v => !v)} className="db-btn-page-primary flex-shrink-0 flex items-center gap-1.5">
          <Plus className="w-4 h-4" /> Add Question
        </button>
      </div>

      {/* Add form */}
      {showAdd && (
        <div className="db-content-card space-y-4">
          <h3 className="db-headline text-lg font-semibold text-[#1a1c1b]">Add Behavioral Question</h3>
          {addError && <p className="text-sm text-[#ba1a1a] bg-[#ba1a1a]/8 rounded-lg px-3 py-2">{addError}</p>}

          {/* Seed questions */}
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-[#55433d] opacity-60 mb-2">Quick add from library</p>
            <div className="grid sm:grid-cols-2 gap-2 max-h-64 overflow-y-auto pr-1">
              {BEHAVIORAL_QUESTIONS_SEED.map((q, i) => {
                const already = answers.some(a => a.question === q.question);
                return (
                  <button
                    key={i}
                    onClick={() => !already && addAnswer(q.question, q.competency)}
                    disabled={already || isPending}
                    className={`text-left px-3 py-2 rounded-xl text-xs leading-snug transition-colors ${
                      already
                        ? "bg-[#e9e8e6] text-[#55433d] opacity-50 cursor-default"
                        : "bg-[#f4f3f1] text-[#1a1c1b] hover:bg-[#e9e8e6] cursor-pointer"
                    }`}
                  >
                    <span className={`text-[9px] font-bold uppercase tracking-wider mr-1.5 ${COMPETENCY_COLORS[q.competency]}`}>{q.competency}</span>
                    {q.question}
                    {already && " ✓"}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Custom question */}
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-[#55433d] opacity-60 mb-2">Or add custom question</p>
            <textarea
              value={customQ}
              onChange={e => setCustomQ(e.target.value)}
              rows={2}
              placeholder="Enter your custom behavioral question…"
              className="w-full bg-[#f4f3f1] border-none rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-[#99462a]/30 text-[#1a1c1b] placeholder:text-[#55433d]/50 resize-none mb-3"
            />
            <div className="flex gap-3 items-center">
              <select
                value={customComp}
                onChange={e => setCustomComp(e.target.value as BehavioralCompetency)}
                className="bg-[#f4f3f1] border-none rounded-xl px-3 py-2.5 text-sm outline-none text-[#1a1c1b]"
              >
                {COMPETENCIES.map(c => <option key={c}>{c}</option>)}
              </select>
              <button onClick={() => addAnswer(customQ, customComp)} disabled={isPending} className="db-btn-page-primary">
                {isPending ? "Adding…" : "Add"}
              </button>
              <button onClick={() => { setShowAdd(false); setCustomQ(""); setAddError(null); }} className="db-btn-page-secondary">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Answer list */}
      {filtered.length === 0 ? (
        <div className="db-content-card text-center py-16">
          <Brain className="w-10 h-10 mx-auto mb-4 text-[#55433d] opacity-30" />
          <h3 className="db-headline text-lg font-semibold text-[#1a1c1b] mb-1">No questions yet</h3>
          <p className="text-sm text-[#55433d] opacity-60">Add behavioral questions and draft your STAR answers.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(a => (
            <AnswerCard key={a.id} answer={a} onSave={saveAnswer} onDelete={deleteAnswer} />
          ))}
        </div>
      )}
    </div>
  );
}
