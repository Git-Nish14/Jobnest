"use client";

import { useState, useTransition } from "react";
import { Plus, Star, Trash2, CheckCircle2, XCircle, Calendar } from "lucide-react";
import type { MockInterview, MockInterviewType, MockInterviewStatus } from "@/types/prep";
import { formatFullDate, formatTime } from "@/lib/utils/date";

const TYPE_STYLES: Record<MockInterviewType, string> = {
  DSA:            "bg-[#99462a]/10 text-[#99462a]",
  Behavioral:     "bg-[#006d34]/10 text-[#006d34]",
  "System Design":"bg-[#1e4a8a]/10 text-[#1e4a8a]",
  Mixed:          "bg-[#7c5200]/10 text-[#7c5200]",
};

interface Props {
  mockInterviews: MockInterview[];
  onChange: (updated: MockInterview[]) => void;
  onActivity: () => void;
}

interface AddForm {
  scheduled_at: string;
  type: MockInterviewType;
  partner_name: string;
}

const defaultForm: AddForm = {
  scheduled_at: "", type: "DSA", partner_name: "",
};

function StarRating({ value, onSelect }: { value: number | null; onSelect: (n: number) => void }) {
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map(n => (
        <button key={n} onClick={() => onSelect(n)} className="p-0.5">
          <Star className={`w-4 h-4 ${n <= (value ?? 0) ? "fill-[#d97757] text-[#d97757]" : "text-[#dbc1b9]"}`} />
        </button>
      ))}
    </div>
  );
}

export function MockInterviewScheduler({ mockInterviews, onChange, onActivity }: Props) {
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState<AddForm>(defaultForm);
  const [error, setError] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<Record<string, { text: string; topics: string }>>({});
  const [isPending, startTransition] = useTransition();

  const filtered = mockInterviews.filter(m => filterStatus === "all" || m.status === filterStatus);
  const upcoming = mockInterviews.filter(m => m.status === "Scheduled" && new Date(m.scheduled_at) > new Date());
  const completed = mockInterviews.filter(m => m.status === "Completed").length;
  const avgScore = (() => {
    const scored = mockInterviews.filter(m => m.score !== null);
    if (!scored.length) return null;
    return (scored.reduce((s, m) => s + (m.score ?? 0), 0) / scored.length).toFixed(1);
  })();

  const handleAdd = () => {
    if (!form.scheduled_at) { setError("Please select a date and time"); return; }
    setError(null);
    startTransition(async () => {
      const res = await fetch("/api/prep/mock-interviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          partner_name: form.partner_name || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Failed to add mock interview"); return; }
      onChange([data.mockInterview, ...mockInterviews]);
      setForm(defaultForm);
      setShowAdd(false);
    });
  };

  const handleComplete = (id: string, score: number) => {
    const fb = feedback[id] ?? { text: "", topics: "" };
    startTransition(async () => {
      const res = await fetch(`/api/prep/mock-interviews/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "Completed",
          score,
          feedback: fb.text || null,
          topics_to_revisit: fb.topics.split(",").map(t => t.trim()).filter(Boolean),
        }),
      });
      if (res.ok) {
        const { mockInterview } = await res.json();
        onChange(mockInterviews.map(m => m.id === id ? mockInterview : m));
        setExpandedId(null);
        onActivity();
      }
    });
  };

  const handleStatusChange = (id: string, status: MockInterviewStatus) => {
    startTransition(async () => {
      const res = await fetch(`/api/prep/mock-interviews/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (res.ok) {
        const { mockInterview } = await res.json();
        onChange(mockInterviews.map(m => m.id === id ? mockInterview : m));
        if (status === "Completed") onActivity();
      }
    });
  };

  const handleDelete = (id: string) => {
    startTransition(async () => {
      const res = await fetch(`/api/prep/mock-interviews/${id}`, { method: "DELETE" });
      if (res.ok) onChange(mockInterviews.filter(m => m.id !== id));
    });
  };

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="db-content-card text-center py-4">
          <p className="text-2xl font-bold db-headline text-[#1a1c1b]">{upcoming.length}</p>
          <p className="text-xs uppercase tracking-wider text-[#55433d] opacity-50 font-semibold">Upcoming</p>
        </div>
        <div className="db-content-card text-center py-4">
          <p className="text-2xl font-bold db-headline text-[#006d34]">{completed}</p>
          <p className="text-xs uppercase tracking-wider text-[#55433d] opacity-50 font-semibold">Completed</p>
        </div>
        <div className="db-content-card text-center py-4">
          <p className="text-2xl font-bold db-headline text-[#d97757]">{avgScore ?? "—"}</p>
          <p className="text-xs uppercase tracking-wider text-[#55433d] opacity-50 font-semibold">Avg Score</p>
        </div>
      </div>

      {/* Toolbar */}
      <div className="db-filter-bar">
        <div className="db-filter-pills">
          {["all", "Scheduled", "Completed", "Cancelled"].map(s => (
            <button key={s} onClick={() => setFilterStatus(s)}
              className={`db-filter-pill ${filterStatus === s ? "db-filter-pill-active" : "db-filter-pill-inactive"}`}>
              {s === "all" ? "All" : s}
            </button>
          ))}
        </div>
        <button onClick={() => setShowAdd(v => !v)} className="db-btn-page-primary flex-shrink-0 flex items-center gap-1.5">
          <Plus className="w-4 h-4" /> Schedule
        </button>
      </div>

      {/* Add form */}
      {showAdd && (
        <div className="db-content-card space-y-4">
          <h3 className="db-headline text-lg font-semibold text-[#1a1c1b]">Schedule Mock Interview</h3>
          {error && <p className="text-sm text-[#ba1a1a] bg-[#ba1a1a]/8 rounded-lg px-3 py-2">{error}</p>}
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-[#55433d] opacity-60 block mb-1.5">Date & Time *</label>
              <input type="datetime-local" value={form.scheduled_at} onChange={e => setForm(f => ({...f, scheduled_at: e.target.value}))}
                className="w-full bg-[#f4f3f1] border-none rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-[#99462a]/30 text-[#1a1c1b]" />
            </div>
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-[#55433d] opacity-60 block mb-1.5">Type</label>
              <select value={form.type} onChange={e => setForm(f => ({...f, type: e.target.value as MockInterviewType}))}
                className="w-full bg-[#f4f3f1] border-none rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-[#99462a]/30 text-[#1a1c1b]">
                {(["DSA", "Behavioral", "System Design", "Mixed"] as const).map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="text-xs font-bold uppercase tracking-wider text-[#55433d] opacity-60 block mb-1.5">Partner Name <span className="normal-case font-normal opacity-60">(optional)</span></label>
              <input value={form.partner_name} onChange={e => setForm(f => ({...f, partner_name: e.target.value}))}
                placeholder="Peer name or 'Solo'"
                className="w-full bg-[#f4f3f1] border-none rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-[#99462a]/30 text-[#1a1c1b] placeholder:text-[#55433d]/50" />
            </div>
          </div>
          <div className="flex gap-3">
            <button onClick={handleAdd} disabled={isPending} className="db-btn-page-primary">{isPending ? "Scheduling…" : "Schedule"}</button>
            <button onClick={() => { setShowAdd(false); setError(null); setForm(defaultForm); }} className="db-btn-page-secondary">Cancel</button>
          </div>
        </div>
      )}

      {/* List */}
      {filtered.length === 0 ? (
        <div className="db-content-card text-center py-16">
          <Calendar className="w-10 h-10 mx-auto mb-4 text-[#55433d] opacity-30" />
          <h3 className="db-headline text-lg font-semibold text-[#1a1c1b] mb-1">No mock interviews yet</h3>
          <p className="text-sm text-[#55433d] opacity-60">Schedule your first mock to practice under pressure.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(m => {
            const isExpanded = expandedId === m.id;
            const fb = feedback[m.id] ?? { text: "", topics: "" };
            const isPast = new Date(m.scheduled_at) < new Date();

            return (
              <div key={m.id} className="db-content-card">
                <div className="flex items-start gap-4">
                  {/* Status icon */}
                  <div className="flex-shrink-0 mt-0.5">
                    {m.status === "Completed"
                      ? <CheckCircle2 className="w-5 h-5 text-[#006d34]" />
                      : m.status === "Cancelled"
                      ? <XCircle className="w-5 h-5 text-[#ba1a1a] opacity-50" />
                      : <Calendar className="w-5 h-5 text-[#99462a]" />}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${TYPE_STYLES[m.type]}`}>{m.type}</span>
                      {m.score && (
                        <div className="flex items-center gap-0.5">
                          {[1,2,3,4,5].map(n => <Star key={n} className={`w-3 h-3 ${n <= m.score! ? "fill-[#d97757] text-[#d97757]" : "text-[#dbc1b9]"}`} />)}
                        </div>
                      )}
                    </div>
                    <p className="font-semibold text-sm text-[#1a1c1b]">
                      {formatFullDate(m.scheduled_at)}
                      <span className="text-[#55433d] opacity-60 font-normal ml-2">
                        {formatTime(m.scheduled_at)}
                      </span>
                    </p>
                    {m.partner_name && <p className="text-xs text-[#55433d] opacity-60 mt-0.5">with {m.partner_name}</p>}
                    {m.topics_to_revisit.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {m.topics_to_revisit.map(t => (
                          <span key={t} className="text-[10px] bg-[#d97757]/15 text-[#7a2f15] px-1.5 py-0.5 rounded font-medium">↻ {t}</span>
                        ))}
                      </div>
                    )}
                    {m.feedback && <p className="text-xs text-[#55433d] opacity-60 mt-1.5 italic line-clamp-2">{m.feedback}</p>}
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    {m.status === "Scheduled" && isPast && (
                      <button
                        onClick={() => setExpandedId(isExpanded ? null : m.id)}
                        className="text-xs font-semibold text-[#99462a] hover:underline underline-offset-2"
                      >
                        Log result
                      </button>
                    )}
                    {m.status === "Scheduled" && !isPast && (
                      <button
                        onClick={() => handleStatusChange(m.id, "Cancelled")}
                        className="text-xs text-[#55433d] opacity-50 hover:opacity-80"
                      >
                        Cancel
                      </button>
                    )}
                    <button onClick={() => handleDelete(m.id)} className="text-[#ba1a1a] opacity-30 hover:opacity-70 transition-opacity">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Log result form */}
                {isExpanded && m.status === "Scheduled" && (
                  <div className="mt-4 pt-4 border-t border-[#dbc1b9]/20 space-y-4">
                    <div>
                      <label className="text-xs font-bold uppercase tracking-wider text-[#55433d] opacity-60 block mb-2">Score (1–5)</label>
                      <StarRating
                        value={null}
                        onSelect={score => handleComplete(m.id, score)}
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold uppercase tracking-wider text-[#55433d] opacity-60 block mb-1.5">Feedback</label>
                      <textarea
                        value={fb.text}
                        onChange={e => setFeedback(f => ({...f, [m.id]: {...(f[m.id] ?? {text:"",topics:""}), text: e.target.value}}))}
                        rows={2}
                        placeholder="What went well? What to improve?"
                        className="w-full bg-[#f4f3f1] border-none rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-[#99462a]/30 text-[#1a1c1b] placeholder:text-[#55433d]/50 resize-none"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold uppercase tracking-wider text-[#55433d] opacity-60 block mb-1.5">Topics to revisit <span className="normal-case font-normal opacity-60">(comma-separated)</span></label>
                      <input
                        value={fb.topics}
                        onChange={e => setFeedback(f => ({...f, [m.id]: {...(f[m.id] ?? {text:"",topics:""}), topics: e.target.value}}))}
                        placeholder="Dynamic Programming, Binary Search"
                        className="w-full bg-[#f4f3f1] border-none rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-[#99462a]/30 text-[#1a1c1b] placeholder:text-[#55433d]/50"
                      />
                    </div>
                    <p className="text-xs text-[#55433d] opacity-50">Click a star above to save the result.</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
