"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  Loader2, Check, ExternalLink, Info, AlertCircle,
  CheckCircle2, XCircle, ShieldQuestion, ClipboardList, Sparkles,
} from "lucide-react";
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
  { key: "has_photo",           label: "Professional profile photo",  tip: "Profiles with photos get 21× more views." },
  { key: "has_headline",        label: "Compelling headline",         tip: "Use role + value prop, not just job title." },
  { key: "has_about",           label: "About section written",       tip: "First-person story about your work & goals." },
  { key: "has_experience",      label: "Work experience added",       tip: "Include quantified achievements (%, $, ×)." },
  { key: "has_skills",          label: "Skills listed (15+)",         tip: "Skills are used by recruiters to filter candidates." },
  { key: "has_featured",        label: "Featured section active",     tip: "Showcase projects, posts, or a portfolio link." },
  { key: "has_recommendations", label: "At least 1 recommendation",  tip: "Written endorsements build trust." },
  { key: "over_500_connections",label: "500+ connections",            tip: "Shows active networking and social proof." },
];

const EMPTY_CHECKLIST: Checklist = {
  has_photo: false, has_headline: false, has_about: false, has_featured: false,
  has_experience: false, has_skills: false, has_recommendations: false,
  over_500_connections: false,
};

type UrlStatus = "idle" | "checking" | "found" | "not_found" | "private" | "blocked" | "invalid";

function strengthLabel(score: number): { label: string; color: string } {
  if (score <= 2) return { label: "Beginner",     color: "text-red-500 dark:text-red-400" };
  if (score <= 4) return { label: "Intermediate", color: "text-amber-500 dark:text-amber-400" };
  if (score <= 6) return { label: "Strong",       color: "text-blue-500 dark:text-blue-400" };
  return             { label: "All-Star",      color: "text-emerald-500 dark:text-emerald-400" };
}

function UrlStatusBadge({ status }: { status: UrlStatus }) {
  if (status === "idle")     return null;
  if (status === "checking") return (
    <span className="flex items-center gap-1 text-xs text-muted-foreground">
      <Loader2 className="h-3.5 w-3.5 animate-spin" /> Checking…
    </span>
  );
  if (status === "found") return (
    <span className="flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400">
      <CheckCircle2 className="h-3.5 w-3.5" /> Profile found
    </span>
  );
  if (status === "not_found") return (
    <span className="flex items-center gap-1 text-xs text-destructive">
      <XCircle className="h-3.5 w-3.5" /> Profile not found — check the URL
    </span>
  );
  if (status === "private") return (
    <span className="flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400">
      <ShieldQuestion className="h-3.5 w-3.5" /> Profile may be private or requires login
    </span>
  );
  if (status === "blocked") return (
    <span className="flex items-center gap-1 text-xs text-muted-foreground">
      <AlertCircle className="h-3.5 w-3.5" /> Could not verify — LinkedIn may be blocking the check
    </span>
  );
  return null;
}

interface AutoDetected {
  has_photo: boolean;
}

export function LinkedInSection() {
  const [url, setUrl]           = useState("");
  const [checklist, setChecklist] = useState<Checklist>(EMPTY_CHECKLIST);
  const [autoDetected, setAutoDetected] = useState<AutoDetected>({ has_photo: false });
  const [loading, setLoading]   = useState(true);
  const [urlSaving, setUrlSaving] = useState(false);
  const [urlStatus, setUrlStatus] = useState<UrlStatus>("idle");
  const [urlError, setUrlError] = useState<string | null>(null);

  // Auto-save checklist state
  const [checklistSaving, setChecklistSaving] = useState(false);
  const [checklistSaved, setChecklistSaved]   = useState(false);
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedUrlRef = useRef<string>("");  // track last saved URL (to pass alongside checklist auto-save)

  // ── Load saved data + auto-detected signals ────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    fetch("/api/portfolio/linkedin")
      .then((r) => r.ok ? r.json() as Promise<{
        linkedin_url: string | null;
        checklist: Checklist | null;
        auto_detected?: AutoDetected;
      }> : null)
      .then((d) => {
        if (cancelled) return;
        if (d) {
          const savedUrl = d.linkedin_url ?? "";
          setUrl(savedUrl);
          savedUrlRef.current = savedUrl;

          const detected = d.auto_detected ?? { has_photo: false };
          setAutoDetected(detected);

          // Seed checklist: use saved state if it exists, otherwise apply auto-detections.
          // This means the first time a LinkedIn user opens this section, has_photo is
          // pre-ticked if their LinkedIn account has a profile photo.
          const base = d.checklist ?? EMPTY_CHECKLIST;
          const seeded: Checklist = d.checklist
            ? base
            : { ...base, has_photo: detected.has_photo };
          setChecklist(seeded);
        }
        setLoading(false);
      })
      .catch(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  // ── URL helpers ────────────────────────────────────────────────────────────
  const normalizeUrl = (v: string): string => {
    const trimmed = v.trim();
    if (!trimmed) return "";
    if (!trimmed.startsWith("http")) {
      if (trimmed.startsWith("linkedin.com")) return `https://${trimmed}`;
      if (trimmed.startsWith("/in/"))         return `https://linkedin.com${trimmed}`;
      if (!trimmed.includes("/"))             return `https://linkedin.com/in/${trimmed}`;
    }
    return trimmed;
  };

  const LINKEDIN_RE = /^https:\/\/(www\.)?linkedin\.com\/in\/[a-zA-Z0-9_.%-]{3,100}\/?$/;

  const validateUrl = (v: string): boolean => {
    if (!v) { setUrlError(null); return true; }
    const ok = LINKEDIN_RE.test(v);
    setUrlError(ok ? null : "Must be a linkedin.com/in/your-profile URL");
    return ok;
  };

  const verifyUrl = async (v: string) => {
    if (!v || !LINKEDIN_RE.test(v)) return;
    setUrlStatus("checking");
    try {
      const res = await fetch(`/api/portfolio/linkedin/verify?url=${encodeURIComponent(v)}`);
      if (res.ok) {
        const d = await res.json() as { status: UrlStatus };
        setUrlStatus(d.status);
      } else {
        setUrlStatus("blocked");
      }
    } catch {
      setUrlStatus("blocked");
    }
  };

  // ── Save URL ───────────────────────────────────────────────────────────────
  const saveUrl = async () => {
    if (!validateUrl(url)) return;
    setUrlSaving(true);
    const res = await fetch("/api/portfolio/linkedin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ linkedin_url: url || null, checklist }),
    });
    setUrlSaving(false);
    if (res.ok) {
      savedUrlRef.current = url;
      toast.success("LinkedIn URL saved.");
      // Verify after saving
      void verifyUrl(url);
    } else {
      const d = await res.json() as { error?: string };
      toast.error(d.error ?? "Failed to save URL.");
    }
  };

  // ── Auto-save checklist ────────────────────────────────────────────────────
  const persistChecklist = useCallback(async (next: Checklist) => {
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    autoSaveTimerRef.current = setTimeout(async () => {
      setChecklistSaving(true);
      setChecklistSaved(false);
      const res = await fetch("/api/portfolio/linkedin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ linkedin_url: savedUrlRef.current || null, checklist: next }),
      });
      setChecklistSaving(false);
      if (res.ok) {
        setChecklistSaved(true);
        setTimeout(() => setChecklistSaved(false), 2500);
      } else {
        toast.error("Failed to save checklist.");
      }
    }, 600);
  }, []);

  const toggle = (key: keyof Checklist) => {
    setChecklist((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      void persistChecklist(next);
      return next;
    });
  };

  const score = Object.values(checklist).filter(Boolean).length;
  const { label, color } = strengthLabel(score);
  const allChecked = score === CHECKLIST_ITEMS.length;

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
          {/* ── URL ── */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Profile URL
            </label>
            <div className="flex items-center gap-2">
              <input
                type="url"
                placeholder="https://linkedin.com/in/your-username"
                value={url}
                onChange={(e) => {
                  const v = normalizeUrl(e.target.value);
                  setUrl(v);
                  validateUrl(v);
                  setUrlStatus("idle");
                }}
                onBlur={(e) => {
                  const v = normalizeUrl(e.target.value);
                  setUrl(v);
                  if (validateUrl(v) && v) void verifyUrl(v);
                }}
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
              <button
                type="button"
                onClick={() => void saveUrl()}
                disabled={urlSaving || !!urlError}
                className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg bg-[#99462a] dark:bg-[#ccff00] text-white dark:text-black hover:opacity-90 disabled:opacity-50 transition-opacity whitespace-nowrap"
              >
                {urlSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                Save URL
              </button>
            </div>

            {urlError && (
              <p className="flex items-center gap-1 text-xs text-destructive">
                <AlertCircle className="h-3 w-3 shrink-0" /> {urlError}
              </p>
            )}
            <UrlStatusBadge status={urlStatus} />
          </div>

          {/* ── Self-assessment callout ── */}
          <div className="flex items-start gap-3 rounded-xl border border-[#99462a]/20 dark:border-[#ccff00]/20 bg-[#99462a]/5 dark:bg-[#ccff00]/5 px-4 py-3">
            <ClipboardList className="h-4 w-4 text-[#99462a] dark:text-[#ccff00] shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <p className="text-sm font-medium text-foreground">
                Self-assessed checklist
                {autoDetected.has_photo && (
                  <span className="ml-2 inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/50 rounded-full px-2 py-0.5">
                    <Sparkles className="h-2.5 w-2.5" /> 1 auto-detected
                  </span>
                )}
              </p>
              <p className="text-xs text-muted-foreground leading-relaxed">
                {autoDetected.has_photo
                  ? <>Your <strong className="text-foreground">profile photo</strong> was detected from your LinkedIn sign-in. Tick the remaining items you&apos;ve completed on LinkedIn. Changes save automatically.</>
                  : <>LinkedIn doesn&apos;t share profile data publicly. Tick each item <strong className="text-foreground">you&apos;ve already completed</strong> on your LinkedIn profile. Changes save automatically.</>
                }
              </p>
            </div>
          </div>

          {/* ── Strength meter ── */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Profile Strength
              </p>
              <div className="flex items-center gap-2">
                {checklistSaving && (
                  <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                    <Loader2 className="h-3 w-3 animate-spin" /> Saving…
                  </span>
                )}
                {checklistSaved && !checklistSaving && (
                  <span className="flex items-center gap-1 text-[10px] text-emerald-600 dark:text-emerald-400">
                    <Check className="h-3 w-3" /> Saved
                  </span>
                )}
                <span className={cn("text-sm font-semibold", color)}>
                  {score}/8 — {label}
                </span>
              </div>
            </div>

            {/* Progress bar */}
            <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full bg-[#99462a] dark:bg-[#ccff00] transition-all duration-500"
                style={{ width: `${(score / 8) * 100}%` }} /* dynamic runtime value */
              />
            </div>

            {allChecked && (
              <div className="flex items-center gap-2 rounded-lg border border-emerald-200 dark:border-emerald-900/60 bg-emerald-50 dark:bg-emerald-950/20 px-3 py-2 text-xs text-emerald-700 dark:text-emerald-400">
                <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                All-Star profile! Your LinkedIn is fully optimised.
              </div>
            )}

            {/* Checklist */}
            <div className="divide-y divide-border/50">
              {CHECKLIST_ITEMS.map(({ key, label, tip }) => {
                const isAutoDetected = key === "has_photo" && autoDetected.has_photo;
                return (
                  <label
                    key={key}
                    className="flex items-start gap-3 cursor-pointer group py-2.5 px-1 hover:bg-muted/30 rounded-lg transition-colors"
                  >
                    <div className={cn(
                      "mt-0.5 h-5 w-5 shrink-0 rounded-md flex items-center justify-center border-2 transition-all",
                      checklist[key]
                        ? "bg-[#99462a] dark:bg-[#ccff00] border-[#99462a] dark:border-[#ccff00] scale-105"
                        : "border-border bg-background group-hover:border-[#99462a]/50 dark:group-hover:border-[#ccff00]/50"
                    )}>
                      {checklist[key] && (
                        <Check className="h-3 w-3 text-white dark:text-black" strokeWidth={3} />
                      )}
                    </div>
                    <input
                      type="checkbox"
                      className="sr-only"
                      checked={checklist[key]}
                      onChange={() => toggle(key)}
                    />
                    <div className="min-w-0 flex-1">
                      <p className={cn(
                        "text-sm font-medium transition-colors flex items-center gap-2 flex-wrap",
                        checklist[key] ? "text-foreground line-through decoration-muted-foreground/40" : "text-muted-foreground"
                      )}>
                        {label}
                        {isAutoDetected && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide not-italic no-underline text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/50 rounded-full px-1.5 py-0.5">
                            <Sparkles className="h-2.5 w-2.5" /> auto
                          </span>
                        )}
                      </p>
                      <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        {isAutoDetected
                          ? <><Sparkles className="h-3 w-3 shrink-0 text-emerald-500" /> Detected from your LinkedIn sign-in</>
                          : <><Info className="h-3 w-3 shrink-0" /> {tip}</>
                        }
                      </p>
                    </div>
                  </label>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
