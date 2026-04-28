"use client";

import { useState, useEffect } from "react";
import { Plus, Trash2, Loader2, Code, Award, GraduationCap } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

// ── Types ─────────────────────────────────────────────────────────────────────

interface Skill {
  id: string; name: string; category: string; proficiency: string; years_experience: number | null;
}
interface Certification {
  id: string; name: string; provider: string | null; issued_at: string; expires_at: string | null;
}
interface Education {
  id: string; institution: string; degree: string; field_of_study: string | null;
  gpa: number | null; show_gpa: boolean; start_date: string; end_date: string | null; is_current: boolean;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const SKILL_CATEGORIES    = ["Language","Framework","Database","Cloud","Tool","Soft"] as const;
const SKILL_PROFICIENCIES = ["Beginner","Intermediate","Advanced","Expert"] as const;
const DEGREE_OPTIONS      = ["BS","MS","PhD","MBA","Associate","Bootcamp","Certificate","Self-taught","Other"] as const;

const PROFICIENCY_COLORS: Record<string, string> = {
  Beginner:     "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400",
  Intermediate: "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300",
  Advanced:     "bg-[#99462a]/10 text-[#99462a] dark:bg-[#ccff00]/10 dark:text-[#ccff00]",
  Expert:       "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300",
};

// ── Skills ────────────────────────────────────────────────────────────────────

function SkillsSection() {
  const [skills, setSkills]   = useState<Skill[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding]   = useState(false);
  const [form, setForm]       = useState({ name: "", category: "Language", proficiency: "Intermediate", years_experience: "" });

  // Initial load — setState only inside .then() callbacks (never synchronously in effect body)
  useEffect(() => {
    let cancelled = false;
    fetch("/api/profile/skills")
      .then((r) => r.ok ? (r.json() as Promise<{ skills: Skill[] }>) : null)
      .then((d) => { if (!cancelled) { if (d) setSkills(d.skills); setLoading(false); } })
      .catch(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const add = async () => {
    if (!form.name.trim()) return;
    setAdding(true);
    const res = await fetch("/api/profile/skills", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: form.name.trim(), category: form.category, proficiency: form.proficiency, years_experience: form.years_experience ? Number(form.years_experience) : null }),
    });
    setAdding(false);
    if (res.ok) {
      const d = await res.json() as { skill: Skill };
      setSkills((s) => [...s, d.skill]);
      setForm({ name: "", category: "Language", proficiency: "Intermediate", years_experience: "" });
      toast.success("Skill added.");
    } else { toast.error("Failed to add skill."); }
  };

  const remove = async (id: string) => {
    const res = await fetch(`/api/profile/skills?id=${id}`, { method: "DELETE" });
    if (!res.ok) { toast.error("Failed to remove skill."); return; }
    setSkills((s) => s.filter((x) => x.id !== id));
    toast.success("Skill removed.");
  };

  return (
    <div className="db-content-card space-y-4">
      <h2 className="db-headline text-lg font-semibold text-foreground flex items-center gap-2">
        <Code className="h-5 w-5 text-[#99462a] dark:text-[#ccff00]" /> Skills
      </h2>

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
        <input placeholder="Skill name (e.g. TypeScript)" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} onKeyDown={(e) => { if (e.key === "Enter") void add(); }}
          className="sm:col-span-2 rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#99462a]" />
        <select aria-label="Category" value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
          className="rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#99462a]">
          {SKILL_CATEGORIES.map((c) => <option key={c}>{c}</option>)}
        </select>
        <select aria-label="Proficiency" value={form.proficiency} onChange={(e) => setForm((f) => ({ ...f, proficiency: e.target.value }))}
          className="rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#99462a]">
          {SKILL_PROFICIENCIES.map((p) => <option key={p}>{p}</option>)}
        </select>
        <button type="button" onClick={() => void add()} disabled={adding || !form.name.trim()}
          className="sm:col-span-4 inline-flex items-center justify-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg bg-[#99462a] dark:bg-[#ccff00] text-white dark:text-black hover:opacity-90 disabled:opacity-50">
          {adding ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />} Add skill
        </button>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-xs text-muted-foreground py-2"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading…</div>
      ) : skills.length === 0 ? (
        <p className="text-xs text-muted-foreground">No skills added yet.</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {skills.map((s) => (
            <div key={s.id} className="flex items-center gap-1.5 rounded-full border border-border bg-background pl-3 pr-1.5 py-1">
              <span className="text-xs font-semibold text-foreground">{s.name}</span>
              <span className={cn("text-[10px] px-1.5 py-0.5 rounded-full font-medium", PROFICIENCY_COLORS[s.proficiency] ?? "bg-muted text-muted-foreground")}>{s.proficiency}</span>
              <span className="text-[10px] text-muted-foreground">{s.category}</span>
              <button type="button" onClick={() => void remove(s.id)} aria-label={`Remove ${s.name}`}
                className="h-5 w-5 flex items-center justify-center rounded-full text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors">
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Certifications ────────────────────────────────────────────────────────────

function CertificationsSection() {
  const [certs, setCerts]     = useState<Certification[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding]   = useState(false);
  const [form, setForm]       = useState({ name: "", provider: "", issued_at: "", expires_at: "" });

  useEffect(() => {
    let cancelled = false;
    fetch("/api/profile/certifications")
      .then((r) => r.ok ? (r.json() as Promise<{ certifications: Certification[] }>) : null)
      .then((d) => { if (!cancelled) { if (d) setCerts(d.certifications); setLoading(false); } })
      .catch(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const add = async () => {
    if (!form.name.trim() || !form.issued_at) return;
    setAdding(true);
    const res = await fetch("/api/profile/certifications", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: form.name.trim(), provider: form.provider.trim() || null, issued_at: form.issued_at, expires_at: form.expires_at || null }),
    });
    setAdding(false);
    if (res.ok) {
      const d = await res.json() as { certification: Certification };
      setCerts((c) => [...c, d.certification]);
      setForm({ name: "", provider: "", issued_at: "", expires_at: "" });
      toast.success("Certification added.");
    } else { const d = await res.json() as { error?: string }; toast.error(d.error ?? "Failed to add certification."); }
  };

  const remove = async (id: string) => {
    const res = await fetch(`/api/profile/certifications?id=${id}`, { method: "DELETE" });
    if (!res.ok) { toast.error("Failed to remove certification."); return; }
    setCerts((c) => c.filter((x) => x.id !== id));
    toast.success("Certification removed.");
  };

  const isExpired = (exp: string | null) => exp && new Date(exp) < new Date();
  const expiringSoon = (exp: string | null) => {
    if (!exp) return false;
    const diff = new Date(exp).getTime() - new Date().getTime();
    return diff > 0 && diff < 60 * 86_400_000;
  };

  return (
    <div className="db-content-card space-y-4">
      <h2 className="db-headline text-lg font-semibold text-foreground flex items-center gap-2">
        <Award className="h-5 w-5 text-[#99462a] dark:text-[#ccff00]" /> Certifications
      </h2>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <input placeholder="Certification name (e.g. AWS SAA)" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          className="rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#99462a]" />
        <input placeholder="Provider (e.g. Amazon)" value={form.provider} onChange={(e) => setForm((f) => ({ ...f, provider: e.target.value }))}
          className="rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#99462a]" />
        <div className="space-y-1">
          <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Issued *</label>
          <input type="date" aria-label="Issue date" value={form.issued_at} onChange={(e) => setForm((f) => ({ ...f, issued_at: e.target.value }))}
            className="w-full rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#99462a]" />
        </div>
        <div className="space-y-1">
          <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Expires (optional)</label>
          <input type="date" aria-label="Expiry date" value={form.expires_at} onChange={(e) => setForm((f) => ({ ...f, expires_at: e.target.value }))}
            className="w-full rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#99462a]" />
        </div>
        <button type="button" onClick={() => void add()} disabled={adding || !form.name.trim() || !form.issued_at}
          className="sm:col-span-2 inline-flex items-center justify-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg bg-[#99462a] dark:bg-[#ccff00] text-white dark:text-black hover:opacity-90 disabled:opacity-50">
          {adding ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />} Add certification
        </button>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-xs text-muted-foreground py-2"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading…</div>
      ) : certs.length === 0 ? (
        <p className="text-xs text-muted-foreground">No certifications yet.</p>
      ) : (
        <div className="space-y-2">
          {certs.map((c) => (
            <div key={c.id} className="flex items-start justify-between gap-3 rounded-xl border border-border px-4 py-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-foreground truncate">{c.name}</p>
                {c.provider && <p className="text-xs text-muted-foreground">{c.provider}</p>}
                <p className="text-xs text-muted-foreground mt-0.5">
                  Issued {new Date(c.issued_at).toLocaleDateString("en-US", { month: "short", year: "numeric" })}
                  {c.expires_at && (
                    <span className={cn("ml-2", isExpired(c.expires_at) ? "text-destructive font-medium" : expiringSoon(c.expires_at) ? "text-amber-600 dark:text-amber-400 font-medium" : "")}>
                      · Expires {new Date(c.expires_at).toLocaleDateString("en-US", { month: "short", year: "numeric" })}
                      {isExpired(c.expires_at) && " (expired)"}
                      {!isExpired(c.expires_at) && expiringSoon(c.expires_at) && " ⚠"}
                    </span>
                  )}
                </p>
              </div>
              <button type="button" onClick={() => void remove(c.id)} aria-label={`Remove ${c.name}`}
                className="h-7 w-7 flex items-center justify-center shrink-0 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Education ──────────────────────────────────────────────────────────────────

function EducationSection() {
  const [entries, setEntries] = useState<Education[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding]   = useState(false);
  const [form, setForm]       = useState({
    institution: "", degree: "BS", field_of_study: "", gpa: "",
    show_gpa: false, start_date: "", end_date: "", is_current: false,
  });

  useEffect(() => {
    let cancelled = false;
    fetch("/api/profile/education")
      .then((r) => r.ok ? (r.json() as Promise<{ education: Education[] }>) : null)
      .then((d) => { if (!cancelled) { if (d) setEntries(d.education); setLoading(false); } })
      .catch(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const add = async () => {
    if (!form.institution.trim() || !form.start_date) return;
    setAdding(true);
    const res = await fetch("/api/profile/education", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        institution: form.institution.trim(), degree: form.degree,
        field_of_study: form.field_of_study.trim() || null,
        gpa: form.gpa ? Number(form.gpa) : null, show_gpa: form.show_gpa,
        start_date: form.start_date,
        end_date: form.is_current ? null : (form.end_date || null),
        is_current: form.is_current,
      }),
    });
    setAdding(false);
    if (res.ok) {
      const d = await res.json() as { education: Education };
      setEntries((e) => [...e, d.education]);
      setForm({ institution: "", degree: "BS", field_of_study: "", gpa: "", show_gpa: false, start_date: "", end_date: "", is_current: false });
      toast.success("Education added.");
    } else { const d = await res.json() as { error?: string }; toast.error(d.error ?? "Failed to add education."); }
  };

  const remove = async (id: string) => {
    const res = await fetch(`/api/profile/education?id=${id}`, { method: "DELETE" });
    if (!res.ok) { toast.error("Failed to remove education entry."); return; }
    setEntries((e) => e.filter((x) => x.id !== id));
    toast.success("Education entry removed.");
  };

  return (
    <div className="db-content-card space-y-4">
      <h2 className="db-headline text-lg font-semibold text-foreground flex items-center gap-2">
        <GraduationCap className="h-5 w-5 text-[#99462a] dark:text-[#ccff00]" /> Education
      </h2>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <input placeholder="Institution name" value={form.institution} onChange={(e) => setForm((f) => ({ ...f, institution: e.target.value }))}
          className="sm:col-span-2 rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#99462a]" />
        <select aria-label="Degree" value={form.degree} onChange={(e) => setForm((f) => ({ ...f, degree: e.target.value }))}
          className="rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#99462a]">
          {DEGREE_OPTIONS.map((d) => <option key={d}>{d}</option>)}
        </select>
        <input placeholder="Field of study (optional)" value={form.field_of_study} onChange={(e) => setForm((f) => ({ ...f, field_of_study: e.target.value }))}
          className="rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#99462a]" />
        <div className="space-y-1">
          <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Start date *</label>
          <input type="date" aria-label="Start date" value={form.start_date} onChange={(e) => setForm((f) => ({ ...f, start_date: e.target.value }))}
            className="w-full rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#99462a]" />
        </div>
        <div className="space-y-1">
          <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">End date</label>
          <input type="date" aria-label="End date" value={form.end_date} disabled={form.is_current} onChange={(e) => setForm((f) => ({ ...f, end_date: e.target.value }))}
            className="w-full rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#99462a] disabled:opacity-40" />
        </div>
        <div className="flex items-center gap-2 text-sm">
          <input type="checkbox" id="is_current" checked={form.is_current} onChange={(e) => setForm((f) => ({ ...f, is_current: e.target.checked }))} className="accent-[#99462a]" />
          <label htmlFor="is_current" className="text-sm text-foreground">Currently enrolled</label>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <div className="flex items-center gap-2">
            <input type="checkbox" id="show_gpa" checked={form.show_gpa} onChange={(e) => setForm((f) => ({ ...f, show_gpa: e.target.checked }))} className="accent-[#99462a]" />
            <label htmlFor="show_gpa" className="text-sm text-foreground">Show GPA</label>
          </div>
          {form.show_gpa && (
            <input type="number" min={0} max={4} step={0.01} placeholder="e.g. 3.8" value={form.gpa} onChange={(e) => setForm((f) => ({ ...f, gpa: e.target.value }))}
              aria-label="GPA" className="w-20 rounded-lg border border-border bg-muted/30 px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-[#99462a]" />
          )}
        </div>
        <button type="button" onClick={() => void add()} disabled={adding || !form.institution.trim() || !form.start_date}
          className="sm:col-span-2 inline-flex items-center justify-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg bg-[#99462a] dark:bg-[#ccff00] text-white dark:text-black hover:opacity-90 disabled:opacity-50">
          {adding ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />} Add education
        </button>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-xs text-muted-foreground py-2"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading…</div>
      ) : entries.length === 0 ? (
        <p className="text-xs text-muted-foreground">No education entries yet.</p>
      ) : (
        <div className="space-y-2">
          {entries.map((e) => (
            <div key={e.id} className="flex items-start justify-between gap-3 rounded-xl border border-border px-4 py-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-foreground truncate">{e.institution}</p>
                <p className="text-xs text-muted-foreground">{e.degree}{e.field_of_study ? ` · ${e.field_of_study}` : ""}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {new Date(e.start_date).getFullYear()} – {e.is_current ? "Present" : e.end_date ? new Date(e.end_date).getFullYear() : "—"}
                  {e.show_gpa && e.gpa != null && ` · GPA ${e.gpa.toFixed(2)}`}
                </p>
              </div>
              <button type="button" onClick={() => void remove(e.id)} aria-label={`Remove ${e.institution}`}
                className="h-7 w-7 flex items-center justify-center shrink-0 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main export ────────────────────────────────────────────────────────────────

export function DeveloperIdentity() {
  return (
    <div className="space-y-6">
      <SkillsSection />
      <CertificationsSection />
      <EducationSection />
    </div>
  );
}
