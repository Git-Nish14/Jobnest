"use client";

import { useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import {
  ScanSearch, FileText, Upload, ChevronRight, Loader2,
  AlertCircle, CheckCircle2, XCircle, Lightbulb, RotateCcw, Sparkles,
} from "lucide-react";
import { fetchWithRetry, getNetworkErrorMessage } from "@/lib/utils/fetch-retry";
import { Button, Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Textarea } from "@/components/ui";
import { cn } from "@/lib/utils";
import type { ApplicationDocument } from "@/types";
import { MIME_LABELS } from "@/types/application";
import type { ATSProvider } from "@/app/api/documents/ats-scan/route";


interface AtsResult {
  score: number;
  present_keywords: string[];
  missing_keywords: string[];
  suggestions: string[];
  summary: string;
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

function ScoreRing({ score }: { score: number }) {
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
      <span className={cn("text-sm font-semibold", SCORE_TEXT[level])}>{SCORE_LABEL[level]}</span>
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


export function ATSScanner({ initialDocs, configuredProviders }: Props) {
  const searchParams  = useSearchParams();
  const router        = useRouter();
  const preselectedId = searchParams.get("doc_id") ?? "";

  const [selectedDocId,  setSelectedDocId]  = useState(preselectedId);
  const [jobDescription, setJobDescription] = useState("");
  const [scanning,       setScanning]       = useState(false);
  const [result,         setResult]         = useState<AtsResult | null>(null);
  const [error,          setError]          = useState<string | null>(null);
  const [scannedDoc,     setScannedDoc]     = useState<ApplicationDocument | null>(null);
  const [provider,       setProvider]       = useState<ATSProvider>(
    configuredProviders[0] ?? "groq"
  );

  const canScan = !!selectedDocId && jobDescription.trim().length >= 50 && !scanning;

  async function handleScan() {
    if (!canScan) return;
    setScanning(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetchWithRetry("/api/documents/ats-scan", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ document_id: selectedDocId, job_description: jobDescription.trim(), provider }),
      });
      const json = await res.json() as { ats?: AtsResult; error?: string };
      if (!res.ok) throw new Error(json.error ?? "Scan failed");
      if (!json.ats) throw new Error("Invalid response from AI");
      setResult(json.ats);
      setScannedDoc(initialDocs.find((d) => d.id === selectedDocId) ?? null);
    } catch (err) {
      setError(getNetworkErrorMessage(err));
    } finally {
      setScanning(false);
    }
  }

  function handleReset() { setResult(null); setError(null); setScannedDoc(null); }


  if (result) {
    return (
      <div className="space-y-6">
        {/* Toolbar */}
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

        {/* Score + summary */}
        <div className="db-content-card">
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6 sm:gap-8">
            <ScoreRing score={result.score} />
            <div className="flex-1 text-center sm:text-left">
              <h2 className="db-headline text-lg font-semibold text-foreground mb-2">Summary</h2>
              <p className="text-sm text-muted-foreground leading-relaxed">{result.summary}</p>
              {result.score < 70 && (
                <div className="mt-4 flex items-start gap-2 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 px-3.5 py-2.5 text-sm text-amber-800 dark:text-amber-300">
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                  Add the missing keywords below to your resume to significantly improve your ATS pass rate.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Keyword cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="db-content-card space-y-3">
            <div className="flex items-center gap-2">
              <XCircle className="h-4 w-4 text-red-500 shrink-0" />
              <h3 className="font-semibold text-sm text-foreground">Missing keywords ({result.missing_keywords.length})</h3>
            </div>
            <p className="text-xs text-muted-foreground">In the JD but not found in your resume.</p>
            <div className="flex flex-wrap gap-2">
              {result.missing_keywords.length > 0
                ? result.missing_keywords.map((kw) => <KeywordPill key={kw} word={kw} present={false} />)
                : <span className="text-sm text-emerald-600">None — great coverage!</span>
              }
            </div>
          </div>
          <div className="db-content-card space-y-3">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
              <h3 className="font-semibold text-sm text-foreground">Matched keywords ({result.present_keywords.length})</h3>
            </div>
            <p className="text-xs text-muted-foreground">JD keywords that appear in your resume.</p>
            <div className="flex flex-wrap gap-2">
              {result.present_keywords.length > 0
                ? result.present_keywords.map((kw) => <KeywordPill key={kw} word={kw} present={true} />)
                : <span className="text-sm text-muted-foreground">No matches found</span>
              }
            </div>
          </div>
        </div>

        {/* Suggestions */}
        {result.suggestions.length > 0 && (
          <div className="db-content-card space-y-3">
            <div className="flex items-center gap-2">
              <Lightbulb className="h-4 w-4 text-amber-500 shrink-0" />
              <h3 className="font-semibold text-sm text-foreground">Improvement suggestions</h3>
            </div>
            <ul className="space-y-2.5">
              {result.suggestions.map((s, i) => (
                <li key={i} className="flex items-start gap-2.5 text-sm text-muted-foreground">
                  <ChevronRight className="h-4 w-4 shrink-0 mt-0.5 text-[#99462a]/60 dark:text-[#ccff00]/60" />
                  {s}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Continue in NESTAi */}
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
            const missing = result.missing_keywords.slice(0, 8).join(", ");
            const doc = scannedDoc?.label ?? scannedDoc?.original_name ?? "my resume";
            const msg = [
              `My ATS scan scored ${result.score}/100 for ${doc}.`,
              missing ? `The top missing keywords are: ${missing}.` : "",
              result.summary ? `Summary: ${result.summary}` : "",
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

        {initialDocs.length === 0 ? (
          <div className="rounded-xl border-2 border-dashed border-border/50 p-8 text-center space-y-3">
            <Upload className="h-8 w-8 text-muted-foreground/40 mx-auto" />
            <div>
              <p className="text-sm font-medium text-foreground">No documents found</p>
              <p className="text-xs text-muted-foreground mt-1">
                Upload your resume in the{" "}
                <a href="/documents" className="text-[#99462a] dark:text-[#ccff00] hover:underline font-medium">
                  Document Library
                </a>{" "}
                or from any application page.
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <Label htmlFor="doc-select">Resume / CV</Label>
            <Select value={selectedDocId} onValueChange={setSelectedDocId}>
              <SelectTrigger id="doc-select" className="w-full">
                <SelectValue placeholder="Choose a document…" />
              </SelectTrigger>
              <SelectContent>
                {initialDocs.map((doc) => (
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
              {initialDocs.length} document{initialDocs.length !== 1 ? "s" : ""} available.{" "}
              <a href="/documents" className="text-[#99462a] dark:text-[#ccff00] hover:underline">Manage library →</a>
            </p>
          </div>
        )}

        <div className="rounded-xl bg-muted/40 px-4 py-3.5 space-y-2">
          <p className="text-xs font-semibold text-foreground">How it works</p>
          <ol className="space-y-1.5 text-xs text-muted-foreground list-none">
            {[
              "Select your resume and paste the job description",
              "AI extracts keywords from the JD and scans your resume",
              "Get a match score, missing keywords, and targeted suggestions",
            ].map((step, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className="h-4 w-4 rounded-full bg-[#99462a]/15 text-[#99462a] dark:bg-[#ccff00]/15 dark:text-[#ccff00] flex items-center justify-center text-[9px] font-bold shrink-0 mt-0.5">
                  {i + 1}
                </span>
                {step}
              </li>
            ))}
          </ol>
        </div>
      </div>

      {/* Right: JD + provider + scan */}
      <div className="db-content-card space-y-5">
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-lg bg-blue-50 dark:bg-blue-950/40 flex items-center justify-center shrink-0">
            <ScanSearch className="h-4 w-4 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-foreground">Paste the job description</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Copy the full JD from the job posting</p>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="jd-input">Job description</Label>
          <Textarea
            id="jd-input"
            placeholder="Paste the full job description here…"
            rows={10}
            value={jobDescription}
            onChange={(e) => setJobDescription(e.target.value)}
            className="resize-none text-sm"
          />
          <div className="flex items-center justify-between">
            <p className={cn(
              "text-xs transition-colors",
              jobDescription.trim().length < 50 && jobDescription.length > 0 ? "text-amber-600" : "text-muted-foreground"
            )}>
              {jobDescription.trim().length < 50
                ? `${50 - jobDescription.trim().length} more chars needed`
                : `${jobDescription.trim().length.toLocaleString()} characters`}
            </p>
            {jobDescription.length > 0 && (
              <button type="button" onClick={() => setJobDescription("")}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors">
                Clear
              </button>
            )}
          </div>
        </div>

        {error && (
          <div className="flex items-start gap-2 rounded-lg bg-destructive/8 border border-destructive/20 px-3.5 py-2.5 text-sm text-destructive">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" /> {error}
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
    </div>
  );
}
