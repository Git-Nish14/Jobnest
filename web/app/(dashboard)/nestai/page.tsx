"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import {
  Send, Sparkles, Loader2, Trash2, Plus, PanelLeftClose, PanelLeft,
  MoreHorizontal, Pencil, X, Check, BrainCircuit, TrendingUp, Calendar,
  Bell, Building2, Target, MessageSquare, Zap, Copy, CheckCheck,
  Square, Pin, PinOff, Paperclip, Mail, FileDown, ShieldCheck, FileText,
} from "lucide-react";
import { Button, Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { fetchWithRetry } from "@/lib/utils/fetch-retry";
import { formatTime } from "@/lib/utils/date";
import { createClient } from "@/lib/supabase/client";

interface MessageAttachment {
  name: string;
  fileType: string; // 'pdf' | 'docx' | 'doc' | 'txt' | 'md' | image type
  preview?: string; // first 3000 chars of extracted text
  storagePath?: string; // Supabase Storage path for binary preview/download
}

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  attachment?: MessageAttachment;
  suggestions?: string[];
  isStreaming?: boolean;
}

interface ChatSession {
  id: string;
  title: string;
  is_pinned: boolean;
  created_at: string;
  updated_at: string;
}

interface AttachedFile {
  name: string;
  text: string | null;
  loading: boolean;
  error?: string;
  storagePath?: string | null;
}

const MAX_REQUESTS = 5;
const WINDOW_MS = 60_000;
const FOLLOW_UPS_MARKER = "\nFOLLOW_UPS:";

// Module-level constant — not inside the component so it isn't recreated on every render
const IMAGE_EXTS = new Set(["jpg", "jpeg", "png", "gif", "webp", "heic", "heif", "avif", "bmp", "tiff"]);

function parseFollowUps(fullText: string): { content: string; suggestions: string[] } {
  const idx = fullText.lastIndexOf(FOLLOW_UPS_MARKER);
  if (idx === -1) return { content: fullText, suggestions: [] };
  const content = fullText.slice(0, idx).trimEnd();
  const suggestionsLine = fullText.slice(idx + FOLLOW_UPS_MARKER.length).trim();
  const suggestions = suggestionsLine
    .split("|")
    .map((s) => s.replace(/^\[|\]$/g, "").trim())
    .filter(Boolean)
    .slice(0, 3);
  return { content, suggestions };
}

const SUGGESTED_PROMPTS = [
  { icon: TrendingUp, label: "Application stats", prompt: "How many applications have I submitted this month?" },
  { icon: Target, label: "Success rate", prompt: "What's my overall application success rate?" },
  { icon: Building2, label: "Pending responses", prompt: "Which companies haven't responded yet?" },
  { icon: Calendar, label: "Upcoming interviews", prompt: "Do I have any upcoming interviews?" },
  { icon: Bell, label: "My reminders", prompt: "What are my pending reminders?" },
  { icon: BrainCircuit, label: "Progress summary", prompt: "Summarize my job search progress" },
];

function RateLimitCounter({
  remaining, max, resetCountdown, isRateLimited,
}: {
  remaining: number; max: number; resetCountdown: number | null; isRateLimited: boolean;
}) {
  const pips = Array.from({ length: max });
  const windowActive = resetCountdown !== null;

  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-full border px-2.5 py-1 text-xs transition-colors select-none",
        isRateLimited
          ? "border-destructive/30 bg-destructive/8 text-destructive"
          : remaining <= 1 && windowActive
          ? "border-amber-300/60 bg-amber-50 text-amber-700"
          : windowActive
          ? "border-[#dbc1b9]/60 bg-[#f4f3f1] text-[#55433d]"
          : "border-transparent text-[#55433d]/50"
      )}
      title={`${remaining} of ${max} requests remaining.`}
    >
      <div className="flex items-center gap-0.5">
        {pips.map((_, i) => (
          <span
            key={i}
            className={cn(
              "h-1.5 w-1.5 rounded-full transition-all duration-300",
              i < remaining
                ? isRateLimited ? "bg-destructive/50" : remaining <= 1 ? "bg-amber-400" : "bg-[#99462a]/60"
                : "bg-muted-foreground/20"
            )}
          />
        ))}
      </div>
      <span className="tabular-nums font-medium leading-none">
        {isRateLimited ? (
          <span className="flex items-center gap-1"><Zap className="h-3 w-3" />{resetCountdown}s</span>
        ) : windowActive ? (
          <>{remaining}/{max}{resetCountdown !== null && <span className="ml-1 opacity-50">· {resetCountdown}s</span>}</>
        ) : (
          <>{max}/{max}</>
        )}
      </span>
    </div>
  );
}

function AssistantAvatar({ thinking = false }: { thinking?: boolean }) {
  return (
    <div className="relative shrink-0 mt-0.5">
      {thinking && (
        <span className="absolute inset-0 rounded-full animate-ping bg-[#99462a]/25" aria-hidden="true" />
      )}
      <div className="h-7 w-7 rounded-full flex items-center justify-center atelier-avatar relative">
        <Sparkles className="h-3.5 w-3.5 text-white" />
      </div>
    </div>
  );
}

// ── Thinking indicator — shown while waiting for the first streaming token ───
function ThinkingIndicator() {
  return (
    <div className="flex items-center gap-2.5 px-4 py-3 rounded-2xl rounded-tl-sm bg-[#f4f3f1] w-fit">
      <div className="flex items-center gap-1.5" aria-label="NESTAi is thinking">
        <span className="h-2 w-2 rounded-full bg-[#99462a] animate-pulse [animation-delay:0ms]" />
        <span className="h-2 w-2 rounded-full bg-[#99462a] animate-pulse [animation-delay:200ms]" />
        <span className="h-2 w-2 rounded-full bg-[#99462a] animate-pulse [animation-delay:400ms]" />
      </div>
      <span className="text-xs text-[#55433d] opacity-50 font-semibold tracking-wide select-none">
        Thinking…
      </span>
    </div>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button
      type="button"
      onClick={copy}
      className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground"
      title="Copy"
    >
      {copied ? <CheckCheck className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
    </button>
  );
}

const FILE_TYPE_META: Record<string, { label: string; bg: string; text: string; border: string }> = {
  pdf:  { label: "PDF",  bg: "bg-red-50",    text: "text-red-700",    border: "border-red-200" },
  docx: { label: "DOCX", bg: "bg-blue-50",   text: "text-blue-700",   border: "border-blue-200" },
  doc:  { label: "DOC",  bg: "bg-blue-50",   text: "text-blue-700",   border: "border-blue-200" },
  txt:  { label: "TXT",  bg: "bg-zinc-50",   text: "text-zinc-600",   border: "border-zinc-200" },
  md:   { label: "MD",   bg: "bg-purple-50", text: "text-purple-700", border: "border-purple-200" },
  // Image types
  jpg:  { label: "JPG",  bg: "bg-green-50",  text: "text-green-700",  border: "border-green-200" },
  jpeg: { label: "JPG",  bg: "bg-green-50",  text: "text-green-700",  border: "border-green-200" },
  png:  { label: "PNG",  bg: "bg-green-50",  text: "text-green-700",  border: "border-green-200" },
  gif:  { label: "GIF",  bg: "bg-green-50",  text: "text-green-700",  border: "border-green-200" },
  webp: { label: "WEBP", bg: "bg-green-50",  text: "text-green-700",  border: "border-green-200" },
  heic: { label: "HEIC", bg: "bg-green-50",  text: "text-green-700",  border: "border-green-200" },
  heif: { label: "HEIF", bg: "bg-green-50",  text: "text-green-700",  border: "border-green-200" },
};

function FileAttachmentCard({ attachment, onView }: { attachment: MessageAttachment; onView?: () => void }) {
  const meta = FILE_TYPE_META[attachment.fileType.toLowerCase()] ?? {
    label: attachment.fileType.toUpperCase(),
    bg: "bg-muted", text: "text-muted-foreground", border: "border-border",
  };

  // Trim extension from display name for cleanliness
  const displayName = attachment.name.replace(/\.[^.]+$/, "");

  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-xl border px-3.5 py-2.5 mb-2 w-fit max-w-[280px] transition-all",
        meta.bg, meta.border,
        onView && "cursor-pointer hover:shadow-sm hover:brightness-95 select-none"
      )}
      onClick={onView}
      title={onView ? "Click to view document" : undefined}
      tabIndex={onView ? 0 : undefined}
      onKeyDown={onView ? (e) => { if (e.key === "Enter" || e.key === " ") onView(); } : undefined}
    >
      <div className={cn("flex h-9 w-7 shrink-0 flex-col items-center justify-between rounded-md border py-1", meta.border, "bg-white/70")}>
        <div className={cn("text-[7px] font-bold tracking-tight leading-none mt-0.5", meta.text)}>{meta.label}</div>
        <div className="flex gap-px mb-0.5">
          {[...Array(3)].map((_, i) => (
            <span key={i} className={cn("h-px w-3 rounded-full", meta.text, "opacity-30")} />
          ))}
        </div>
      </div>
      <div className="min-w-0">
        <p className={cn("text-xs font-semibold truncate leading-tight", meta.text)}>{displayName}</p>
        <p className={cn("text-[11px] mt-0.5 opacity-70", meta.text)}>{attachment.name.split(".").pop()?.toUpperCase()} document</p>
      </div>
    </div>
  );
}

type InlineNode = string | React.ReactElement;

function parseInline(text: string): InlineNode[] {
  const result: InlineNode[] = [];
  // Order matters: bold before italic, inline code before both
  const regex = /(`[^`]+`|\*\*[^*\n]+\*\*|__[^_\n]+__|(?<!\*)\*(?!\*)([^*\n]+)(?<!\*)\*(?!\*))/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) result.push(text.slice(lastIndex, match.index));
    const token = match[0];
    if (token.startsWith("`")) {
      result.push(
        <code key={match.index} className="bg-muted rounded px-1.5 py-0.5 text-[0.8em] font-mono text-foreground border">
          {token.slice(1, -1)}
        </code>
      );
    } else if (token.startsWith("**") || token.startsWith("__")) {
      result.push(<strong key={match.index} className="font-semibold text-foreground">{token.slice(2, -2)}</strong>);
    } else if (token.startsWith("*")) {
      result.push(<em key={match.index} className="italic">{token.slice(1, -1)}</em>);
    }
    lastIndex = match.index + token.length;
  }
  if (lastIndex < text.length) result.push(text.slice(lastIndex));
  return result;
}

function MarkdownRenderer({ content, isStreaming }: { content: string; isStreaming?: boolean }) {
  // Split on fenced code blocks first so they're never processed as inline markdown
  const segments = content.split(/(```[\s\S]*?```|```[\s\S]*$)/g);
  const elements: React.ReactNode[] = [];
  let key = 0;

  for (const segment of segments) {
    if (segment.startsWith("```")) {
      const lines = segment.split("\n");
      const lang = lines[0].replace("```", "").trim();
      const isComplete = segment.endsWith("```") && segment.length > 3;
      const codeLines = isComplete ? lines.slice(1, -1) : lines.slice(1);
      const code = codeLines.join("\n");
      elements.push(
        <div key={key++} className="my-2 rounded-xl overflow-hidden border border-border/60 bg-zinc-950">
          {lang && (
            <div className="flex items-center justify-between px-4 py-1.5 bg-zinc-900/80 border-b border-zinc-800">
              <span className="text-[11px] text-zinc-400 font-mono">{lang}</span>
            </div>
          )}
          <pre className="p-4 overflow-x-auto text-[0.8em] leading-relaxed">
            <code className="text-zinc-100 font-mono">{code}</code>
          </pre>
        </div>
      );
    } else {
      // Process line-by-line
      const lines = segment.split("\n");
      let i = 0;

      while (i < lines.length) {
        const line = lines[i];

        if (!line.trim()) { i++; continue; }

        // Horizontal rule
        if (/^(-{3,}|\*{3,}|_{3,})$/.test(line.trim())) {
          elements.push(<hr key={key++} className="my-3 border-border/60" />);
          i++; continue;
        }

        // Headers
        if (line.startsWith("### ")) {
          elements.push(<h3 key={key++} className="text-sm font-semibold mt-4 mb-1 text-foreground">{parseInline(line.slice(4))}</h3>);
          i++; continue;
        }
        if (line.startsWith("## ")) {
          elements.push(<h2 key={key++} className="text-sm font-bold mt-5 mb-1.5 text-foreground">{parseInline(line.slice(3))}</h2>);
          i++; continue;
        }
        if (line.startsWith("# ")) {
          elements.push(<h1 key={key++} className="text-base font-bold mt-5 mb-2 text-foreground">{parseInline(line.slice(2))}</h1>);
          i++; continue;
        }

        // Blockquote
        if (line.startsWith("> ")) {
          elements.push(
            <blockquote key={key++} className="border-l-2 border-primary/50 pl-3 text-muted-foreground italic text-sm md:text-base my-1">
              {parseInline(line.slice(2))}
            </blockquote>
          );
          i++; continue;
        }

        // Bullet list — collect consecutive items
        if (/^[-*•] /.test(line)) {
          const items: React.ReactNode[] = [];
          while (i < lines.length && /^[-*•] /.test(lines[i])) {
            items.push(<li key={i} className="leading-relaxed">{parseInline(lines[i].replace(/^[-*•] /, ""))}</li>);
            i++;
          }
          elements.push(
            <ul key={key++} className="list-disc list-outside ml-5 space-y-0.5 my-1.5 text-sm md:text-base">
              {items}
            </ul>
          );
          continue;
        }

        // Numbered list
        if (/^\d+\. /.test(line)) {
          const items: React.ReactNode[] = [];
          while (i < lines.length && /^\d+\. /.test(lines[i])) {
            items.push(<li key={i} className="leading-relaxed">{parseInline(lines[i].replace(/^\d+\. /, ""))}</li>);
            i++;
          }
          elements.push(
            <ol key={key++} className="list-decimal list-outside ml-5 space-y-0.5 my-1.5 text-sm md:text-base">
              {items}
            </ol>
          );
          continue;
        }

        // Regular paragraph
        elements.push(
          <p key={key++} className="text-sm md:text-base leading-relaxed text-foreground break-words">
            {parseInline(line)}
          </p>
        );
        i++;
      }
    }
  }

  return (
    <div className="space-y-1">
      {elements}
      {isStreaming && (
        <span className="inline-block w-0.5 h-[1.1em] bg-[#99462a]/70 align-text-bottom animate-pulse ml-0.5" />
      )}
    </div>
  );
}

// ── Chat attachment preview modal ─────────────────────────────────────────────
// Binary-only viewer — shows the exact file, nothing processed.
// PDF  → blob URL iframe (CSP-safe)
// Image → <img> with signed URL
// TXT/MD → raw text fetched from storage
// DOCX/DOC → "Open in browser" (cannot be rendered natively)
// No storagePath → "File not available" with clean empty state
function ChatAttachmentPreview({
  attachment,
  onClose,
}: {
  attachment: MessageAttachment;
  onClose: () => void;
}) {
  const ft = attachment.fileType.toLowerCase();
  const isPDF  = ft === "pdf";
  const isImg  = IMAGE_EXTS.has(ft);
  const isText = ft === "txt" || ft === "md";
  // Fetch signed URL for any stored file type
  const hasStorage = !!attachment.storagePath;

  const [signedUrl, setSignedUrl]   = useState<string | null>(null);
  const [blobUrl, setBlobUrl]       = useState<string | null>(null);
  const [rawText, setRawText]       = useState<string | null>(null);
  const [fileError, setFileError]   = useState<string | null>(null);
  const [loading, setLoading]       = useState(hasStorage);

  useEffect(() => {
    if (!hasStorage) return;
    let cancelled = false;
    let objectUrl: string | null = null;

    const run = async () => {
      try {
        // Step 1 — get signed URL
        const r = await fetch(
          `/api/nesta-ai/attachment-url?path=${encodeURIComponent(attachment.storagePath!)}`
        );
        const d: { signedUrl?: string } = await r.json();
        if (cancelled) return;

        const sUrl = d.signedUrl ?? null;
        setSignedUrl(sUrl);
        if (!sUrl) { setFileError("Could not generate a preview link."); return; }

        // Step 2 — type-specific fetch
        if (isPDF) {
          // Fetch as blob: URL — Supabase signed URLs blocked by CSP as direct iframe src
          const res = await fetch(sUrl);
          if (cancelled) return;
          if (res.ok) {
            const blob = await res.blob();
            objectUrl = URL.createObjectURL(blob); // no suffix — show full native PDF viewer
            setBlobUrl(objectUrl);
          } else {
            setFileError("Could not load PDF. Use the Open button above to view it.");
          }
        } else if (isText) {
          // Fetch raw text — show the exact file contents, no processing
          const res = await fetch(sUrl);
          if (cancelled) return;
          if (res.ok) {
            setRawText(await res.text());
          } else {
            setFileError("Could not load file text.");
          }
        }
        // Images and DOCX/DOC: signedUrl alone is enough (img src or Open button)
      } catch {
        if (!cancelled) setFileError("Could not load the file. Try again or use the Open button.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void run();
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl.split("#")[0]);
    };
  }, [attachment.storagePath, hasStorage, isPDF, isText]);

  const meta = FILE_TYPE_META[ft] ?? {
    label: attachment.fileType.toUpperCase(),
    bg: "bg-[#f4f3f1]", text: "text-[#55433d]", border: "border-[#dbc1b9]/40",
  };

  // Icon for non-previewable types
  function OpenInBrowserState({ label }: { label: string }) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-5 text-center px-8">
        <div className={cn("w-16 h-16 rounded-2xl flex items-center justify-center", meta.bg)}>
          <Paperclip className={cn("w-8 h-8", meta.text)} aria-hidden="true" />
        </div>
        <div>
          <p className="font-semibold text-sm text-[#1a1c1b] mb-1">{attachment.name}</p>
          <p className="text-xs text-[#55433d] opacity-60 mb-4">{label}</p>
          {signedUrl && (
            <a
              href={signedUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="db-btn-page-secondary inline-flex items-center gap-2 text-xs"
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                <polyline points="15 3 21 3 21 9"/>
                <line x1="10" y1="14" x2="21" y2="3"/>
              </svg>
              Open in browser
            </a>
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      className="nestai-preview-backdrop fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6"
      onClick={onClose}
    >
      <div
        className="nestai-preview-modal w-full max-w-5xl h-[95vh] flex flex-col rounded-2xl overflow-hidden shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Header — identical layout to DocPreviewDialog ── */}
        <div className="nestai-preview-header flex items-center gap-3 px-5 py-3.5 shrink-0">
          {/* File icon */}
          <div className={cn(
            "h-8 w-8 rounded-lg flex items-center justify-center shrink-0",
            meta.bg,
          )}>
            <span className={cn("text-[9px] font-bold leading-none", meta.text)}>{meta.label}</span>
          </div>

          {/* Name */}
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm text-[#1a1c1b] truncate">{attachment.name}</p>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1 shrink-0 mr-1">
            {signedUrl && (
              <a
                href={signedUrl}
                download={attachment.name}
                title="Download"
                onClick={(e) => e.stopPropagation()}
                className="inline-flex items-center justify-center h-8 w-8 rounded-lg text-[#55433d] hover:bg-[#e9e8e6] transition-colors"
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                  <polyline points="7 10 12 15 17 10"/>
                  <line x1="12" y1="15" x2="12" y2="3"/>
                </svg>
                <span className="sr-only">Download</span>
              </a>
            )}
            {signedUrl && (
              <a
                href={signedUrl}
                target="_blank"
                rel="noopener noreferrer"
                title="Open in new tab"
                onClick={(e) => e.stopPropagation()}
                className="inline-flex items-center justify-center h-8 w-8 rounded-lg text-[#55433d] hover:bg-[#e9e8e6] transition-colors"
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                  <polyline points="15 3 21 3 21 9"/>
                  <line x1="10" y1="14" x2="21" y2="3"/>
                </svg>
                <span className="sr-only">Open in new tab</span>
              </a>
            )}
            <button
              type="button"
              onClick={onClose}
              aria-label="Close preview"
              className="inline-flex items-center justify-center h-8 w-8 rounded-lg text-[#55433d] hover:bg-[#e9e8e6] transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* ── Body ── */}
        <div className="flex-1 overflow-hidden min-h-0">

          {/* Loading */}
          {loading && (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="h-6 w-6 animate-spin text-[#55433d] opacity-40" />
            </div>
          )}

          {/* PDF — blob URL iframe (CSP-safe, identical to /documents viewer) */}
          {!loading && isPDF && blobUrl && (
            <iframe
              src={blobUrl}
              title={attachment.name}
              className="nestai-preview-pdf"
            />
          )}

          {/* PDF — blob failed but signedUrl exists → Open in browser */}
          {!loading && isPDF && !blobUrl && signedUrl && (
            <OpenInBrowserState label={fileError ?? "Could not embed this PDF inline."} />
          )}

          {/* Image — from Supabase Storage */}
          {!loading && isImg && signedUrl && (
            <div className="nestai-preview-img-bg flex items-center justify-center h-full p-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={signedUrl}
                alt={attachment.name}
                className="max-h-full max-w-full object-contain rounded-lg"
              />
            </div>
          )}

          {/* TXT / MD — exact file bytes fetched from storage */}
          {!loading && isText && rawText !== null && (
            <div className="overflow-y-auto h-full bg-white dark:bg-[#0f0f0f]">
              <pre className="px-6 py-6 text-sm leading-relaxed whitespace-pre-wrap break-words text-[#1a1c1b] font-mono max-w-4xl">
                {rawText}
              </pre>
            </div>
          )}

          {/* DOCX / DOC — cannot render natively */}
          {!loading && (ft === "docx" || ft === "doc") && signedUrl && (
            <OpenInBrowserState label="Word documents cannot be previewed inline." />
          )}

          {/* No binary available — file was attached before storage upload was enforced */}
          {!loading && !blobUrl && !signedUrl && !rawText && (
            <div className="flex flex-col items-center justify-center h-64 gap-4 text-center px-8">
              <Paperclip className="h-12 w-12 text-[#55433d] opacity-20" />
              <div>
                <p className="text-sm font-medium text-[#1a1c1b]">{attachment.name}</p>
                <p className="text-xs text-[#55433d] opacity-50 mt-1">
                  Preview not available for this file.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Module-level constant — not inside the component to avoid re-creation on every render.
const EMAIL_CATEGORIES = ["Follow Up", "Thank You", "Cold Outreach", "Networking", "Referral Request", "Offer Negotiation", "Withdrawal"] as const;

/** Exported for unit testing.
 *  Builds the Groq prompt for the email draft assistant.
 *  Sanitizes contact fields to prevent newline-based prompt injection.
 *  Validates category against the allowed list before interpolation. */
export function buildEmailPrompt(
  category: string,
  contactName?: string | null,
  contactTitle?: string | null
): string {
  // Strip newlines — primary prompt-injection vector
  const safeName  = contactName?.replace(/[\r\n]+/g, " ").trim() ?? "";
  const safeTitle = contactTitle?.replace(/[\r\n]+/g, " ").trim() ?? "";
  // Runtime category guard — falls back if state was tampered
  const safeCategory = (EMAIL_CATEGORIES as readonly string[]).includes(category)
    ? category : "Follow Up";

  const contactLine = safeName
    ? `The recipient is ${safeName}${safeTitle ? ` (${safeTitle})` : ""}.`
    : "There is no specific recipient — write a reusable template.";

  return `I need a professional "${safeCategory}" email for a job search context.\n\n${contactLine}\n\nPlease draft a concise, warm, professional email (3–4 short paragraphs). Use placeholders like [Company] or [Position] where I should fill in specifics. I'll review and personalise before sending.`;
}

export default function NestAiPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [remaining, setRemaining] = useState<number>(MAX_REQUESTS);
  const [windowEndAt, setWindowEndAt] = useState<number | null>(null);
  const [resetCountdown, setResetCountdown] = useState<number | null>(null);
  const [isRateLimited, setIsRateLimited] = useState(false);
  const [isDegraded, setIsDegraded] = useState(false);

  // ── Interview Prep modal ──────────────────────────────────────────────────
  const [prepModalOpen, setPrepModalOpen] = useState(false);
  const [prepApps, setPrepApps] = useState<{ id: string; company: string; position: string; job_description: string | null }[]>([]);
  const [prepSelectedId, setPrepSelectedId] = useState<string>("");
  const [prepFetched, setPrepFetched] = useState(false); // true after first fetch completes

  // ── NESTats (FAANG ATS audit) modal ──────────────────────────────────────
  const [nestatsModalOpen,   setNestatsModalOpen]   = useState(false);
  const [nestatsDocs,        setNestatsDocs]        = useState<{ id: string; label: string | null; original_name: string | null; mime_type: string }[]>([]);
  const [nestatsDocId,       setNestatsDocId]       = useState<string>("");
  const [nestatsJd,          setNestatsJd]          = useState<string>("");
  const [nestatsFetched,     setNestatsFetched]     = useState(false);
  const [nestatsRunning,     setNestatsRunning]     = useState(false);
  const [nestatsError,       setNestatsError]       = useState<string | null>(null);

  // ── Email Draft modal ─────────────────────────────────────────────────────
  const [emailModalOpen, setEmailModalOpen] = useState(false);
  const [emailContacts, setEmailContacts] = useState<{ id: string; name: string; title: string | null; application_id: string | null }[]>([]);
  const [emailContactId, setEmailContactId] = useState<string>("");
  // Narrow to the union — prevents untyped string from reaching the Groq prompt.
  const [emailCategory, setEmailCategory] = useState<typeof EMAIL_CATEGORIES[number]>("Follow Up");
  const [emailFetched, setEmailFetched] = useState(false);

  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  // Always start closed — avoids the server(true) vs mobile-client(false) hydration mismatch.
  // useEffect sets the correct value after mount (open on lg+, closed on mobile).
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sessionsLoading, setSessionsLoading] = useState(true);
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  // Session queued for deletion — opens the confirmation dialog
  const [deleteDialogSession, setDeleteDialogSession] = useState<{ id: string; title: string } | null>(null);

  const [attachedFile, setAttachedFile] = useState<AttachedFile | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editInput, setEditInput] = useState("");
  const [editingAttachment, setEditingAttachment] = useState<MessageAttachment | undefined>(undefined);

  const [previewDoc, setPreviewDoc] = useState<MessageAttachment | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const rateLimitBarRef = useRef<HTMLDivElement>(null);
  // Pre-allocated storage path prefix for files uploaded before a session exists.
  // Avoids storagePath being null on the first message of a new chat.
  const pendingStorageIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (window.innerWidth >= 1024) setSidebarOpen(true);
  }, []);

  // Pre-fill input from ATS scan handoff (stored in sessionStorage by /ats page)
  useEffect(() => {
    const pending = sessionStorage.getItem("nestai_pending_message");
    if (pending) {
      sessionStorage.removeItem("nestai_pending_message");
      setInput(pending);
      // Focus the textarea so the user can immediately send or edit
      setTimeout(() => {
        const textarea = document.querySelector<HTMLTextAreaElement>("textarea[placeholder]");
        textarea?.focus();
      }, 300);
    }
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (!windowEndAt) { setResetCountdown(null); return; }
    const totalSecs = WINDOW_MS / 1000;
    const tick = () => {
      const secsLeft = Math.ceil((windowEndAt - Date.now()) / 1000);
      if (secsLeft <= 0) {
        setRemaining(MAX_REQUESTS); setIsRateLimited(false); setError(null);
        setWindowEndAt(null); setResetCountdown(null);
        if (rateLimitBarRef.current) rateLimitBarRef.current.style.width = "0%";
      } else {
        setResetCountdown(secsLeft);
        if (rateLimitBarRef.current) {
          rateLimitBarRef.current.style.width = `${Math.max(0, (secsLeft / totalSecs) * 100)}%`;
        }
      }
    };
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [windowEndAt]);

  useEffect(() => {
    if (!menuOpenId) return;
    const handler = () => setMenuOpenId(null);
    document.addEventListener("click", handler);
    return () => document.removeEventListener("click", handler);
  }, [menuOpenId]);

  const loadSessions = useCallback(async () => {
    setSessionsLoading(true);
    try {
      const res = await fetchWithRetry("/api/nesta-ai/sessions");
      if (res.ok) {
        const data = await res.json();
        setSessions(data.sessions || []);
      }
    } catch (err) {
      console.error("Failed to load sessions:", err);
    } finally {
      setSessionsLoading(false);
    }
  }, []);

  useEffect(() => { loadSessions(); }, [loadSessions]);

  useEffect(() => {
    if (!prepModalOpen || prepFetched) return;
    let cancelled = false;
    createClient()
      .from("job_applications")
      .select("id, company, position, job_description")
      .in("status", ["Applied", "Phone Screen", "Interview"])
      .order("applied_date", { ascending: false })
      .limit(30)
      .then(({ data }) => {
        if (cancelled) return;
        setPrepApps((data ?? []) as typeof prepApps);
        setPrepFetched(true);
      });
    return () => { cancelled = true; };
  }, [prepModalOpen, prepFetched]);

  useEffect(() => {
    if (!emailModalOpen || emailFetched) return;
    let cancelled = false;
    createClient()
      .from("contacts")
      .select("id, name, title, application_id")   // email excluded — not rendered; least-privilege
      .order("name", { ascending: true })
      .limit(50)
      .then(({ data }) => {
        if (cancelled) return;
        setEmailContacts((data ?? []) as typeof emailContacts);
        setEmailFetched(true);
      });
    return () => { cancelled = true; };
  }, [emailModalOpen, emailFetched]);

  // Fetch document library when NESTats modal opens (once per session)
  useEffect(() => {
    if (!nestatsModalOpen || nestatsFetched) return;
    let cancelled = false;
    createClient()
      .from("application_documents")
      .select("id, label, original_name, mime_type")
      .eq("is_current", true)
      .in("mime_type", ["application/pdf", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "text/plain", "text/markdown"])
      .order("created_at", { ascending: false })
      .limit(50)
      .then(({ data }) => {
        if (cancelled) return;
        setNestatsDocs((data ?? []) as typeof nestatsDocs);
        // Pre-select the attached file if present, else first doc
        if (!nestatsDocId && (data ?? []).length > 0) setNestatsDocId(data![0].id);
        setNestatsFetched(true);
      });
    return () => { cancelled = true; };
  }, [nestatsModalOpen, nestatsFetched, nestatsDocId]);

  const createSession = async (): Promise<string | null> => {
    try {
      const res = await fetchWithRetry("/api/nesta-ai/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "New Chat" }),
      });
      if (res.ok) {
        const data = await res.json();
        setSessions((prev) => [data.session, ...prev]);
        return data.session.id;
      }
    } catch (err) {
      console.error("Failed to create session:", err);
    }
    return null;
  };

  const loadSession = async (sessionId: string) => {
    if (window.innerWidth < 1024) setSidebarOpen(false);
    try {
      const res = await fetchWithRetry(`/api/nesta-ai/sessions/${sessionId}`);
      if (res.ok) {
        const data = await res.json();
        const loaded: Message[] = data.session.messages.map((m: {
          id: string; role: "user" | "assistant"; content: string;
          created_at: string; metadata?: { attachment?: MessageAttachment };
        }) => ({
          id: m.id,
          role: m.role,
          content: m.content,
          timestamp: new Date(m.created_at),
          // attachment includes preview if it was saved
          attachment: m.metadata?.attachment,
        }));
        setMessages(loaded);
        setCurrentSessionId(sessionId);
        setError(null);
      }
    } catch (err) {
      console.error("Failed to load session:", err);
    }
  };

  const deleteSession = async (sessionId: string) => {
    setDeleteDialogSession(null);
    try {
      const res = await fetchWithRetry(`/api/nesta-ai/sessions/${sessionId}`, { method: "DELETE" }, { retries: 1 });
      if (res.ok) {
        setSessions((prev) => prev.filter((s) => s.id !== sessionId));
        if (currentSessionId === sessionId) { setMessages([]); setCurrentSessionId(null); }
      }
    } catch (err) {
      console.error("Failed to delete session:", err);
    }
  };

  const updateSessionTitle = async (sessionId: string, title: string) => {
    try {
      const res = await fetchWithRetry(`/api/nesta-ai/sessions/${sessionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title }),
      }, { retries: 1 });
      if (res.ok) {
        setSessions((prev) => prev.map((s) => (s.id === sessionId ? { ...s, title } : s)));
      }
    } catch (err) {
      console.error("Failed to update session title:", err);
    }
    setEditingSessionId(null);
  };

  const togglePin = async (sessionId: string, currentlyPinned: boolean) => {
    const newPinned = !currentlyPinned;
    // Optimistic update
    setSessions((prev) =>
      [...prev.map((s) => (s.id === sessionId ? { ...s, is_pinned: newPinned } : s))]
        .sort((a, b) => {
          if (a.is_pinned !== b.is_pinned) return a.is_pinned ? -1 : 1;
          return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
        })
    );
    setMenuOpenId(null);
    try {
      await fetchWithRetry(`/api/nesta-ai/sessions/${sessionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_pinned: newPinned }),
      }, { retries: 1 });
    } catch (err) {
      console.error("Failed to toggle pin:", err);
      loadSessions(); // revert on error
    }
  };

  const saveMessage = async (
    sessionId: string,
    role: "user" | "assistant",
    content: string,
    attachment?: MessageAttachment,
  ) => {
    try {
      await fetchWithRetry(`/api/nesta-ai/sessions/${sessionId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          role,
          content,
          ...(attachment ? { metadata: { attachment } } : {}),
        }),
      }, { retries: 1 });
    } catch (err) {
      console.error("Failed to save message:", err);
    }
  };

  // ── Shared streaming helper ────────────────────────────────────────────────
  // Called by both handleSubmit (new message) and handleEditSubmit (in-place update).
  const streamAIResponse = async (
    question: string,
    historySnapshot: { role: string; content: string }[],
    filePayload: { fileContent?: string; fileName?: string },
    sessionId: string | null,
  ) => {
    const assistantMsgId = `${Date.now() + 1}`;
    setMessages((prev) => [...prev, { id: assistantMsgId, role: "assistant", content: "", timestamp: new Date(), isStreaming: true }]);
    abortControllerRef.current = new AbortController();

    try {
      const res = await fetch("/api/nesta-ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question, history: historySnapshot.slice(-100), ...filePayload }),
        signal: abortControllerRef.current.signal,
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: "Failed to get response" }));
        if (res.status === 429 && data.resetIn) {
          setIsRateLimited(true); setRemaining(0);
          setWindowEndAt(Date.now() + data.resetIn * 1000);
        }
        setMessages((prev) => prev.filter((m) => m.id !== assistantMsgId));
        throw new Error(data.error || "Failed to get response");
      }

      const rlRemaining = parseInt(res.headers.get("X-RateLimit-Remaining") ?? String(MAX_REQUESTS), 10);
      const rlResetIn = parseInt(res.headers.get("X-RateLimit-Reset-In") ?? "0", 10);
      setRemaining(rlRemaining);
      if (rlResetIn > 0) setWindowEndAt(Date.now() + rlResetIn * 1000);
      if (rlRemaining === 0) setIsRateLimited(true);
      setIsDegraded(res.headers.get("X-NESTAi-Degraded") === "1");

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let fullContent = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        fullContent += chunk;
        setMessages((prev) => prev.map((m) => (m.id === assistantMsgId ? { ...m, content: fullContent } : m)));
      }

      const { content, suggestions } = parseFollowUps(fullContent);
      setMessages((prev) =>
        prev.map((m) => m.id === assistantMsgId ? { ...m, content, suggestions, isStreaming: false } : m)
      );
      if (sessionId) saveMessage(sessionId, "assistant", content);
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantMsgId
              ? { ...m, content: m.content || "(Response stopped)", isStreaming: false }
              : m
          )
        );
      } else {
        setMessages((prev) => prev.filter((m) => m.id !== assistantMsgId));
        setError(err instanceof Error ? err.message : "Something went wrong");
      }
    } finally {
      setIsLoading(false);
      abortControllerRef.current = null;
    }
  };

  const handleEditSubmit = async (messageId: string) => {
    const trimmed = editInput.trim();
    if (!trimmed || isLoading) return;

    const msgIndex = messages.findIndex((m) => m.id === messageId);
    if (msgIndex === -1) return;

    const originalMsg = messages[msgIndex];
    // Preserve the attachment from when edit was initiated (editingAttachment) or fall back
    // to whatever the original message had stored
    const preservedAttachment = editingAttachment ?? originalMsg.attachment;

    // Update the user message IN-PLACE at the same position; remove AI responses after it
    const priorMessages = messages.slice(0, msgIndex);
    const updatedMsg: Message = { ...originalMsg, content: trimmed, attachment: preservedAttachment };
    setMessages([...priorMessages, updatedMsg]);
    setEditingMessageId(null);
    setEditInput("");
    setEditingAttachment(undefined);
    setIsLoading(true);
    setError(null);
    setRemaining((prev) => Math.max(0, prev - 1));
    setWindowEndAt((prev) => prev ?? Date.now() + WINDOW_MS);

    if (currentSessionId) {
      // Remove the old message + all responses from server, then resave the edited message
      fetchWithRetry(
        `/api/nesta-ai/sessions/${currentSessionId}/messages?from=${messageId}`,
        { method: "DELETE" },
        { retries: 1 },
      ).catch((err) => console.error("Failed to delete messages from edit point:", err));
      saveMessage(currentSessionId, "user", trimmed, preservedAttachment);
    }

    const historySnapshot = priorMessages.map((m) => ({ role: m.role, content: m.content }));
    const filePayload = preservedAttachment?.preview
      ? { fileContent: preservedAttachment.preview, fileName: preservedAttachment.name }
      : {};
    await streamAIResponse(trimmed, historySnapshot, filePayload, currentSessionId);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";

    const MAX_SIZE = 5 * 1024 * 1024;
    if (file.size > MAX_SIZE) { setError("File exceeds 5 MB limit"); return; }

    // All file types go through parse-file so the binary is always uploaded to
    // Storage. The binary is what powers the preview; text extraction is separate.
    setAttachedFile({ name: file.name, text: null, loading: true });

    try {
      const form = new FormData();
      form.append("file", file);
      // Always pass a session_id — parse-file now requires it.
      // If no session exists yet, pre-allocate a UUID for the storage path.
      const sessionIdForUpload = currentSessionId
        ?? (pendingStorageIdRef.current ??= crypto.randomUUID());
      form.append("session_id", sessionIdForUpload);

      const res = await fetch("/api/nesta-ai/parse-file", { method: "POST", body: form });
      const data = await res.json();

      if (!res.ok) {
        // Storage upload failed — surface the error clearly; block the send
        setAttachedFile({
          name: file.name, text: null, loading: false,
          error: data.error ?? "File upload failed — please try again.",
        });
        return;
      }

      // parse-file guarantees storagePath when it returns 200
      setAttachedFile({
        name: file.name,
        text: data.text ?? null,
        storagePath: data.storagePath,
        loading: false,
      });
    } catch {
      setAttachedFile({ name: file.name, text: null, loading: false, error: "Connection error — could not upload file. Please try again." });
    }
  };

  const startNewChat = () => {
    setMessages([]); setCurrentSessionId(null); setError(null);
    setAttachedFile(null);
    pendingStorageIdRef.current = null; // reset so next new-session upload gets a fresh path
    inputRef.current?.focus();
  };

  const stopStreaming = () => {
    abortControllerRef.current?.abort();
  };

  const handleSubmit = async (e?: React.FormEvent, promptOverride?: string) => {
    e?.preventDefault();
    const baseQuestion = promptOverride || input.trim();
    if (!baseQuestion || isLoading || isRateLimited) return;

    // File still uploading — wait for it
    if (attachedFile?.loading) {
      setError("File is still being uploaded — please wait a moment before sending.");
      return;
    }
    // File upload failed — block send until user removes or re-uploads
    if (attachedFile?.error) {
      setError("Remove the failed file before sending, or try attaching it again.");
      return;
    }

    const question = baseQuestion;
    // File content sent as separate fields so it bypasses the 2000-char question limit
    const filePayload = attachedFile?.text
      ? { fileContent: attachedFile.text, fileName: attachedFile.name }
      : {};

    const historySnapshot = messages.map((m) => ({ role: m.role, content: m.content }));

    // Include the attachment card even when text extraction failed — the card still
    // shows the file name and type on the sent bubble; storagePath allows binary preview.
    const msgAttachment: MessageAttachment | undefined = attachedFile
      ? {
          name: attachedFile.name,
          fileType: attachedFile.name.split(".").pop() ?? "txt",
          preview: attachedFile.text ? attachedFile.text.slice(0, 3000) : undefined,
          storagePath: attachedFile.storagePath ?? undefined,
        }
      : undefined;

    const userMsg: Message = {
      id: Date.now().toString(),
      role: "user",
      content: baseQuestion,
      timestamp: new Date(),
      attachment: msgAttachment,
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setAttachedFile(null);
    setIsLoading(true);
    setError(null);

    setRemaining((prev) => Math.max(0, prev - 1));
    setWindowEndAt((prev) => prev ?? Date.now() + WINDOW_MS);

    let sessionId = currentSessionId;
    if (!sessionId) {
      sessionId = await createSession();
      if (sessionId) {
        setCurrentSessionId(sessionId);
        updateSessionTitle(sessionId, baseQuestion.slice(0, 60) + (baseQuestion.length > 60 ? "…" : ""));
      }
    }
    if (sessionId) saveMessage(sessionId, "user", baseQuestion, msgAttachment);

    await streamAIResponse(question, historySnapshot, filePayload, sessionId);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSubmit(); }
  };

  const autoResize = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    const el = e.target;
    el.style.height = "0";           // collapse first so scrollHeight is accurate
    // Read the CSS max-height so JS stays in sync.
    // parseFloat("none") returns NaN — use isFinite to detect that and fall back
    // to an explicit 108 px (4 lines × 24 px line-height + 2 × 6 px padding).
    const parsed = parseFloat(getComputedStyle(el).maxHeight);
    const cap = isFinite(parsed) ? parsed : 108;
    el.style.height = Math.min(el.scrollHeight, cap) + "px";
  };

  const formatRelativeDate = (dateStr: string) => {
    const diffDays = Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000);
    if (diffDays === 0) return "Today";
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return `${diffDays}d ago`;
    return new Date(dateStr).toLocaleDateString();
  };

  const pinnedSessions = sessions.filter((s) => s.is_pinned);
  const unpinnedSessions = sessions.filter((s) => !s.is_pinned);

  return (
    <>
    <div className="flex nestai-root nestai-page -mx-4 sm:-mx-6 lg:-mx-8 -mt-6 sm:-mt-8 -mb-36 md:-mb-8">

      {sidebarOpen && (
        <div
          className="fixed top-14 sm:top-16 inset-x-0 bottom-16 md:bottom-0 z-20 bg-black/40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      <aside className={cn(
        "flex flex-col nestai-sidebar transition-all duration-300 shrink-0",
        sidebarOpen
          ? "w-full sm:w-80 fixed lg:relative top-14 sm:top-16 bottom-16 md:bottom-0 left-0 z-30 lg:top-auto lg:bottom-auto lg:z-auto lg:w-72"
          : "w-0 overflow-hidden border-r-0"
      )}>
        <div className="flex items-center justify-between px-3 py-3.5 shrink-0 nestai-sidebar-header">
          <div className="flex items-center gap-1.5 pl-1">
            <span className="db-headline italic text-lg text-[#99462a] leading-none">NESTAi</span>
            <Sparkles className="h-3.5 w-3.5 text-[#d97757]" />
          </div>
          <div className="flex items-center gap-0.5">
            <button type="button" className="h-7 w-7 flex items-center justify-center rounded-lg text-[#55433d] hover:bg-[#99462a]/8 transition-colors" onClick={startNewChat} title="New chat">
              <Plus className="h-4 w-4" />
            </button>
            <button type="button" className="h-7 w-7 flex items-center justify-center rounded-lg text-[#55433d] hover:bg-[#99462a]/8 transition-colors" onClick={() => setSidebarOpen(false)} title="Close sidebar">
              <PanelLeftClose className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-2">
          {sessionsLoading ? (
            <div className="space-y-1 p-1">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="flex items-center gap-2 px-2 py-2.5 rounded-lg">
                  <Skeleton className="h-4 w-4 rounded shrink-0" />
                  <Skeleton className="h-4 flex-1" />
                </div>
              ))}
            </div>
          ) : sessions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center px-4">
              <MessageSquare className="h-8 w-8 text-muted-foreground/40 mb-3" />
              <p className="text-xs text-muted-foreground">No conversations yet</p>
            </div>
          ) : (
            <div className="space-y-0.5">
              {pinnedSessions.length > 0 && (
                <>
                  <p className="text-[10px] uppercase tracking-widest text-muted-foreground/60 px-2 pt-1 pb-0.5 font-medium">Pinned</p>
                  {pinnedSessions.map((session) => (
                    <SessionRow
                      key={session.id}
                      session={session}
                      isActive={currentSessionId === session.id}
                      isEditing={editingSessionId === session.id}
                      editTitle={editTitle}
                      menuOpenId={menuOpenId}
                      onLoad={loadSession}
                      onTogglePin={togglePin}
                      onRenameStart={(s) => { setEditTitle(s.title); setEditingSessionId(s.id); setMenuOpenId(null); }}
                      onRenameChange={setEditTitle}
                      onRenameSave={updateSessionTitle}
                      onRenameCancel={() => setEditingSessionId(null)}
                      onMenuToggle={(id) => setMenuOpenId((prev) => (prev === id ? null : id))}
                      onRequestDelete={(id, title) => { setMenuOpenId(null); setDeleteDialogSession({ id, title }); }}
                      formatRelativeDate={formatRelativeDate}
                    />
                  ))}
                  {unpinnedSessions.length > 0 && <p className="text-[10px] uppercase tracking-widest text-muted-foreground/60 px-2 pt-2 pb-0.5 font-medium">Recent</p>}
                </>
              )}
              {unpinnedSessions.map((session) => (
                <SessionRow
                  key={session.id}
                  session={session}
                  isActive={currentSessionId === session.id}
                  isEditing={editingSessionId === session.id}
                  editTitle={editTitle}
                  menuOpenId={menuOpenId}
                  onLoad={loadSession}
                  onTogglePin={togglePin}
                  onRenameStart={(s) => { setEditTitle(s.title); setEditingSessionId(s.id); setMenuOpenId(null); }}
                  onRenameChange={setEditTitle}
                  onRenameSave={updateSessionTitle}
                  onRenameCancel={() => setEditingSessionId(null)}
                  onMenuToggle={(id) => setMenuOpenId((prev) => (prev === id ? null : id))}
                  onRequestDelete={(id, title) => { setMenuOpenId(null); setDeleteDialogSession({ id, title }); }}
                  formatRelativeDate={formatRelativeDate}
                />
              ))}
            </div>
          )}
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">

        {isDegraded && (
          <div className="flex items-center gap-2 px-4 py-2 bg-amber-50 dark:bg-amber-950/40 border-b border-amber-200 dark:border-amber-800 text-xs text-amber-800 dark:text-amber-300 shrink-0">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-500 shrink-0" />
            Running on reduced capacity — switched to a smaller model. Responses may be shorter.
            <button type="button" onClick={() => setIsDegraded(false)} className="ml-auto text-amber-600 dark:text-amber-400 hover:opacity-70">✕</button>
          </div>
        )}

        <div className="flex items-center justify-between px-4 py-3.5 border-b nestai-topbar shrink-0">
          <div className="flex items-center gap-2">
            {!sidebarOpen && (
              <button
                type="button"
                className="p-2 -ml-1.5 rounded-full hover:bg-[#99462a]/5 transition-colors text-[#55433d]"
                onClick={() => setSidebarOpen(true)}
                title="Open sidebar"
              >
                <PanelLeft className="h-5 w-5" />
              </button>
            )}
            <div className="flex items-center gap-1.5">
              <span className="db-headline italic text-xl sm:text-2xl text-[#99462a] tracking-tight leading-none">
                NESTAi
              </span>
              <Sparkles className="h-4 w-4 text-[#d97757]" />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <RateLimitCounter remaining={remaining} max={MAX_REQUESTS} resetCountdown={resetCountdown} isRateLimited={isRateLimited} />
            <button
              type="button"
              onClick={() => setPrepModalOpen(true)}
              title="Interview Prep — generate tailored STAR questions for an upcoming interview"
              className="hidden sm:flex items-center gap-1.5 h-8 px-3 text-xs text-[#55433d] hover:text-[#1a1c1b] hover:bg-[#f4f3f1] rounded-full transition-colors"
            >
              <Target className="h-3.5 w-3.5" /> Prep
            </button>
            <button
              type="button"
              onClick={() => setEmailModalOpen(true)}
              title="Email Draft — let NESTAi draft a professional email for a contact"
              className="hidden sm:flex items-center gap-1.5 h-8 px-3 text-xs text-[#55433d] hover:text-[#1a1c1b] hover:bg-[#f4f3f1] rounded-full transition-colors"
            >
              <Mail className="h-3.5 w-3.5" /> Draft
            </button>
            <button
              type="button"
              onClick={() => { setNestatsModalOpen(true); setNestatsError(null); }}
              title="NESTats — FAANG-grade ATS audit of your resume: 30+ checkpoints, AI qualitative scoring"
              className="hidden sm:flex items-center gap-1.5 h-8 px-3 text-xs font-semibold text-[#99462a] hover:text-white hover:bg-[#99462a] rounded-full transition-colors border border-[#99462a]/30 hover:border-[#99462a]"
            >
              <ShieldCheck className="h-3.5 w-3.5" /> NESTats
            </button>
            {messages.length > 0 && currentSessionId && (
              <a
                href={`/api/nesta-ai/sessions/${currentSessionId}/export-pdf`}
                download
                title="Export this chat as PDF"
                className="hidden sm:flex items-center gap-1.5 h-8 px-3 text-xs text-[#55433d] hover:text-[#1a1c1b] hover:bg-[#f4f3f1] rounded-full transition-colors"
              >
                <FileDown className="h-3.5 w-3.5" /> Export
              </a>
            )}
            {messages.length > 0 && (
              <button
                type="button"
                onClick={startNewChat}
                className="hidden sm:flex items-center gap-1.5 h-8 px-3 text-xs text-[#55433d] hover:text-[#1a1c1b] hover:bg-[#f4f3f1] rounded-full transition-colors"
              >
                <Plus className="h-3.5 w-3.5" /> New chat
              </button>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto overflow-x-hidden pb-52 md:pb-0">
          {messages.length === 0 ? (
            <div className="relative min-h-full md:h-full md:overflow-hidden flex flex-col items-center justify-center px-6 py-8">
              <div className="absolute -top-[10%] -left-[10%] w-[40%] h-[40%] rounded-full bg-[#99462a]/5 blur-[120px] pointer-events-none" />
              <div className="absolute top-[40%] -right-[5%] w-[30%] h-[30%] rounded-full bg-[#006d34]/5 blur-[100px] pointer-events-none" />
              <div className="absolute -bottom-[10%] left-[20%] w-[50%] h-[30%] bg-[#d97757]/5 blur-[120px] pointer-events-none" />

              <div className="relative w-full max-w-2xl flex flex-col items-center text-center space-y-6">
                <div className="space-y-4">
                  <h2 className="db-headline text-4xl sm:text-5xl text-[#1a1c1b] tracking-tight leading-tight">
                    How can I{" "}
                    <span className="italic text-[#99462a]">help</span>{" "}
                    you?
                  </h2>
                  <p className="text-[#55433d] text-base sm:text-lg max-w-md mx-auto leading-relaxed">
                    Your intelligent partner for career growth, application tracking, and interview preparation.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 w-full mt-2">
                  {SUGGESTED_PROMPTS.slice(0, 4).map((item) => (
                    <button
                      key={item.label}
                      type="button"
                      onClick={() => handleSubmit(undefined, item.prompt)}
                      className="group flex flex-col items-start p-5 bg-[#f4f3f1] rounded-xl text-left transition-all duration-300 hover:bg-[#e9e8e6] hover:-translate-y-0.5 active:scale-[0.98]"
                    >
                      <div className="p-2.5 bg-[#99462a]/10 rounded-lg mb-3 text-[#99462a] group-hover:bg-[#99462a] group-hover:text-white transition-colors duration-200">
                        <item.icon className="h-4 w-4" />
                      </div>
                      <p className="text-sm font-bold text-[#1a1c1b] mb-1">{item.label}</p>
                      <p className="text-xs text-[#55433d] leading-relaxed">{item.prompt}</p>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="max-w-3xl lg:max-w-4xl mx-auto px-4 md:px-6 py-4 md:py-8 space-y-4 md:space-y-6">
              {messages.map((msg) => (
                <div key={msg.id}>
                  {msg.role === "user" ? (
                    <div className="flex flex-col items-end gap-1 group/msg">
                      {msg.attachment && (
                        <FileAttachmentCard
                          attachment={msg.attachment}
                          onView={
                            (msg.attachment.preview !== undefined || !!msg.attachment.storagePath)
                              ? () => setPreviewDoc(msg.attachment!)
                              : undefined
                          }
                        />
                      )}
                      {editingMessageId === msg.id ? (
                        /* ── Inline editor ── */
                        <div className="w-full max-w-[85%] space-y-2">
                          <textarea
                            value={editInput}
                            onChange={(e) => setEditInput(e.target.value)}
                            autoFocus
                            aria-label="Edit message"
                            title="Edit message"
                            placeholder="Edit your message…"
                            rows={Math.max(2, editInput.split("\n").length)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleEditSubmit(msg.id); }
                              if (e.key === "Escape") { setEditingMessageId(null); setEditInput(""); setEditingAttachment(undefined); }
                            }}
                            className="w-full rounded-2xl rounded-tr-sm border-2 border-primary/40 bg-background px-4 py-2.5 text-[16px] sm:text-sm focus:outline-none focus:border-primary resize-none"
                          />
                          <div className="flex justify-end gap-2">
                            <Button size="sm" variant="ghost" onClick={() => { setEditingMessageId(null); setEditInput(""); setEditingAttachment(undefined); }}>
                              Cancel
                            </Button>
                            <Button size="sm" onClick={() => handleEditSubmit(msg.id)} disabled={!editInput.trim() || isLoading}>
                              Send
                            </Button>
                          </div>
                        </div>
                      ) : (
                        /* ── Normal bubble + edit button ── */
                        <div className="flex items-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => { setEditingMessageId(msg.id); setEditInput(msg.content); setEditingAttachment(msg.attachment); }}
                            disabled={isLoading}
                            title="Edit message"
                            className="opacity-0 group-hover/msg:opacity-100 transition-opacity p-1 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground shrink-0 mb-0.5 disabled:pointer-events-none"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <div className="max-w-[85%] md:max-w-[75%] nestai-user-bubble rounded-2xl rounded-tr-sm px-4 md:px-5 py-2.5 md:py-3 min-w-0">
                            <p className="text-sm md:text-base whitespace-pre-wrap leading-relaxed break-words overflow-wrap-anywhere">{msg.content}</p>
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="flex gap-3 group">
                      <AssistantAvatar thinking={!!(msg.isStreaming && !msg.content)} />
                      <div
                        className="flex-1 min-w-0"
                        aria-live="polite"
                        aria-atomic="false"
                      >
                        {msg.isStreaming && !msg.content
                          ? <ThinkingIndicator />
                          : <MarkdownRenderer content={msg.content} isStreaming={msg.isStreaming} />
                        }
                        {!msg.isStreaming && (
                          <>
                            <div className="flex items-center gap-1 mt-1.5">
                              <CopyButton text={msg.content} />
                              <span className="text-[11px] text-muted-foreground/50 opacity-0 group-hover:opacity-100 transition-opacity">
                                {formatTime(msg.timestamp.toISOString())}
                              </span>
                            </div>
                            {msg.suggestions && msg.suggestions.length > 0 && (
                              <div className="mt-3 flex flex-wrap gap-1.5">
                                {msg.suggestions.map((s) => (
                                  <button
                                    key={s}
                                    type="button"
                                    onClick={() => handleSubmit(undefined, s)}
                                    disabled={isLoading || isRateLimited}
                                    className="text-xs px-3 py-1.5 rounded-full border nestai-pill transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                                  >
                                    {s}
                                  </button>
                                ))}
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}


              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        <div className="nestai-input-area">
          {error && (
            <div className="pb-2 max-w-3xl lg:max-w-4xl mx-auto w-full">
              <div className="flex items-center justify-between gap-3 px-4 py-2.5 rounded-xl bg-destructive/8 border border-destructive/20 text-destructive text-sm">
                <span>{error}</span>
                <button type="button" aria-label="Dismiss error" onClick={() => setError(null)} className="hover:opacity-70 shrink-0">
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}
          <div className="max-w-3xl lg:max-w-4xl mx-auto">
            {isRateLimited && resetCountdown ? (
              <div className="rounded-2xl border border-destructive/20 bg-destructive/5 px-4 py-4">
                <div className="h-1 w-full rounded-full bg-destructive/15 mb-3 overflow-hidden">
                  <div
                    ref={rateLimitBarRef}
                    className="h-full rounded-full bg-destructive/40 transition-all duration-1000"
                  />
                </div>
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-2.5">
                    <div className="h-8 w-8 rounded-full bg-destructive/10 flex items-center justify-center shrink-0">
                      <Zap className="h-4 w-4 text-destructive" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-destructive">Rate limit reached</p>
                      <p className="text-xs text-destructive/70">You&apos;ve used all {MAX_REQUESTS} requests for this minute</p>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-2xl font-bold tabular-nums text-destructive leading-none">{resetCountdown}s</p>
                    <p className="text-[11px] text-destructive/60 mt-0.5">until reset</p>
                  </div>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmit}>
                {attachedFile && (
                  <div className={cn(
                    "mb-2 flex items-center gap-2 px-3 py-1.5 rounded-lg border w-fit max-w-full",
                    attachedFile.error
                      ? "bg-destructive/8 border-destructive/25 text-destructive"
                      : attachedFile.loading
                      ? "bg-muted border-border text-muted-foreground"
                      : "bg-[#99462a]/8 border-[#99462a]/20 text-[#99462a]"
                  )}>
                    {attachedFile.loading
                      ? <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" />
                      : attachedFile.error
                      ? <X className="h-3.5 w-3.5 shrink-0" />
                      : <Paperclip className="h-3.5 w-3.5 shrink-0" />
                    }
                    <span className="text-xs font-medium truncate max-w-55">
                      {attachedFile.error
                        ? `Couldn't read ${attachedFile.name} — you can still chat`
                        : attachedFile.loading
                        ? `Processing ${attachedFile.name}…`
                        : attachedFile.name
                      }
                    </span>
                    <button
                      type="button"
                      onClick={() => setAttachedFile(null)}
                      className="shrink-0 opacity-60 hover:opacity-100"
                      aria-label="Remove attached file"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}
                {/* Capsule input — single-line pill that grows up to ~4 lines then scrolls.
                    items-center keeps the icon buttons vertically centred at all heights. */}
                <div className="nestai-input flex items-center gap-1.5 sm:gap-2 rounded-[999px] border transition-all px-2 sm:px-3 py-2">
                  {/* Attach */}
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isLoading}
                    className="nestai-input-btn shrink-0"
                    title="Attach file or image (PDF, DOCX, TXT, images — max 5 MB)"
                    aria-label="Attach file"
                  >
                    <Paperclip className="h-4 w-4 sm:h-5 sm:w-5" />
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*,.pdf,.docx,.doc,.txt,.md"
                    className="hidden"
                    aria-label="Attach file or image"
                    title="Attach file or image (PDF, DOCX, TXT, images — max 5 MB)"
                    onChange={handleFileChange}
                  />

                  {/* Auto-growing textarea — no min-height so it starts at one line */}
                  <textarea
                    ref={inputRef}
                    value={input}
                    onChange={autoResize}
                    onKeyDown={handleKeyDown}
                    placeholder="Ask NESTAi anything..."
                    rows={1}
                    disabled={isLoading}
                    className="nestai-input-textarea flex-1 min-w-0"
                  />

                  {/* Send / Stop */}
                  {isLoading ? (
                    <button
                      type="button"
                      onClick={stopStreaming}
                      className="nestai-send-btn shrink-0 bg-[#1a1c1b]/10 hover:bg-[#1a1c1b]/20"
                      title="Stop generating"
                      aria-label="Stop generating"
                    >
                      <Square className="h-4 w-4 fill-current text-[#1a1c1b]" />
                    </button>
                  ) : (
                    <button
                      type="submit"
                      title="Send message"
                      aria-label="Send message"
                      disabled={(!input.trim() && !attachedFile) || isLoading}
                      className={cn(
                        "nestai-send-btn shrink-0 transition-all active:scale-90",
                        (input.trim() || attachedFile) && !isLoading
                          ? "bg-[#99462a] hover:bg-[#d97757] text-white shadow-sm"
                          : "bg-[#c8c6c3] text-[#88726c]"
                      )}
                    >
                      <Send className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </form>
            )}

            <p className="text-[10px] text-[#55433d]/40 text-center mt-3 uppercase tracking-widest font-medium">
              AI can make mistakes. Check important information.
            </p>
          </div>
        </div>
      </div>
    </div>

    {previewDoc && (
      <ChatAttachmentPreview
        attachment={previewDoc}
        onClose={() => setPreviewDoc(null)}
      />
    )}

    {/* ── Interview Prep modal ─────────────────────────────────────────── */}
    <Dialog open={prepModalOpen} onOpenChange={(o) => { setPrepModalOpen(o); if (!o) setPrepSelectedId(""); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Target className="h-4 w-4 text-[#99462a]" />
            Interview Prep
          </DialogTitle>
          <DialogDescription>
            Pick an application to prep for. NESTAi will generate tailored STAR questions and evaluate your answers.
          </DialogDescription>
        </DialogHeader>

        {prepModalOpen && !prepFetched ? (
          <div className="flex items-center justify-center py-8 text-muted-foreground gap-2 text-sm">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading applications…
          </div>
        ) : prepApps.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">
            No active applications found. Add applications with status Applied, Phone Screen, or Interview first.
          </p>
        ) : (
          <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
            {prepApps.map((app) => (
              <button
                type="button"
                key={app.id}
                onClick={() => setPrepSelectedId(app.id)}
                className={cn(
                  "w-full text-left rounded-xl px-4 py-3 border text-sm transition-colors",
                  prepSelectedId === app.id
                    ? "border-[#99462a] bg-[#99462a]/5"
                    : "border-border hover:border-[#99462a]/40 hover:bg-muted/40"
                )}
              >
                <p className="font-semibold text-foreground truncate">{app.position}</p>
                <p className="text-xs text-muted-foreground mt-0.5 truncate">{app.company}</p>
                {!app.job_description && (
                  <p className="text-[10px] text-amber-600 dark:text-amber-400 mt-1">
                    ⚠ No job description — add it for better questions
                  </p>
                )}
              </button>
            ))}
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" size="sm" onClick={() => setPrepModalOpen(false)}>Cancel</Button>
          <Button
            size="sm"
            disabled={!prepSelectedId}
            onClick={() => {
              const app = prepApps.find((a) => a.id === prepSelectedId);
              if (!app) return;
              const jdNote = app.job_description
                ? `Based on their job description: "${app.job_description.slice(0, 600)}${app.job_description.length > 600 ? "…" : ""}"`
                : "(No job description stored — ask general behavioral questions for this role.)";
              const prompt = `I have an interview coming up at ${app.company} for the ${app.position} role.\n\n${jdNote}\n\nPlease generate 5 tailored STAR behavioral interview questions for this specific role. After each question I'll share my draft answer — evaluate it with specific, actionable feedback.`;
              setInput(prompt);
              setPrepModalOpen(false);
              setPrepSelectedId("");
              setTimeout(() => inputRef.current?.focus(), 100);
            }}
          >
            <Target className="h-3.5 w-3.5 mr-1.5" />
            Start prep
          </Button>
        </div>
      </DialogContent>
    </Dialog>

    {/* ── Email Draft modal ────────────────────────────────────────────── */}
    <Dialog open={emailModalOpen} onOpenChange={(o) => { setEmailModalOpen(o); if (!o) { setEmailContactId(""); setEmailCategory("Follow Up"); } }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-4 w-4 text-[#99462a]" />
            Email Draft Assistant
          </DialogTitle>
          <DialogDescription>
            Pick a contact and email type. NESTAi will draft a professional email you can review and edit.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Category selector */}
          <div className="space-y-1.5">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Email type</p>
            <div className="flex flex-wrap gap-1.5">
              {EMAIL_CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setEmailCategory(cat)}
                  className={cn(
                    "text-xs px-3 py-1.5 rounded-full border transition-colors",
                    emailCategory === cat
                      ? "border-[#99462a] bg-[#99462a]/8 text-[#99462a] font-semibold dark:border-[#ccff00] dark:bg-[#ccff00]/8 dark:text-[#ccff00]"
                      : "border-border text-muted-foreground hover:border-[#99462a]/40"
                  )}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Contact selector */}
          <div className="space-y-1.5">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">
              Contact <span className="normal-case font-normal">(optional)</span>
            </p>
            {emailModalOpen && !emailFetched ? (
              <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading contacts…
              </div>
            ) : emailContacts.length === 0 ? (
              <p className="text-xs text-muted-foreground py-2">
                No contacts yet — you can still draft without selecting one.
              </p>
            ) : (
              <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                {/* "No specific contact" option */}
                <button
                  type="button"
                  onClick={() => setEmailContactId("")}
                  className={cn(
                    "w-full text-left rounded-xl px-4 py-2.5 border text-sm transition-colors",
                    emailContactId === ""
                      ? "border-[#99462a] bg-[#99462a]/5"
                      : "border-border hover:border-[#99462a]/40 hover:bg-muted/40"
                  )}
                >
                  <p className="font-medium text-foreground text-xs">No specific contact</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">Draft a general template</p>
                </button>
                {emailContacts.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setEmailContactId(c.id)}
                    className={cn(
                      "w-full text-left rounded-xl px-4 py-2.5 border text-sm transition-colors",
                      emailContactId === c.id
                        ? "border-[#99462a] bg-[#99462a]/5"
                        : "border-border hover:border-[#99462a]/40 hover:bg-muted/40"
                    )}
                  >
                    <p className="font-semibold text-foreground truncate">{c.name}</p>
                    {c.title && (
                      <p className="text-[10px] text-muted-foreground mt-0.5 truncate">{c.title}</p>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" size="sm" onClick={() => setEmailModalOpen(false)}>Cancel</Button>
          <Button
            size="sm"
            onClick={() => {
              const contact = emailContacts.find((c) => c.id === emailContactId);
              const prompt = buildEmailPrompt(emailCategory, contact?.name, contact?.title);
              setInput(prompt);
              setEmailModalOpen(false);
              setEmailContactId("");
              setEmailCategory("Follow Up");
              setTimeout(() => inputRef.current?.focus(), 100);
            }}
          >
            <Mail className="h-3.5 w-3.5 mr-1.5" />
            Generate draft
          </Button>
        </div>
      </DialogContent>
    </Dialog>

    {/* ── NESTats — FAANG ATS Audit modal ─────────────────────────────── */}
    <Dialog
      open={nestatsModalOpen}
      onOpenChange={(o) => {
        setNestatsModalOpen(o);
        if (!o) { setNestatsError(null); setNestatsJd(""); }
      }}
    >
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-[#99462a]" />
            NESTats — FAANG ATS Audit
          </DialogTitle>
          <DialogDescription>
            Select your resume and NESTAi will run a FAANG-grade 30+ point audit covering format,
            content quality, impact signals, and technical keywords — then guide you through fixes.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Resume selector */}
          <div className="space-y-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Resume</p>
            {nestatsModalOpen && !nestatsFetched ? (
              <div className="flex items-center justify-center py-6 text-muted-foreground gap-2 text-sm">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading documents…
              </div>
            ) : nestatsDocs.length === 0 ? (
              <div className="rounded-xl border-2 border-dashed border-border/50 p-6 text-center space-y-2">
                <FileText className="h-7 w-7 text-muted-foreground/40 mx-auto" />
                <p className="text-sm font-medium text-foreground">No documents found</p>
                <p className="text-xs text-muted-foreground">
                  Upload your resume in the{" "}
                  <a href="/documents" className="text-[#99462a] hover:underline font-medium">Document Library</a>
                  {" "}then come back here.
                </p>
              </div>
            ) : (
              <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                {/* "Use attached file" option when a file is attached to the chat */}
                {attachedFile && !attachedFile.loading && !attachedFile.error && (
                  <button
                    type="button"
                    onClick={() => setNestatsDocId("__attached__")}
                    className={cn(
                      "w-full text-left rounded-xl px-4 py-2.5 border text-sm transition-colors",
                      nestatsDocId === "__attached__"
                        ? "border-[#99462a] bg-[#99462a]/5"
                        : "border-border hover:border-[#99462a]/40 hover:bg-muted/40"
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <Paperclip className="h-3.5 w-3.5 text-[#99462a] shrink-0" />
                      <p className="font-semibold text-foreground truncate">{attachedFile.name}</p>
                      <span className="text-[10px] text-[#99462a] font-semibold shrink-0">Attached</span>
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-0.5 ml-5.5">Currently attached to this chat</p>
                  </button>
                )}
                {nestatsDocs.map((doc) => (
                  <button
                    type="button"
                    key={doc.id}
                    onClick={() => setNestatsDocId(doc.id)}
                    className={cn(
                      "w-full text-left rounded-xl px-4 py-2.5 border text-sm transition-colors",
                      nestatsDocId === doc.id
                        ? "border-[#99462a] bg-[#99462a]/5"
                        : "border-border hover:border-[#99462a]/40 hover:bg-muted/40"
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <p className="font-semibold text-foreground truncate">{doc.label || doc.original_name || "Untitled"}</p>
                      <span className="text-[10px] text-muted-foreground/60 uppercase shrink-0">
                        {doc.mime_type === "application/pdf" ? "PDF"
                          : doc.mime_type.includes("word") ? "DOCX"
                          : doc.mime_type.includes("markdown") ? "MD"
                          : "TXT"}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Optional JD */}
          <div className="space-y-1.5">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">
              Job description <span className="normal-case font-normal">(optional — improves analysis)</span>
            </p>
            <textarea
              rows={3}
              placeholder="Paste the job description to get JD-alignment scoring…"
              value={nestatsJd}
              onChange={(e) => setNestatsJd(e.target.value)}
              className="w-full rounded-xl border border-border bg-[#f4f3f1] px-3 py-2 text-[16px] sm:text-sm text-foreground placeholder:text-muted-foreground/60 resize-none focus:outline-none focus:ring-2 focus:ring-[#99462a]/30"
            />
          </div>

          {/* What NESTats checks */}
          <div className="rounded-xl bg-muted/40 px-3.5 py-3 space-y-2">
            <p className="text-xs font-semibold text-foreground">What gets audited</p>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
              {[
                "Contact & identity completeness",
                "Action verbs & filler phrases",
                "Section completeness (6 sections)",
                "Quantified metrics & scale",
                "System design vocabulary",
                "Cloud / DevOps tooling",
                "Open source contributions",
                "AI qualitative scoring (5 dims)",
              ].map((item) => (
                <div key={item} className="flex items-start gap-1.5">
                  <ShieldCheck className="h-3 w-3 text-emerald-500 shrink-0 mt-0.5" />
                  {item}
                </div>
              ))}
            </div>
          </div>

          {nestatsError && (
            <p className="text-xs text-destructive bg-destructive/8 border border-destructive/20 rounded-lg px-3 py-2">
              {nestatsError}
            </p>
          )}
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" size="sm" onClick={() => setNestatsModalOpen(false)}>Cancel</Button>
          <Button
            size="sm"
            disabled={!nestatsDocId || nestatsRunning || nestatsDocs.length === 0}
            onClick={async () => {
              if (!nestatsDocId) return;
              setNestatsRunning(true);
              setNestatsError(null);

              try {
                let resumeText = "";
                const docName  = nestatsDocId === "__attached__"
                  ? (attachedFile?.name ?? "your resume")
                  : (nestatsDocs.find((d) => d.id === nestatsDocId)?.label
                      ?? nestatsDocs.find((d) => d.id === nestatsDocId)?.original_name
                      ?? "your resume");

                if (nestatsDocId === "__attached__") {
                  // Attached file: text was already extracted during upload.
                  resumeText = attachedFile?.text?.slice(0, 3_500) ?? "";
                } else {
                  // Library document: fetch parsed text via the proxy route so
                  // the AI actually sees the resume content. Without this the
                  // prompt contains no resume text and the AI fabricates results.
                  try {
                    const docRes = await fetch(
                      `/api/documents?path=${encodeURIComponent(
                        nestatsDocs.find((d) => d.id === nestatsDocId)?.id ?? nestatsDocId
                      )}`,
                      { credentials: "include" }
                    );
                    // The proxy streams the binary — we need the text-parse API instead.
                    // Call the resume-audit route without a JD to get the text back.
                    const auditRes = await fetch("/api/documents/resume-audit", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      credentials: "include",
                      body: JSON.stringify({ document_id: nestatsDocId }),
                    });
                    if (auditRes.ok) {
                      // We got an audit result — use the areas_for_improvement and
                      // key_strengths to seed the prompt with real extracted content.
                      const auditData = await auditRes.json() as {
                        talent?: { key_strengths?: string[]; areas_for_improvement?: string[] };
                      };
                      const strengths = auditData.talent?.key_strengths?.join("; ") ?? "";
                      const gaps      = auditData.talent?.areas_for_improvement?.join("; ") ?? "";
                      resumeText = strengths || gaps
                        ? `[Pre-analysed strengths: ${strengths}. Gaps: ${gaps}]`
                        : "";
                    }
                    void docRes; // consumed above path; suppress unused warning
                  } catch {
                    // Non-fatal — proceed with empty text; the AI will say it can't see it.
                  }
                }

                if (!resumeText && nestatsDocId !== "__attached__") {
                  // Library doc and text fetch failed — redirect user to the proper ATS page.
                  setNestatsError(
                    "Could not extract resume text. Use the ATS Scanner page (/ats) for a full audit of library documents."
                  );
                  setNestatsRunning(false);
                  return;
                }

                // Build a structured NESTats prompt
                const jdSection = nestatsJd.trim()
                  ? `\n\n**Job description provided:**\n${nestatsJd.trim().slice(0, 800)}${nestatsJd.trim().length > 800 ? "…" : ""}`
                  : "";

                const attachedSection = resumeText
                  ? `\n\n**Resume content (${docName}):**\n\`\`\`\n${resumeText}\n\`\`\``
                  : "";

                const prompt = [
                  `Please run a comprehensive **NESTats FAANG ATS audit** on my resume "${docName}".${attachedSection}${jdSection}`,
                  "",
                  "Structure your response exactly as:",
                  "## NESTats FAANG Audit",
                  "**Overall Grade: [A+/A/B+/B/C/D/F]** | **Readiness: [FAANG Ready / Close / Needs Work / Major Gaps]**",
                  "",
                  "### 🔴 Critical Fixes (address immediately)",
                  "### 🟡 Important Improvements",
                  "### ✅ Strengths",
                  "",
                  "### 📊 Category Breakdown",
                  "Evaluate across: Contact & Identity · Format & ATS Readability · Section Completeness · Content Quality · FAANG Impact Signals · Technical Keywords",
                  "",
                  "### 🎯 Top 5 Priority Actions",
                  "",
                  "### ✏️ 2 Example Bullet Rewrites (BEFORE → AFTER in FAANG style)",
                  "",
                  "Base your assessment on HackerRank hiring-agent criteria: open source contributions, self projects, production work, technical skills, quantified impact, and scale signals.",
                ].join("\n");

                setNestatsModalOpen(false);
                setNestatsJd("");
                setNestatsError(null);

                // Small delay to let modal close animate before submitting
                setTimeout(() => {
                  setInput(prompt);
                  setTimeout(() => inputRef.current?.focus(), 50);
                }, 150);

              } catch {
                setNestatsError("Something went wrong. Please try again.");
              } finally {
                setNestatsRunning(false);
              }
            }}
          >
            {nestatsRunning ? (
              <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />Preparing…</>
            ) : (
              <><ShieldCheck className="h-3.5 w-3.5 mr-1.5" />Run NESTats</>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>

    {/* ── Delete chat confirmation dialog ──────────────────────────────── */}
    <Dialog
      open={deleteDialogSession !== null}
      onOpenChange={(open) => { if (!open) setDeleteDialogSession(null); }}
    >
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <Trash2 className="h-4 w-4 shrink-0" />
            Delete chat?
          </DialogTitle>
          <DialogDescription className="pt-1">
            {deleteDialogSession && (
              <>
                <span className="font-medium text-foreground">&ldquo;{deleteDialogSession.title}&rdquo;</span>
                {" "}will be permanently deleted. This cannot be undone.
              </>
            )}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="outline"
            onClick={() => setDeleteDialogSession(null)}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={() => deleteDialogSession && deleteSession(deleteDialogSession.id)}
          >
            Delete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  );
}

function SessionRow({
  session, isActive, isEditing, editTitle, menuOpenId,
  onLoad, onTogglePin, onRenameStart, onRenameChange, onRenameSave,
  onRenameCancel, onMenuToggle, onRequestDelete, formatRelativeDate,
}: {
  session: ChatSession;
  isActive: boolean;
  isEditing: boolean;
  editTitle: string;
  menuOpenId: string | null;
  onLoad: (id: string) => void;
  onTogglePin: (id: string, pinned: boolean) => void;
  onRenameStart: (s: ChatSession) => void;
  onRenameChange: (v: string) => void;
  onRenameSave: (id: string, title: string) => void;
  onRenameCancel: () => void;
  onMenuToggle: (id: string) => void;
  onRequestDelete: (id: string, title: string) => void;
  formatRelativeDate: (d: string) => string;
}) {
  return (
    <div className={cn(
      "group relative flex items-center gap-1 rounded-lg transition-colors cursor-pointer",
      isActive ? "nestai-session-active" : "nestai-session-inactive"
    )}>
      {session.is_pinned && (
        <Pin className="absolute left-1.5 top-2 h-2.5 w-2.5 text-primary/40 shrink-0" />
      )}

      {isEditing ? (
        <div className="flex items-center gap-1 w-full px-2 py-1.5">
          <input
            type="text"
            value={editTitle}
            onChange={(e) => onRenameChange(e.target.value)}
            className="flex-1 text-[16px] sm:text-xs bg-background border rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-primary/40 text-foreground"
            autoFocus
            aria-label="Chat title"
            title="Rename chat"
            placeholder="Chat title"
            onKeyDown={(e) => {
              if (e.key === "Enter") onRenameSave(session.id, editTitle);
              else if (e.key === "Escape") onRenameCancel();
            }}
          />
          <button type="button" aria-label="Save" onClick={() => onRenameSave(session.id, editTitle)} className="p-1 rounded hover:bg-green-100 text-green-600">
            <Check className="h-3.5 w-3.5" />
          </button>
          <button type="button" aria-label="Cancel" onClick={onRenameCancel} className="p-1 rounded hover:bg-muted">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : (
        <>
          <button
            type="button"
            className={cn("flex-1 text-left py-2 min-w-0", session.is_pinned ? "pl-5 pr-1" : "px-2")}
            onClick={() => onLoad(session.id)}
          >
            <p className="text-xs font-medium truncate leading-tight">{session.title}</p>
            <p className="text-[11px] text-muted-foreground/70 mt-0.5">{formatRelativeDate(session.updated_at)}</p>
          </button>

          <div className="relative pr-1 shrink-0">
            <button
              type="button"
              aria-label="Session options"
              className={cn(
                "p-1 rounded hover:bg-muted transition-opacity text-muted-foreground",
                menuOpenId === session.id ? "opacity-100" : "opacity-0 group-hover:opacity-100"
              )}
              onClick={(e) => { e.stopPropagation(); onMenuToggle(session.id); }}
            >
              <MoreHorizontal className="h-3.5 w-3.5" />
            </button>

            {menuOpenId === session.id && (
              <div
                className="absolute right-0 top-full mt-1 bg-popover border rounded-lg shadow-lg py-1 z-30 min-w-[140px]"
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  type="button"
                  className="w-full px-3 py-1.5 text-xs text-left hover:bg-muted flex items-center gap-2 transition-colors"
                  onClick={() => onRenameStart(session)}
                >
                  <Pencil className="h-3.5 w-3.5 text-muted-foreground" /> Rename
                </button>
                <button
                  type="button"
                  className="w-full px-3 py-1.5 text-xs text-left hover:bg-muted flex items-center gap-2 transition-colors"
                  onClick={() => onTogglePin(session.id, session.is_pinned)}
                >
                  {session.is_pinned
                    ? <><PinOff className="h-3.5 w-3.5 text-muted-foreground" /> Unpin</>
                    : <><Pin className="h-3.5 w-3.5 text-muted-foreground" /> Pin</>
                  }
                </button>
                <button
                  type="button"
                  className="w-full px-3 py-1.5 text-xs text-left hover:bg-destructive/10 flex items-center gap-2 text-destructive transition-colors"
                  onClick={(e) => { e.stopPropagation(); onRequestDelete(session.id, session.title); }}
                >
                  <Trash2 className="h-3.5 w-3.5" /> Delete
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
