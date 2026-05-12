"use client";

import { useState, useEffect } from "react";
import { Loader2, Check, ExternalLink, Info } from "lucide-react";
import { LinkedinIcon } from "@/components/ui/brand-icons";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Checklist {
  has_photo: boolean;
  has_headline: boolean;
  has_about: boolean;
  has_featured: boolean;
  has_experience: boolean;
  has_skills: boolean;
  has_recommendations: boolean;
  over_500_connections: boolean;
}

const CHECKLIST_ITEMS: { key: keyof Checklist; label: string; tip: string }[] = [
  { key: "has_photo", label: "Professional profile photo", tip: "Profiles with photos get 21× more views." },
  { key: "has_headline", label: "Compelling headline", tip: "Use role + value prop, not just job title." },
  { key: "has_about", label: "About section written", tip: "First-person story about your work & goals." },
  { key: "has_experience", label: "Work experience added", tip: "Include quantified achievements (%, $, ×)." },
  { key: "has_skills", label: "Skills listed (15+)", tip: "Skills are used by recruiters to filter candidates." },
  { key: "has_featured", label: "Featured section active", tip: "Showcase projects, posts, or a portfolio link." },
  { key: "has_recommendations", label: "At least 1 recommendation", tip: "Written endorsements build trust." },
  { key: "over_500_connections", label: "500+ connections", tip: "Shows active networking and social proof." },
];

const EMPTY_CHECKLIST: Checklist = {
  has_photo: false, has_headline: false, has_about: false, has_featured: false,
  has_experience: false, has_skills: false, has_recommendations: false,
  over_500_connections: false,
};

function strengthLabel(score: number): { label: string; color: string } {
  if (score <= 2) return { label: "Beginner", color: "text-red-500 dark:text-red-400" };
  if (score <= 4) return { label: "Intermediate", color: "text-amber-500 dark:text-amber-400" };
  if (score <= 6) return { label: "Strong", color: "text-blue-500 dark:text-blue-400" };
  return { label: "All-Star", color: "text-emerald-500 dark:text-emerald-400" };
}

export function LinkedInSection() {
  const [url, setUrl] = useState("");
  const [checklist, setChecklist] = useState<Checklist>(EMPTY_CHECKLIST);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [urlError, setUrlError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/portfolio/linkedin")
      .then((r) => r.ok ? r.json() as Promise<{ linkedin_url: string | null; checklist: Checklist | null }> : null)
      .then((d) => {
        if (cancelled) return;
        if (d) {
          setUrl(d.linkedin_url ?? "");
          setChecklist(d.checklist ?? EMPTY_CHECKLIST);
        }
        setLoading(false);
      })
      .catch(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const validateUrl = (v: string) => {
    if (!v) { setUrlError(null); return; }
    const ok = /^https:\/\/(www\.)?linkedin\.com\/in\/[a-zA-Z0-9_.%-]{3,100}\/?$/.test(v);
    setUrlError(ok ? null : "Must be a linkedin.com/in/… URL");
  };

  const save = async () => {
    if (urlError) return;
    setSaving(true);
    const res = await fetch("/api/portfolio/linkedin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ linkedin_url: url || null, checklist }),
    });
    setSaving(false);
    if (res.ok) {
      toast.success("LinkedIn profile saved.");
    } else {
      const d = await res.json() as { error?: string };
      toast.error(d.error ?? "Failed to save.");
    }
  };

  const toggle = (key: keyof Checklist) => {
    setChecklist((c) => ({ ...c, [key]: !c[key] }));
  };

  const score = Object.values(checklist).filter(Boolean).length;
  const { label, color } = strengthLabel(score);

  return (
    <div className="db-content-card space-y-5">
      <h2 className="db-headline text-lg font-semibold text-foreground flex items-center gap-2">
        <LinkedinIcon className="h-5 w-5 text-[#99462a] dark:text-[#ccff00]" /> LinkedIn Profile
      </h2>

      {loading ? (
        <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading…
        </div>
      ) : (
        <>
          {/* URL input */}
          <div className="space-y-1">
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Profile URL
            </label>
            <div className="flex items-center gap-2">
              <input
                type="url"
                placeholder="https://linkedin.com/in/your-username"
                value={url}
                onChange={(e) => { setUrl(e.target.value); validateUrl(e.target.value); }}
                className={cn(
                  "flex-1 rounded-lg border bg-muted/30 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#99462a]",
                  urlError ? "border-destructive" : "border-border"
                )}
              />
              {url && !urlError && (
                <a
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-2 rounded-lg border border-border hover:bg-muted/50 transition-colors text-muted-foreground hover:text-foreground"
                  aria-label="Open LinkedIn profile"
                >
                  <ExternalLink className="h-4 w-4" />
                </a>
              )}
            </div>
            {urlError && <p className="text-xs text-destructive">{urlError}</p>}
          </div>

          {/* Strength meter */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Profile Strength
              </p>
              <span className={cn("text-sm font-semibold", color)}>
                {score}/8 — {label}
              </span>
            </div>

            {/* Progress bar */}
            <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full bg-[#99462a] dark:bg-[#ccff00] transition-all duration-300"
                style={{ width: `${(score / 8) * 100}%` }}
              />
            </div>

            {/* Checklist */}
            <div className="space-y-2">
              {CHECKLIST_ITEMS.map(({ key, label, tip }) => (
                <label
                  key={key}
                  className="flex items-start gap-3 cursor-pointer group rounded-lg px-2 py-1.5 hover:bg-muted/40 transition-colors"
                >
                  <div className={cn(
                    "mt-0.5 h-4 w-4 shrink-0 rounded flex items-center justify-center border transition-colors",
                    checklist[key]
                      ? "bg-[#99462a] dark:bg-[#ccff00] border-[#99462a] dark:border-[#ccff00]"
                      : "border-border bg-background"
                  )}>
                    {checklist[key] && (
                      <Check className="h-2.5 w-2.5 text-white dark:text-black" strokeWidth={3} />
                    )}
                  </div>
                  <input
                    type="checkbox"
                    className="sr-only"
                    checked={checklist[key]}
                    onChange={() => toggle(key)}
                  />
                  <div className="min-w-0">
                    <p className={cn("text-sm", checklist[key] ? "text-foreground" : "text-muted-foreground")}>
                      {label}
                    </p>
                    <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Info className="h-3 w-3 shrink-0" /> {tip}
                    </p>
                  </div>
                </label>
              ))}
            </div>
          </div>

          <button
            type="button"
            onClick={() => void save()}
            disabled={saving || !!urlError}
            className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg bg-[#99462a] dark:bg-[#ccff00] text-white dark:text-black hover:opacity-90 disabled:opacity-50 transition-opacity"
          >
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
            Save LinkedIn profile
          </button>
        </>
      )}
    </div>
  );
}
