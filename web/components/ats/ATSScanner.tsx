"use client";

import { useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import {
  ScanSearch, FileText, Upload, ChevronRight, Loader2,
  AlertCircle, CheckCircle2, XCircle, Lightbulb, RotateCcw, Sparkles,
  ShieldCheck, Trophy, AlertTriangle, ListChecks,
  ChevronDown, ChevronUp, Zap,
} from "lucide-react";
import { fetchWithRetry, getNetworkErrorMessage } from "@/lib/utils/fetch-retry";
import { Button, Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Textarea } from "@/components/ui";
import { cn } from "@/lib/utils";
import type { ApplicationDocument } from "@/types";
import { MIME_LABELS } from "@/types/application";
import type { ATSProvider } from "@/app/api/documents/ats-scan/route";
import type { ResumeAuditResult, ResumeCheckpoint, CheckStatus, Severity } from "@/app/api/documents/resume-audit/route";


// ── Existing ATS scan types ───────────────────────────────────────────────────

interface AtsResult {
  score:            number;
  present_keywords: string[];
  missing_keywords: string[];
  suggestions:      string[];
  summary:          string;
}

interface Props {
  initialDocs:         ApplicationDocument[];
  configuredProviders: ATSProvider[];
}

const PROVIDER_META: Record<ATSProvider, { label: string; model: string; color: string }> = {
  groq:       { label: "Groq",       model: "Llama 3.3 70B",    color: "text-orange-600 dark:text-orange-400" },
  openai:     { label: "OpenAI",     model: "GPT-4o mini",      color: "text-emerald-600 dark:text-emerald-400" },
  claude:     { label: "Claude",     model: "Claude Haiku 4.5", color: "text-violet-600 dark:text-violet-400" },
  gemini:     { label: "Gemini",     model: "Gemini 1.5 Flash", color: "text-blue-600 dark:text-blue-400" },
  perplexity: { label: "Perplexity", model: "Sonar Small 128k", color: "text-cyan-600 dark:text-cyan-400" },
};

type ScoreLevel = "strong" | "moderate" | "weak";

function scoreLevel(s: number): ScoreLevel {
  if (s >= 70) return "strong";
  if (s >= 45) return "moderate";
  return "weak";
}

const SCORE_STROKE: Record<ScoreLevel, string> = { strong: "#10b981", moderate: "#f59e0b", weak: "#ef4444" };
const SCORE_TEXT:   Record<ScoreLevel, string> = { strong: "text-emerald-500", moderate: "text-amber-500", weak: "text-red-500" };
const SCORE_LABEL:  Record<ScoreLevel, string> = { strong: "Strong match", moderate: "Moderate match", weak: "Weak match" };

function ScoreRing({ score, label }: { score: number; label?: string }) {
  const size = 120;
  const stroke = 8;
  const r = (size - stroke * 2) / 2;
  const circ = 2 * Math.PI * r;
  const dash = (score / 100) * circ;
  const level = scoreLevel(score);

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative">
        <svg width={size} height={size} className="-rotate-90" aria-hidden="true">
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="currentColor" strokeWidth={stroke} className="text-border/30" />
          <circle cx={size / 2} cy={size / 2} r={r} fill="none"
            stroke={SCORE_STROKE[level]} strokeWidth={stroke} strokeLinecap="round"
            strokeDasharray={`${dash} ${circ}`} className="ats-score-ring-progress" />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={cn("text-3xl font-bold tabular-nums", SCORE_TEXT[level])}>{score}</span>
          <span className="text-[10px] text-muted-foreground font-medium">/ 100</span>
        </div>
      </div>
      <span className={cn("text-sm font-semibold", SCORE_TEXT[level])}>{label ?? SCORE_LABEL[level]}</span>
    </div>
  );
}

function KeywordPill({ word, present }: { word: string; present: boolean }) {
  return (
    <span className={cn(
      "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium",
      present
        ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
        : "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300"
    )}>
      {present ? <CheckCircle2 className="h-3 w-3 shrink-0" /> : <XCircle className="h-3 w-3 shrink-0" />}
      {word}
    </span>
  );
}


// ── FAANG Audit sub-components ────────────────────────────────────────────────

const STATUS_ICON: Record<CheckStatus, React.ReactNode> = {
  pass: <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />,
  warn: <AlertTriangle  className="h-4 w-4 text-amber-500  shrink-0" />,
  fail: <XCircle        className="h-4 w-4 text-red-500    shrink-0" />,
};

const SEVERITY_BADGE: Record<Severity, string> = {
  critical:  "text-[10px] px-1.5 py-0.5 rounded font-bold bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
  important: "text-[10px] px-1.5 py-0.5 rounded font-bold bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  nice:      "text-[10px] px-1.5 py-0.5 rounded font-bold bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
};

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  "Contact & Identity":      <ShieldCheck className="h-4 w-4 text-violet-500" />,
  "Format & ATS Readability":<ListChecks  className="h-4 w-4 text-blue-500"   />,
  "Section Completeness":    <FileText    className="h-4 w-4 text-cyan-500"   />,
  "Content Quality":         <Lightbulb  className="h-4 w-4 text-amber-500"  />,
  "FAANG Impact Signals":    <Trophy     className="h-4 w-4 text-[#99462a]"  />,
  "Technical Keywords":      <Zap        className="h-4 w-4 text-emerald-500"/>,
};

function CheckpointRow({ cp }: { cp: ResumeCheckpoint }) {
  const [open, setOpen] = useState(false);

  return (
    <div className={cn(
      "rounded-lg border text-sm transition-colors",
      cp.status === "pass" ? "border-emerald-200/60 dark:border-emerald-900/40 bg-emerald-50/30 dark:bg-emerald-950/10"
        : cp.status === "warn" ? "border-amber-200/60 dark:border-amber-900/40 bg-amber-50/30 dark:bg-amber-950/10"
        : "border-red-200/60 dark:border-red-900/40 bg-red-50/30 dark:bg-red-950/10",
    )}>
      <button
        type="button"
        className="w-full flex items-center gap-3 px-3 py-2.5 text-left"
        onClick={() => setOpen((o) => !o)}
      >
        {STATUS_ICON[cp.status]}
        <span className={cn(
          "flex-1 font-medium",
          cp.status === "pass" ? "text-foreground" : "text-foreground",
        )}>
          {cp.label}
        </span>
        <span className={SEVERITY_BADGE[cp.severity]}>
          {cp.severity}
        </span>
        {open ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground shrink-0" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
      </button>

      {open && (
        <div className="px-3 pb-3 space-y-2 border-t border-current/10 pt-2.5">
          <p className="text-xs text-muted-foreground leading-relaxed">{cp.detail}</p>
          {cp.status !== "pass" && cp.fix && (
            <div className="flex items-start gap-2 rounded-md bg-background/60 border border-border/40 px-2.5 py-2">
              <Lightbulb className="h-3.5 w-3.5 text-amber-500 shrink-0 mt-0.5" />
              <p className="text-xs text-foreground/80 leading-relaxed">{cp.fix}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function CategoryBlock({ name, cps }: { name: string; cps: ResumeCheckpoint[] }) {
  const pass = cps.filter((c) => c.status === "pass").length;
  const warn = cps.filter((c) => c.status === "warn").length;
  const fail = cps.filter((c) => c.status === "fail").length;
  const pct  = cps.length > 0 ? Math.round((pass / cps.length) * 100) : 0;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2.5">
        {CATEGORY_ICONS[name] ?? <ListChecks className="h-4 w-4 text-muted-foreground" />}
        <span className="font-semibold text-sm text-foreground">{name}</span>
        <div className="flex items-center gap-1.5 ml-auto text-xs">
          {pass > 0 && <span className="text-emerald-600 font-semibold">{pass} ✓</span>}
          {warn > 0 && <span className="text-amber-600 font-semibold">{warn} ⚠</span>}
          {fail > 0 && <span className="text-red-600 font-semibold">{fail} ✗</span>}
        </div>
      </div>
      {/* category progress bar */}
      <div className="h-1.5 rounded-full bg-border/30 overflow-hidden">
        <div
          className={cn(
            "ats-progress-fill h-full rounded-full transition-all",
            pct >= 80 ? "bg-emerald-500" : pct >= 50 ? "bg-amber-500" : "bg-red-500"
          )}
          style={{ "--ats-w": `${pct}%` } as React.CSSProperties}
        />
      </div>
      <div className="space-y-1.5">
        {cps.map((cp) => <CheckpointRow key={cp.id} cp={cp} />)}
      </div>
    </div>
  );
}



// ── Resume + JD picker (shared panel) ─────────────────────────────────────────

function ResumePicker({
  docs, selectedId, onSelect, jobDescription, onJdChange, jdRequired,
}: {
  docs: ApplicationDocument[];
  selectedId: string;
  onSelect: (id: string) => void;
  jobDescription: string;
  onJdChange: (v: string) => void;
  jdRequired?: boolean;
}) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Left: Resume picker */}
      <div className="db-content-card space-y-5">
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-lg bg-[#99462a]/10 dark:bg-[#99462a]/20 flex items-center justify-center shrink-0">
            <FileText className="h-4 w-4 text-[#99462a]" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-foreground">Select your resume</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Pick from your uploaded documents</p>
          </div>
        </div>

        {docs.length === 0 ? (
          <div className="rounded-xl border-2 border-dashed border-border/50 p-8 text-center space-y-3">
            <Upload className="h-8 w-8 text-muted-foreground/40 mx-auto" />
            <div>
              <p className="text-sm font-medium text-foreground">No documents found</p>
              <p className="text-xs text-muted-foreground mt-1">
                Upload your resume in the{" "}
                <a href="/documents" className="text-[#99462a] dark:text-[#ccff00] hover:underline font-medium">
                  Document Library
                </a>
                {" "}or from any application page.
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <Label htmlFor="doc-select-shared">Resume / CV</Label>
            <Select value={selectedId} onValueChange={onSelect}>
              <SelectTrigger id="doc-select-shared" className="w-full">
                <SelectValue placeholder="Choose a document…" />
              </SelectTrigger>
              <SelectContent>
                {docs.map((doc) => (
                  <SelectItem key={doc.id} value={doc.id}>
                    <span className="flex items-center gap-2">
                      <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                      <span className="truncate">{doc.label || doc.original_name || "Untitled"}</span>
                      <span className="text-[10px] text-muted-foreground/60 uppercase shrink-0">
                        {MIME_LABELS[doc.mime_type] ?? doc.mime_type.split("/").pop()}
                      </span>
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {docs.length} document{docs.length !== 1 ? "s" : ""} available.{" "}
              <a href="/documents" className="text-[#99462a] dark:text-[#ccff00] hover:underline">Manage library →</a>
            </p>
          </div>
        )}
      </div>

      {/* Right: JD */}
      <div className="db-content-card space-y-4">
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-lg bg-blue-50 dark:bg-blue-950/40 flex items-center justify-center shrink-0">
            <ScanSearch className="h-4 w-4 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-foreground">
              Job description {!jdRequired && <span className="font-normal text-muted-foreground">(optional)</span>}
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              {jdRequired ? "Required for keyword scoring" : "Improves analysis accuracy significantly"}
            </p>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="jd-shared">Job description</Label>
          <Textarea
            id="jd-shared"
            placeholder="Paste the full job description here…"
            rows={8}
            value={jobDescription}
            onChange={(e) => onJdChange(e.target.value)}
            className="resize-none text-sm"
          />
          <div className="flex items-center justify-between">
            <p className={cn(
              "text-xs transition-colors",
              jdRequired && jobDescription.trim().length < 50 && jobDescription.length > 0
                ? "text-amber-600" : "text-muted-foreground"
            )}>
              {jobDescription.trim().length === 0
                ? "Optional — leave blank to audit resume format & content alone"
                : `${jobDescription.trim().length.toLocaleString()} characters`}
            </p>
            {jobDescription.length > 0 && (
              <button type="button" onClick={() => onJdChange("")}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors">
                Clear
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}


// ── Main component ─────────────────────────────────────────────────────────────

export function ATSScanner({ initialDocs, configuredProviders }: Props) {
  const searchParams  = useSearchParams();
  const router        = useRouter();
  const preselectedId = searchParams.get("doc_id") ?? "";

  // ── shared state ──
  const [mode,          setMode]          = useState<"scan" | "audit">("scan");
  const [selectedDocId, setSelectedDocId] = useState(preselectedId);
  const [jobDescription,setJobDescription]= useState("");

  // ── ATS scan state ──
  const [scanning,   setScanning]   = useState(false);
  const [scanResult, setScanResult] = useState<AtsResult | null>(null);
  const [scanError,  setScanError]  = useState<string | null>(null);
  const [scannedDoc, setScannedDoc] = useState<ApplicationDocument | null>(null);
  const [provider,   setProvider]   = useState<ATSProvider>(configuredProviders[0] ?? "groq");

  // ── FAANG audit state ──
  const [auditing,    setAuditing]    = useState(false);
  const [auditResult, setAuditResult] = useState<ResumeAuditResult | null>(null);
  const [auditError,  setAuditError]  = useState<string | null>(null);
  const [auditedDoc,  setAuditedDoc]  = useState<ApplicationDocument | null>(null);

  const canScan  = !!selectedDocId && jobDescription.trim().length >= 50 && !scanning;
  const canAudit = !!selectedDocId && !auditing;

  // ── handlers ──
  async function handleScan() {
    if (!canScan) return;
    setScanning(true);
    setScanError(null);
    setScanResult(null);
    try {
      const res  = await fetchWithRetry("/api/documents/ats-scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body:   JSON.stringify({ document_id: selectedDocId, job_description: jobDescription.trim(), provider }),
      });
      const json = await res.json() as { ats?: AtsResult; error?: string };
      if (!res.ok) throw new Error(json.error ?? "Scan failed");
      if (!json.ats) throw new Error("Invalid response from AI");
      setScanResult(json.ats);
      setScannedDoc(initialDocs.find((d) => d.id === selectedDocId) ?? null);
    } catch (err) {
      setScanError(getNetworkErrorMessage(err));
    } finally {
      setScanning(false);
    }
  }

  async function handleAudit() {
    if (!canAudit) return;
    setAuditing(true);
    setAuditError(null);
    setAuditResult(null);
    try {
      const body: Record<string, string> = { document_id: selectedDocId };
      if (jobDescription.trim()) body.job_description = jobDescription.trim();
      const res  = await fetchWithRetry("/api/documents/resume-audit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body:   JSON.stringify(body),
      });
      const json = await res.json() as ResumeAuditResult & { error?: string };
      if (!res.ok) throw new Error(json.error ?? "Audit failed");
      setAuditResult(json);
      setAuditedDoc(initialDocs.find((d) => d.id === selectedDocId) ?? null);
    } catch (err) {
      setAuditError(getNetworkErrorMessage(err));
    } finally {
      setAuditing(false);
    }
  }

  function handleReset() {
    setScanResult(null); setScanError(null); setScannedDoc(null);
    setAuditResult(null); setAuditError(null); setAuditedDoc(null);
  }

  // ── mode tab ──
  const ModeTab = ({ m, label, icon: Icon }: { m: "scan" | "audit"; label: string; icon: React.ElementType }) => (
    <button
      type="button"
      onClick={() => { setMode(m); handleReset(); }}
      className={cn(
        "flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold transition-colors border",
        mode === m
          ? "bg-[#99462a] text-white border-[#99462a] dark:bg-[#ccff00] dark:text-black dark:border-[#ccff00]"
          : "bg-background text-muted-foreground border-border hover:text-foreground hover:border-foreground/30",
      )}
    >
      <Icon className="h-3.5 w-3.5 shrink-0" />
      {label}
    </button>
  );

  // ── Resume Audit results view (hiring-agent scoring model) ──────────────────

  if (auditResult) {
    const { talent, checkpoints, top_actions, counts } = auditResult;
    const categories = [...new Set(checkpoints.map((c) => c.category))];

    const readinessColor =
      talent.final_score >= 70 ? "text-emerald-600 dark:text-emerald-400"
        : talent.final_score >= 50 ? "text-amber-600 dark:text-amber-400"
        : "text-red-600 dark:text-red-400";

    // Category score bar (hiring-agent style: scored/max)
    const CategoryBar = ({
      label, score, max, icon, evidence,
    }: { label: string; score: number; max: number; icon: React.ReactNode; evidence: string }) => {
      const [open, setOpen] = useState(false);
      const pct = Math.round((score / max) * 100);
      const color = pct >= 70 ? "bg-emerald-500" : pct >= 40 ? "bg-amber-500" : "bg-red-500";
      const textColor = pct >= 70 ? "text-emerald-600 dark:text-emerald-400"
        : pct >= 40 ? "text-amber-600 dark:text-amber-400"
        : "text-red-600 dark:text-red-400";
      return (
        <div className="space-y-1.5">
          <button
            type="button"
            className="w-full flex items-center gap-2.5 text-sm"
            onClick={() => setOpen(o => !o)}
          >
            <span className="shrink-0">{icon}</span>
            <span className="flex-1 font-semibold text-foreground text-left">{label}</span>
            <span className={cn("tabular-nums font-bold", textColor)}>{score}/{max}</span>
            {open ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground shrink-0" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
          </button>
          <div className="h-2 rounded-full bg-border/30 overflow-hidden">
            <div
              className={cn("ats-progress-fill h-full rounded-full transition-all", color)}
              style={{ "--ats-w": `${pct}%` } as React.CSSProperties}
            />
          </div>
          {open && (
            <p className="text-xs text-muted-foreground leading-relaxed pl-6 pt-0.5 border-l-2 border-border/40 ml-2">
              {evidence}
            </p>
          )}
        </div>
      );
    };

    return (
      <div className="space-y-6">
        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="outline" size="sm" onClick={handleReset}>
            <RotateCcw className="h-3.5 w-3.5 mr-1.5" /> New audit
          </Button>
          {auditedDoc && (
            <span className="text-sm text-muted-foreground flex items-center gap-1.5">
              <FileText className="h-3.5 w-3.5 shrink-0" />
              {auditedDoc.label || auditedDoc.original_name || "Document"}
            </span>
          )}
          <span className="text-xs text-muted-foreground ml-auto">
            {counts.pass} format checks passed · {counts.warn} warnings · {counts.fail} failed
          </span>
        </div>

        {/* Overall score card */}
        <div className="db-content-card">
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6 sm:gap-8">
            <ScoreRing score={talent.normalized} label={`Grade ${talent.grade}`} />
            <div className="flex-1 text-center sm:text-left space-y-2">
              <div>
                <h2 className="db-headline text-lg font-semibold text-foreground">Talent Score</h2>
                <p className={cn("text-base font-semibold mt-0.5", readinessColor)}>{talent.readiness}</p>
              </div>
              {/* Raw breakdown */}
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                <span>Base: <span className="font-semibold text-foreground">{talent.base_total}/100</span></span>
                {talent.bonus_points.total > 0 && (
                  <span className="text-emerald-600 dark:text-emerald-400">
                    +{talent.bonus_points.total} bonus
                  </span>
                )}
                {talent.deductions.total > 0 && (
                  <span className="text-red-500">−{talent.deductions.total} deductions</span>
                )}
                <span>Final: <span className="font-bold text-foreground">{talent.final_score}</span></span>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Scored using the HackerRank hiring-agent rubric: Open Source contributions, Self Projects, Production experience, and Technical Skills — plus bonuses and deductions.
              </p>
              {talent.final_score < 55 && (
                <div className="flex items-start gap-2 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 px-3.5 py-2.5 text-sm text-amber-800 dark:text-amber-300">
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                  Build real-world projects with GitHub links and contribute to open source to significantly improve your score.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 4-category talent scores */}
        <div className="db-content-card space-y-5">
          <div className="flex items-center gap-2">
            <Trophy className="h-4 w-4 text-[#99462a] dark:text-[#ccff00] shrink-0" />
            <h3 className="font-semibold text-sm text-foreground">Talent Scoring Breakdown</h3>
            <span className="text-xs text-muted-foreground ml-auto">click each to see evidence</span>
          </div>

          <CategoryBar
            label="Open Source"
            score={talent.open_source.score}
            max={talent.open_source.max}
            icon={<Zap className="h-4 w-4 text-violet-500" />}
            evidence={talent.open_source.evidence}
          />
          <CategoryBar
            label="Self Projects"
            score={talent.self_projects.score}
            max={talent.self_projects.max}
            icon={<ListChecks className="h-4 w-4 text-blue-500" />}
            evidence={talent.self_projects.evidence}
          />
          <CategoryBar
            label="Production Experience"
            score={talent.production.score}
            max={talent.production.max}
            icon={<Trophy className="h-4 w-4 text-amber-500" />}
            evidence={talent.production.evidence}
          />
          <CategoryBar
            label="Technical Skills"
            score={talent.technical_skills.score}
            max={talent.technical_skills.max}
            icon={<ShieldCheck className="h-4 w-4 text-emerald-500" />}
            evidence={talent.technical_skills.evidence}
          />

          {/* Bonus */}
          {talent.bonus_points.total > 0 && (
            <div className="rounded-lg bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200/60 dark:border-emerald-900/40 px-3.5 py-2.5 space-y-1">
              <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                +{talent.bonus_points.total} bonus points
              </p>
              <p className="text-xs text-emerald-600 dark:text-emerald-500 leading-relaxed">
                {talent.bonus_points.breakdown}
              </p>
            </div>
          )}

          {/* Deductions */}
          {talent.deductions.total > 0 && (
            <div className="rounded-lg bg-red-50 dark:bg-red-950/20 border border-red-200/60 dark:border-red-900/40 px-3.5 py-2.5 space-y-1">
              <p className="text-xs font-semibold text-red-700 dark:text-red-400">
                −{talent.deductions.total} deductions
              </p>
              <p className="text-xs text-red-600 dark:text-red-500 leading-relaxed">
                {talent.deductions.reasons}
              </p>
            </div>
          )}
        </div>

        {/* Key strengths + areas for improvement */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {talent.key_strengths.length > 0 && (
            <div className="db-content-card space-y-3">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                <h3 className="font-semibold text-sm text-foreground">Key strengths</h3>
              </div>
              <ul className="space-y-2">
                {talent.key_strengths.map((s, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 shrink-0 mt-1.5" />
                    {s}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {talent.areas_for_improvement.length > 0 && (
            <div className="db-content-card space-y-3">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />
                <h3 className="font-semibold text-sm text-foreground">Areas for improvement</h3>
              </div>
              <ul className="space-y-2">
                {talent.areas_for_improvement.map((s, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                    <ChevronRight className="h-4 w-4 shrink-0 mt-0.5 text-[#99462a]/60 dark:text-[#ccff00]/60" />
                    {s}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Top priority actions */}
        {top_actions.length > 0 && (
          <div className="db-content-card space-y-3">
            <div className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-[#99462a] dark:text-[#ccff00] shrink-0" />
              <h3 className="font-semibold text-sm text-foreground">Top priority actions</h3>
              <span className="text-xs text-muted-foreground ml-auto">ranked by impact</span>
            </div>
            <ol className="space-y-2">
              {top_actions.map((action, i) => (
                <li key={i} className="flex items-start gap-3 text-sm">
                  <span className="h-5 w-5 rounded-full bg-[#99462a]/15 dark:bg-[#ccff00]/15 text-[#99462a] dark:text-[#ccff00] flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">
                    {i + 1}
                  </span>
                  <span className="text-muted-foreground leading-relaxed">{action}</span>
                </li>
              ))}
            </ol>
          </div>
        )}

        {/* Format checkpoints */}
        {checkpoints.length > 0 && (
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <ListChecks className="h-4 w-4 text-muted-foreground" />
              ATS Format Checks
            </h3>
            {categories.map((cat) => (
              <div key={cat} className="db-content-card space-y-4">
                <CategoryBlock
                  name={cat}
                  cps={checkpoints.filter((c) => c.category === cat)}
                />
              </div>
            ))}
          </div>
        )}

        {/* Continue in NESTAi */}
        <div className="db-content-card flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className="h-10 w-10 rounded-xl bg-violet-50 dark:bg-violet-950/40 flex items-center justify-center shrink-0">
              <Sparkles className="h-5 w-5 text-violet-600 dark:text-violet-400" />
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-sm text-foreground">Fix it with NESTAi</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Let NESTAi rewrite bullets, suggest better projects, and help you close the score gaps.
              </p>
            </div>
          </div>
          <Button variant="outline" size="sm" className="shrink-0 gap-2" onClick={() => {
            const doc  = auditedDoc?.label ?? auditedDoc?.original_name ?? "my resume";
            const impr = talent.areas_for_improvement.map((a, i) => `${i + 1}. ${a}`).join("\n");
            const msg  = [
              `My resume audit scored ${talent.final_score}/100 (Grade ${talent.grade}) for ${doc}.`,
              `Readiness: ${talent.readiness}.`,
              `Open Source: ${talent.open_source.score}/35 · Self Projects: ${talent.self_projects.score}/30 · Production: ${talent.production.score}/25 · Technical Skills: ${talent.technical_skills.score}/10`,
              impr ? `\nAreas for improvement:\n${impr}` : "",
              "\nPlease help me improve my score — focus on the weakest categories and suggest concrete things I can add, build, or rewrite.",
            ].filter(Boolean).join("\n");
            sessionStorage.setItem("nestai_pending_message", msg);
            router.push("/nestai");
          }}>
            <Sparkles className="h-3.5 w-3.5" /> Ask NESTAi
          </Button>
        </div>
      </div>
    );
  }

  // ── ATS scan results view (unchanged) ─────────────────────────────────────

  if (scanResult) {
    return (
      <div className="space-y-6">
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="outline" size="sm" onClick={handleReset}>
            <RotateCcw className="h-3.5 w-3.5 mr-1.5" /> New scan
          </Button>
          {scannedDoc && (
            <span className="text-sm text-muted-foreground flex items-center gap-1.5">
              <FileText className="h-3.5 w-3.5 shrink-0" />
              {scannedDoc.label || scannedDoc.original_name || "Document"}
            </span>
          )}
          <span className={cn("text-xs font-medium ml-auto", PROVIDER_META[provider]?.color ?? "text-muted-foreground")}>
            via {PROVIDER_META[provider]?.label} · {PROVIDER_META[provider]?.model}
          </span>
        </div>

        <div className="db-content-card">
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6 sm:gap-8">
            <ScoreRing score={scanResult.score} />
            <div className="flex-1 text-center sm:text-left">
              <h2 className="db-headline text-lg font-semibold text-foreground mb-2">Summary</h2>
              <p className="text-sm text-muted-foreground leading-relaxed">{scanResult.summary}</p>
              {scanResult.score < 70 && (
                <div className="mt-4 flex items-start gap-2 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 px-3.5 py-2.5 text-sm text-amber-800 dark:text-amber-300">
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                  Add the missing keywords below to your resume to significantly improve your ATS pass rate.
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="db-content-card space-y-3">
            <div className="flex items-center gap-2">
              <XCircle className="h-4 w-4 text-red-500 shrink-0" />
              <h3 className="font-semibold text-sm text-foreground">Missing keywords ({scanResult.missing_keywords.length})</h3>
            </div>
            <p className="text-xs text-muted-foreground">In the JD but not found in your resume.</p>
            <div className="flex flex-wrap gap-2">
              {scanResult.missing_keywords.length > 0
                ? scanResult.missing_keywords.map((kw) => <KeywordPill key={kw} word={kw} present={false} />)
                : <span className="text-sm text-emerald-600">None — great coverage!</span>
              }
            </div>
          </div>
          <div className="db-content-card space-y-3">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
              <h3 className="font-semibold text-sm text-foreground">Matched keywords ({scanResult.present_keywords.length})</h3>
            </div>
            <p className="text-xs text-muted-foreground">JD keywords that appear in your resume.</p>
            <div className="flex flex-wrap gap-2">
              {scanResult.present_keywords.length > 0
                ? scanResult.present_keywords.map((kw) => <KeywordPill key={kw} word={kw} present={true} />)
                : <span className="text-sm text-muted-foreground">No matches found</span>
              }
            </div>
          </div>
        </div>

        {scanResult.suggestions.length > 0 && (
          <div className="db-content-card space-y-3">
            <div className="flex items-center gap-2">
              <Lightbulb className="h-4 w-4 text-amber-500 shrink-0" />
              <h3 className="font-semibold text-sm text-foreground">Improvement suggestions</h3>
            </div>
            <ul className="space-y-2.5">
              {scanResult.suggestions.map((s, i) => (
                <li key={i} className="flex items-start gap-2.5 text-sm text-muted-foreground">
                  <ChevronRight className="h-4 w-4 shrink-0 mt-0.5 text-[#99462a]/60 dark:text-[#ccff00]/60" />
                  {s}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="db-content-card flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className="h-10 w-10 rounded-xl bg-violet-50 dark:bg-violet-950/40 flex items-center justify-center shrink-0">
              <Sparkles className="h-5 w-5 text-violet-600 dark:text-violet-400" />
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-sm text-foreground">Continue with NESTAi</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Ask the AI to rewrite bullet points, add missing keywords, or prep interview answers.
              </p>
            </div>
          </div>
          <Button variant="outline" size="sm" className="shrink-0 gap-2" onClick={() => {
            const missing = scanResult.missing_keywords.slice(0, 8).join(", ");
            const doc     = scannedDoc?.label ?? scannedDoc?.original_name ?? "my resume";
            const msg     = [
              `My ATS scan scored ${scanResult.score}/100 for ${doc}.`,
              missing ? `The top missing keywords are: ${missing}.` : "",
              scanResult.summary ? `Summary: ${scanResult.summary}` : "",
              "",
              "Can you help me rewrite the bullet points in my resume to naturally include these missing keywords without keyword stuffing? Focus on quantified impact.",
            ].filter(Boolean).join("\n");
            sessionStorage.setItem("nestai_pending_message", msg);
            router.push("/nestai");
          }}>
            <Sparkles className="h-3.5 w-3.5" /> Ask NESTAi
          </Button>
        </div>
      </div>
    );
  }

  // ── Input form ─────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Mode tabs */}
      <div className="flex flex-wrap gap-2">
        <ModeTab m="scan"  label="ATS Keyword Scan" icon={ScanSearch}   />
        <ModeTab m="audit" label="NESTpro Audit"      icon={ShieldCheck}  />
      </div>

      {/* Scan-specific info */}
      {mode === "audit" && (
        <div className="rounded-xl bg-muted/40 border border-border/40 px-4 py-3.5 space-y-2">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-[#99462a] shrink-0" />
            <p className="text-xs font-semibold text-foreground">NESTpro Audit — what it checks</p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 text-xs text-muted-foreground">
            {[
              "Contact & identity completeness",
              "Format & ATS parseability",
              "Section completeness",
              "Action verbs & no filler phrases",
              "Quantified metrics & scale signals",
              "System design vocabulary",
              "Programming languages & frameworks",
              "Cloud & DevOps tooling",
              "Open source / community signals",
              "AI qualitative scoring (5 dimensions)",
              "Before → After rewrite examples",
              "JD alignment (if JD provided)",
            ].map((item) => (
              <div key={item} className="flex items-start gap-1.5">
                <CheckCircle2 className="h-3 w-3 text-emerald-500 shrink-0 mt-0.5" />
                {item}
              </div>
            ))}
          </div>
        </div>
      )}

      <ResumePicker
        docs={initialDocs}
        selectedId={selectedDocId}
        onSelect={setSelectedDocId}
        jobDescription={jobDescription}
        onJdChange={setJobDescription}
        jdRequired={mode === "scan"}
      />

      {/* Mode-specific error + action button */}
      {mode === "scan" && (
        <div className="db-content-card space-y-4">
          {scanError && (
            <div className="flex items-start gap-2 rounded-lg bg-destructive/8 border border-destructive/20 px-3.5 py-2.5 text-sm text-destructive">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" /> {scanError}
            </div>
          )}

          {/* Provider selector */}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">AI provider</Label>
            <div className="flex flex-wrap gap-2">
              {(Object.entries(PROVIDER_META) as [ATSProvider, typeof PROVIDER_META[ATSProvider]][]).map(([id, meta]) => {
                const isAvailable = configuredProviders.includes(id);
                return (
                  <button type="button" key={id} disabled={!isAvailable} onClick={() => setProvider(id)}
                    title={isAvailable ? meta.model : `${meta.label} not configured`}
                    className={cn(
                      "rounded-full border px-2.5 py-1 text-xs font-semibold transition-colors",
                      provider === id && isAvailable
                        ? "border-primary bg-primary text-primary-foreground"
                        : isAvailable
                        ? "border-border bg-background text-muted-foreground hover:text-foreground hover:border-foreground/40"
                        : "border-border/30 bg-muted/20 text-muted-foreground/30 cursor-not-allowed"
                    )}>
                    {meta.label}
                  </button>
                );
              })}
            </div>
            {PROVIDER_META[provider] && (
              <p className={cn("text-[11px]", PROVIDER_META[provider].color)}>{PROVIDER_META[provider].model}</p>
            )}
          </div>

          <Button className="w-full" disabled={!canScan} onClick={handleScan}>
            {scanning ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Scanning with {PROVIDER_META[provider]?.label ?? provider}…</>
            ) : (
              <><ScanSearch className="mr-2 h-4 w-4" />Run ATS scan</>
            )}
          </Button>

          {!canScan && !scanning && (
            <p className="text-xs text-center text-muted-foreground">
              {!selectedDocId && "Select a resume "}
              {!selectedDocId && jobDescription.trim().length < 50 && "and "}
              {jobDescription.trim().length < 50 && "add a job description (50+ chars) "}
              to enable the scan.
            </p>
          )}
        </div>
      )}

      {mode === "audit" && (
        <div className="db-content-card space-y-4">
          {auditError && (
            <div className="flex items-start gap-2 rounded-lg bg-destructive/8 border border-destructive/20 px-3.5 py-2.5 text-sm text-destructive">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" /> {auditError}
            </div>
          )}

          <Button className="w-full" disabled={!canAudit} onClick={handleAudit}>
            {auditing ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Running NESTpro audit…</>
            ) : (
              <><ShieldCheck className="mr-2 h-4 w-4" />Run NESTpro Audit</>
            )}
          </Button>

          {!canAudit && !auditing && (
            <p className="text-xs text-center text-muted-foreground">
              Select a resume to run the NESTpro audit.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
