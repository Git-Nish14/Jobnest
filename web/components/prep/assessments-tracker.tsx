"use client";

import { useState, useTransition } from "react";
import { Plus, Trash2, Clock, AlertTriangle, CheckCircle2, ClipboardList } from "lucide-react";
import type { Assessment, AssessmentStatus } from "@/types/prep";

const STATUS_STYLES: Record<AssessmentStatus, string> = {
  Pending:      "bg-[#55433d]/8 text-[#55433d]",
  "In Progress":"bg-[#7c5200]/10 text-[#7c5200]",
  Submitted:    "bg-[#1e4a8a]/10 text-[#1e4a8a]",
  Passed:       "bg-[#006d34]/10 text-[#006d34]",
  Failed:       "bg-[#ba1a1a]/10 text-[#ba1a1a]",
};

interface Props {
  assessments: Assessment[];
  onChange: (updated: Assessment[]) => void;
  onActivity: () => void;
}

interface AddForm {
  title: string;
  platform: string;
  deadline: string;
  time_limit_hours: string;
  tech_stack: string;
  status: AssessmentStatus;
}

const defaultForm: AddForm = {
  title: "", platform: "", deadline: "", time_limit_hours: "", tech_stack: "", status: "Pending",
};

function isOverdue(a: Assessment): boolean {
  return !!a.deadline && new Date(a.deadline) < new Date() && a.status === "Pending" || a.status === "In Progress";
}

function daysUntil(dateStr: string): number {
  return Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86_400_000);
}

export function AssessmentsTracker({ assessments, onChange, onActivity }: Props) {
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState<AddForm>(defaultForm);
  const [filterStatus, setFilterStatus] = useState("all");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const filtered = assessments.filter(a => filterStatus === "all" || a.status === filterStatus);
  const overdue = assessments.filter(a => isOverdue(a) && a.deadline && new Date(a.deadline) < new Date());

  const handleAdd = () => {
    if (!form.title.trim()) { setError("Title is required"); return; }
    setError(null);
    startTransition(async () => {
      const res = await fetch("/api/prep/assessments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          deadline: form.deadline || null,
          time_limit_hours: form.time_limit_hours ? parseFloat(form.time_limit_hours) : null,
          tech_stack: form.tech_stack.split(",").map(t => t.trim()).filter(Boolean),
        }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Failed to add assessment"); return; }
      onChange([data.assessment, ...assessments]);
      setForm(defaultForm);
      setShowAdd(false);
      onActivity();
    });
  };

  const handleStatusChange = (id: string, status: AssessmentStatus) => {
    startTransition(async () => {
      const res = await fetch(`/api/prep/assessments/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (res.ok) {
        const { assessment } = await res.json();
        onChange(assessments.map(a => a.id === id ? assessment : a));
      }
    });
  };

  const handleDelete = (id: string) => {
    startTransition(async () => {
      const res = await fetch(`/api/prep/assessments/${id}`, { method: "DELETE" });
      if (res.ok) onChange(assessments.filter(a => a.id !== id));
    });
  };

  return (
    <div className="space-y-6">
      {/* Overdue warning */}
      {overdue.length > 0 && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-[#ba1a1a]/8 border border-[#ba1a1a]/15">
          <AlertTriangle className="w-4 h-4 text-[#ba1a1a] flex-shrink-0" />
          <p className="text-sm text-[#ba1a1a] font-medium">
            {overdue.length} assessment{overdue.length > 1 ? "s" : ""} past deadline
          </p>
        </div>
      )}

      {/* Toolbar */}
      <div className="db-filter-bar">
        <div className="db-filter-pills">
          {["all", "Pending", "In Progress", "Submitted", "Passed", "Failed"].map(s => (
            <button key={s} onClick={() => setFilterStatus(s)}
              className={`db-filter-pill ${filterStatus === s ? "db-filter-pill-active" : "db-filter-pill-inactive"}`}>
              {s === "all" ? "All" : s}
              {s !== "all" && (
                <span className="ml-1 opacity-60">({assessments.filter(a => a.status === s).length})</span>
              )}
            </button>
          ))}
        </div>
        <button onClick={() => setShowAdd(v => !v)} className="db-btn-page-primary flex-shrink-0 flex items-center gap-1.5">
          <Plus className="w-4 h-4" /> Add
        </button>
      </div>

      {/* Add form */}
      {showAdd && (
        <div className="db-content-card space-y-4">
          <h3 className="db-headline text-lg font-semibold text-[#1a1c1b]">Add Assessment</h3>
          {error && <p className="text-sm text-[#ba1a1a] bg-[#ba1a1a]/8 rounded-lg px-3 py-2">{error}</p>}
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="text-xs font-bold uppercase tracking-wider text-[#55433d] opacity-60 block mb-1.5">Title *</label>
              <input value={form.title} onChange={e => setForm(f => ({...f, title: e.target.value}))}
                placeholder="HackerRank Coding Challenge — Stripe"
                className="w-full bg-[#f4f3f1] border-none rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-[#99462a]/30 text-[#1a1c1b] placeholder:text-[#55433d]/50" />
            </div>
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-[#55433d] opacity-60 block mb-1.5">Platform</label>
              <select value={form.platform} onChange={e => setForm(f => ({...f, platform: e.target.value}))}
                className="w-full bg-[#f4f3f1] border-none rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-[#99462a]/30 text-[#1a1c1b]">
                <option value="">None / Custom</option>
                {["HackerRank", "CodeSignal", "Codility", "Karat", "CoderPad", "LeetCode", "Other"].map(p => <option key={p}>{p}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-[#55433d] opacity-60 block mb-1.5">Status</label>
              <select value={form.status} onChange={e => setForm(f => ({...f, status: e.target.value as AssessmentStatus}))}
                className="w-full bg-[#f4f3f1] border-none rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-[#99462a]/30 text-[#1a1c1b]">
                {(["Pending", "In Progress", "Submitted", "Passed", "Failed"] as const).map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-[#55433d] opacity-60 block mb-1.5">Deadline</label>
              <input type="datetime-local" value={form.deadline} onChange={e => setForm(f => ({...f, deadline: e.target.value}))}
                className="w-full bg-[#f4f3f1] border-none rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-[#99462a]/30 text-[#1a1c1b]" />
            </div>
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-[#55433d] opacity-60 block mb-1.5">Time Limit (hours)</label>
              <input type="number" step="0.5" min="0" value={form.time_limit_hours} onChange={e => setForm(f => ({...f, time_limit_hours: e.target.value}))}
                placeholder="2"
                className="w-full bg-[#f4f3f1] border-none rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-[#99462a]/30 text-[#1a1c1b] placeholder:text-[#55433d]/50" />
            </div>
            <div className="sm:col-span-2">
              <label className="text-xs font-bold uppercase tracking-wider text-[#55433d] opacity-60 block mb-1.5">Tech Stack <span className="normal-case font-normal opacity-60">(comma-separated)</span></label>
              <input value={form.tech_stack} onChange={e => setForm(f => ({...f, tech_stack: e.target.value}))}
                placeholder="JavaScript, Node.js, SQL"
                className="w-full bg-[#f4f3f1] border-none rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-[#99462a]/30 text-[#1a1c1b] placeholder:text-[#55433d]/50" />
            </div>
          </div>
          <div className="flex gap-3 pt-1">
            <button onClick={handleAdd} disabled={isPending} className="db-btn-page-primary">{isPending ? "Adding…" : "Add Assessment"}</button>
            <button onClick={() => { setShowAdd(false); setError(null); setForm(defaultForm); }} className="db-btn-page-secondary">Cancel</button>
          </div>
        </div>
      )}

      {/* List */}
      {filtered.length === 0 ? (
        <div className="db-content-card text-center py-16">
          <ClipboardList className="w-10 h-10 mx-auto mb-4 text-[#55433d] opacity-30" />
          <h3 className="db-headline text-lg font-semibold text-[#1a1c1b] mb-1">No assessments yet</h3>
          <p className="text-sm text-[#55433d] opacity-60">Track HackerRank, CodeSignal, and custom take-homes.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(a => {
            const days = a.deadline ? daysUntil(a.deadline) : null;
            const urgent = days !== null && days <= 1 && ["Pending", "In Progress"].includes(a.status);

            return (
              <div key={a.id} className={`db-content-card ${urgent ? "border-[#ba1a1a]/20" : ""}`}>
                <div className="flex items-start gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${STATUS_STYLES[a.status]}`}>{a.status}</span>
                      {a.platform && <span className="text-[10px] bg-[#dbc1b9]/40 text-[#55433d] px-2 py-0.5 rounded-full font-semibold">{a.platform}</span>}
                      {a.time_limit_hours && <span className="text-[10px] text-[#55433d] opacity-50 flex items-center gap-1"><Clock className="w-3 h-3" />{a.time_limit_hours}h</span>}
                    </div>
                    <h4 className="font-semibold text-sm text-[#1a1c1b]">{a.title}</h4>
                    {a.job_applications && (
                      <p className="text-xs text-[#55433d] opacity-60 mt-0.5">{a.job_applications.company} — {a.job_applications.position}</p>
                    )}
                    {a.tech_stack.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {a.tech_stack.map(t => (
                          <span key={t} className="text-[10px] bg-[#f4f3f1] text-[#55433d] px-1.5 py-0.5 rounded">{t}</span>
                        ))}
                      </div>
                    )}
                    {a.deadline && (
                      <p className={`text-xs mt-1.5 font-medium ${urgent ? "text-[#ba1a1a]" : "text-[#55433d] opacity-60"}`}>
                        {days !== null && days < 0 ? "Overdue" : days === 0 ? "Due today" : days === 1 ? "Due tomorrow" : `Due in ${days} days`}
                        {" — "}{new Date(a.deadline).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {a.status === "Submitted" || a.status === "Pending" || a.status === "In Progress" ? (
                      <select
                        value={a.status}
                        onChange={e => handleStatusChange(a.id, e.target.value as AssessmentStatus)}
                        className="text-xs bg-[#f4f3f1] border-none rounded-lg px-2 py-1.5 text-[#55433d] outline-none cursor-pointer"
                      >
                        {(["Pending", "In Progress", "Submitted", "Passed", "Failed"] as const).map(s => <option key={s}>{s}</option>)}
                      </select>
                    ) : (
                      <span className="text-[#006d34]">
                        {a.status === "Passed" ? <CheckCircle2 className="w-5 h-5" /> : null}
                      </span>
                    )}
                    <button onClick={() => handleDelete(a.id)} className="text-[#ba1a1a] opacity-30 hover:opacity-70 transition-opacity">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
