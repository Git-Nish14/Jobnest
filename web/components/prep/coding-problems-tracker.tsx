"use client";

import { useState, useTransition } from "react";
import { Plus, ExternalLink, Trash2, CheckCircle2, RefreshCw, Clock, Tag, Code2 } from "lucide-react";
import type { CodingProblem, ProblemDifficulty, ProblemStatus } from "@/types/prep";
import { PROBLEM_TOPICS } from "@/types/prep";

const DIFFICULTY_COLORS: Record<ProblemDifficulty, string> = {
  Easy:   "bg-[#006d34]/10 text-[#006d34]",
  Medium: "bg-[#7c5200]/10 text-[#7c5200]",
  Hard:   "bg-[#ba1a1a]/10 text-[#ba1a1a]",
};

const STATUS_COLORS: Record<ProblemStatus, string> = {
  Todo:      "bg-[#55433d]/8 text-[#55433d]",
  Attempted: "bg-[#d97757]/15 text-[#7a2f15]",
  Solved:    "bg-[#006d34]/10 text-[#006d34]",
  Review:    "bg-[#99462a]/10 text-[#99462a]",
};

interface Props {
  problems: CodingProblem[];
  onChange: (updated: CodingProblem[]) => void;
  onActivity: () => void;
}

interface AddForm {
  title: string;
  url: string;
  difficulty: ProblemDifficulty;
  topic: string;
  status: ProblemStatus;
  company_tags: string;
  notes: string;
}

const defaultForm: AddForm = {
  title: "", url: "", difficulty: "Medium", topic: "Array",
  status: "Todo", company_tags: "", notes: "",
};

export function CodingProblemsTracker({ problems, onChange, onActivity }: Props) {
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState<AddForm>(defaultForm);
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterTopic, setFilterTopic] = useState("all");
  const [filterDiff, setFilterDiff] = useState("all");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const filtered = problems.filter(p => {
    if (filterStatus !== "all" && p.status !== filterStatus) return false;
    if (filterTopic !== "all" && p.topic !== filterTopic) return false;
    if (filterDiff !== "all" && p.difficulty !== filterDiff) return false;
    return true;
  });

  // Review queue: status=Review not visited in 7+ days (or today is first log)
  // nowMs is computed once outside the filter to keep the component pure
  const nowMs = new Date().getTime();
  const reviewQueue = problems.filter(p => {
    if (p.status !== "Review") return false;
    if (!p.last_reviewed_at) return true;
    const daysSince = (nowMs - new Date(p.last_reviewed_at).getTime()) / 86_400_000;
    return daysSince >= 7;
  });

  const handleAdd = () => {
    if (!form.title.trim()) { setError("Title is required"); return; }
    setError(null);
    startTransition(async () => {
      const res = await fetch("/api/prep/problems", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          company_tags: form.company_tags.split(",").map(t => t.trim()).filter(Boolean),
        }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Failed to add problem"); return; }
      onChange([data.problem, ...problems]);
      setForm(defaultForm);
      setShowAdd(false);
      onActivity();
    });
  };

  const handleStatusChange = (id: string, status: ProblemStatus) => {
    startTransition(async () => {
      const update: Record<string, unknown> = { status };
      if (status === "Review") update.last_reviewed_at = new Date().toISOString();
      const res = await fetch(`/api/prep/problems/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(update),
      });
      if (res.ok) {
        const { problem } = await res.json();
        onChange(problems.map(p => p.id === id ? problem : p));
        if (status === "Solved") onActivity();
      }
    });
  };

  const handleDelete = (id: string) => {
    startTransition(async () => {
      const res = await fetch(`/api/prep/problems/${id}`, { method: "DELETE" });
      if (res.ok) onChange(problems.filter(p => p.id !== id));
    });
  };

  const uniqueTopics = [...new Set(problems.map(p => p.topic))];

  return (
    <div className="space-y-6">
      {/* Stats strip */}
      <div className="grid grid-cols-4 gap-3">
        {(["Todo", "Attempted", "Solved", "Review"] as ProblemStatus[]).map(s => (
          <button
            key={s}
            onClick={() => setFilterStatus(filterStatus === s ? "all" : s)}
            className={`db-content-card text-center py-3 cursor-pointer transition-all ${filterStatus === s ? "ring-2 ring-[#99462a]" : ""}`}
          >
            <p className="text-xl font-bold db-headline text-[#1a1c1b]">{problems.filter(p => p.status === s).length}</p>
            <p className="text-xs font-semibold uppercase tracking-wider text-[#55433d] opacity-60">{s}</p>
          </button>
        ))}
      </div>

      {/* Review queue alert */}
      {reviewQueue.length > 0 && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-[#d97757]/10 border border-[#d97757]/20">
          <RefreshCw className="w-4 h-4 text-[#99462a] flex-shrink-0" />
          <p className="text-sm text-[#7a2f15] font-medium">
            {reviewQueue.length} problem{reviewQueue.length > 1 ? "s" : ""} due for spaced repetition review
          </p>
          <button
            onClick={() => setFilterStatus("Review")}
            className="ml-auto text-xs font-semibold text-[#99462a] underline-offset-2 hover:underline"
          >
            Show
          </button>
        </div>
      )}

      {/* Filters + Add */}
      <div className="db-filter-bar">
        <div className="db-filter-pills">
          {["all", "Array", "String", "Tree", "Graph", "DP", ...uniqueTopics.filter(t => !["Array","String","Tree","Graph","DP"].includes(t))].map(t => (
            <button
              key={t}
              onClick={() => setFilterTopic(t)}
              className={`db-filter-pill ${filterTopic === t ? "db-filter-pill-active" : "db-filter-pill-inactive"}`}
            >
              {t === "all" ? "All Topics" : t}
            </button>
          ))}
        </div>
        <div className="flex gap-2 flex-shrink-0">
          {(["all", "Easy", "Medium", "Hard"] as const).map(d => (
            <button
              key={d}
              onClick={() => setFilterDiff(d)}
              className={`db-filter-pill text-xs ${filterDiff === d ? "db-filter-pill-active" : "db-filter-pill-inactive"}`}
            >
              {d === "all" ? "All" : d}
            </button>
          ))}
          <button
            onClick={() => setShowAdd(v => !v)}
            className="db-btn-page-primary flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            Add
          </button>
        </div>
      </div>

      {/* Add form */}
      {showAdd && (
        <div className="db-content-card space-y-4">
          <h3 className="font-semibold text-[#1a1c1b] db-headline text-lg">Add Problem</h3>
          {error && <p className="text-sm text-[#ba1a1a] bg-[#ba1a1a]/8 rounded-lg px-3 py-2">{error}</p>}
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="text-xs font-bold uppercase tracking-wider text-[#55433d] opacity-60 block mb-1.5">Title *</label>
              <input
                value={form.title}
                onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                placeholder="Two Sum"
                className="w-full bg-[#f4f3f1] border-none rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-[#99462a]/30 text-[#1a1c1b] placeholder:text-[#55433d]/50"
              />
            </div>
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-[#55433d] opacity-60 block mb-1.5">Difficulty</label>
              <select
                value={form.difficulty}
                onChange={e => setForm(f => ({ ...f, difficulty: e.target.value as ProblemDifficulty }))}
                className="w-full bg-[#f4f3f1] border-none rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-[#99462a]/30 text-[#1a1c1b]"
              >
                {(["Easy", "Medium", "Hard"] as const).map(d => <option key={d}>{d}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-[#55433d] opacity-60 block mb-1.5">Topic</label>
              <select
                value={form.topic}
                onChange={e => setForm(f => ({ ...f, topic: e.target.value }))}
                className="w-full bg-[#f4f3f1] border-none rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-[#99462a]/30 text-[#1a1c1b]"
              >
                {PROBLEM_TOPICS.map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-[#55433d] opacity-60 block mb-1.5">Status</label>
              <select
                value={form.status}
                onChange={e => setForm(f => ({ ...f, status: e.target.value as ProblemStatus }))}
                className="w-full bg-[#f4f3f1] border-none rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-[#99462a]/30 text-[#1a1c1b]"
              >
                {(["Todo", "Attempted", "Solved", "Review"] as const).map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-[#55433d] opacity-60 block mb-1.5">LeetCode URL</label>
              <input
                type="url"
                value={form.url}
                onChange={e => setForm(f => ({ ...f, url: e.target.value }))}
                placeholder="https://leetcode.com/problems/..."
                className="w-full bg-[#f4f3f1] border-none rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-[#99462a]/30 text-[#1a1c1b] placeholder:text-[#55433d]/50"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="text-xs font-bold uppercase tracking-wider text-[#55433d] opacity-60 block mb-1.5">Company Tags <span className="normal-case font-normal opacity-60">(comma-separated)</span></label>
              <input
                value={form.company_tags}
                onChange={e => setForm(f => ({ ...f, company_tags: e.target.value }))}
                placeholder="Google, Meta, Amazon"
                className="w-full bg-[#f4f3f1] border-none rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-[#99462a]/30 text-[#1a1c1b] placeholder:text-[#55433d]/50"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="text-xs font-bold uppercase tracking-wider text-[#55433d] opacity-60 block mb-1.5">Notes</label>
              <textarea
                value={form.notes}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                rows={2}
                placeholder="Key insight, approach, edge cases..."
                className="w-full bg-[#f4f3f1] border-none rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-[#99462a]/30 text-[#1a1c1b] placeholder:text-[#55433d]/50 resize-none"
              />
            </div>
          </div>
          <div className="flex gap-3 pt-1">
            <button onClick={handleAdd} disabled={isPending} className="db-btn-page-primary">
              {isPending ? "Adding…" : "Add Problem"}
            </button>
            <button onClick={() => { setShowAdd(false); setError(null); setForm(defaultForm); }} className="db-btn-page-secondary">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Problem list */}
      {filtered.length === 0 ? (
        <div className="db-content-card text-center py-16">
          <Code2 className="w-10 h-10 mx-auto mb-4 text-[#55433d] opacity-30" />
          <h3 className="db-headline text-lg font-semibold text-[#1a1c1b] mb-1">No problems yet</h3>
          <p className="text-sm text-[#55433d] opacity-60">Add your first LeetCode problem to start tracking.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(p => (
            <div key={p.id} className="db-content-card flex items-start gap-4 hover:shadow-md transition-shadow">
              {/* Status toggle */}
              <button
                onClick={() => handleStatusChange(p.id, p.status === "Solved" ? "Todo" : "Solved")}
                className="flex-shrink-0 mt-0.5"
                title={p.status === "Solved" ? "Mark as Todo" : "Mark as Solved"}
              >
                {p.status === "Solved"
                  ? <CheckCircle2 className="w-5 h-5 text-[#006d34]" />
                  : <div className="w-5 h-5 rounded-full border-2 border-[#dbc1b9] hover:border-[#99462a] transition-colors" />}
              </button>

              {/* Main info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-start gap-2 flex-wrap">
                  <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${DIFFICULTY_COLORS[p.difficulty]}`}>{p.difficulty}</span>
                  <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${STATUS_COLORS[p.status]}`}>{p.status}</span>
                  <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-[#dbc1b9]/40 text-[#55433d]">{p.topic}</span>
                </div>
                <h4 className={`font-semibold text-sm mt-1.5 text-[#1a1c1b] ${p.status === "Solved" ? "line-through opacity-60" : ""}`}>
                  {p.title}
                </h4>
                {p.company_tags.length > 0 && (
                  <div className="flex items-center gap-1 mt-1.5 flex-wrap">
                    <Tag className="w-3 h-3 text-[#55433d] opacity-50" />
                    {p.company_tags.map(tag => (
                      <span key={tag} className="text-[10px] text-[#55433d] opacity-60 bg-[#f4f3f1] px-1.5 py-0.5 rounded">{tag}</span>
                    ))}
                  </div>
                )}
                {p.notes && <p className="text-xs text-[#55433d] opacity-60 mt-1.5 line-clamp-2 italic">{p.notes}</p>}
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 flex-shrink-0">
                {p.time_to_solve_minutes && (
                  <span className="text-xs text-[#55433d] opacity-50 flex items-center gap-1">
                    <Clock className="w-3 h-3" />{p.time_to_solve_minutes}m
                  </span>
                )}
                <select
                  value={p.status}
                  onChange={e => handleStatusChange(p.id, e.target.value as ProblemStatus)}
                  className="text-xs bg-[#f4f3f1] border-none rounded-lg px-2 py-1.5 text-[#55433d] outline-none cursor-pointer"
                  onClick={e => e.stopPropagation()}
                >
                  {(["Todo", "Attempted", "Solved", "Review"] as const).map(s => <option key={s}>{s}</option>)}
                </select>
                {p.url && (
                  <a href={p.url} target="_blank" rel="noopener noreferrer" className="text-[#55433d] opacity-40 hover:opacity-80 transition-opacity">
                    <ExternalLink className="w-4 h-4" />
                  </a>
                )}
                <button onClick={() => handleDelete(p.id)} className="text-[#ba1a1a] opacity-40 hover:opacity-80 transition-opacity">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
