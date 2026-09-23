"use client";

import { useState, useEffect } from "react";
import {
  Download, ExternalLink, File, FileText, FileImage, Lock, Loader2, StickyNote, X,
} from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ApplicationDocument } from "@/types";

// ── Helpers ───────────────────────────────────────────────────────────────────

const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

export function mimeColour(mimeType: string): string {
  if (mimeType === "application/pdf")
    return "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400";
  if (mimeType.includes("wordprocessing") || mimeType === "application/msword")
    return "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400";
  if (mimeType.startsWith("image/"))
    return "bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-400";
  return "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400";
}

export function MimeIcon({ mimeType, className = "h-4 w-4" }: { mimeType: string; className?: string }) {
  if (mimeType.startsWith("image/")) return <FileImage className={className} />;
  if (mimeType === "application/pdf") return <FileText className={className} />;
  return <File className={className} />;
}

function isDocx(mimeType: string) {
  return mimeType === DOCX_MIME || mimeType === "application/msword";
}

function isPreviewable(mimeType: string) {
  return mimeType === "application/pdf" || mimeType.startsWith("image/") || isDocx(mimeType);
}

// Proxy URL — uses our own domain, not a raw Supabase CDN link.
function proxyUrl(storagePath: string) {
  return `/api/documents?path=${encodeURIComponent(storagePath)}`;
}

// Minimal safe HTML shell for mammoth output rendered in a sandboxed iframe.
// sandox="" prevents all scripting; @media handles dark-mode without parent access.
function docxSrcDoc(body: string): string {
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>
    *,*::before,*::after{box-sizing:border-box}
    body{font-family:system-ui,-apple-system,sans-serif;font-size:14px;line-height:1.7;
         padding:2rem 2.5rem;color:#1a1a1a;margin:0 auto;max-width:860px}
    h1{font-size:1.5em}h2{font-size:1.3em}h3{font-size:1.1em}
    h1,h2,h3,h4,h5,h6{font-weight:600;margin:1em 0 .4em;line-height:1.3}
    p{margin:0 0 .8em}ul,ol{margin:.5em 0;padding-left:1.5em}li{margin-bottom:.3em}
    table{border-collapse:collapse;width:100%;margin:1em 0;font-size:.9em}
    td,th{border:1px solid #d1d5db;padding:.4em .6em;text-align:left}
    th{background:#f9fafb;font-weight:600}
    strong,b{font-weight:600}em,i{font-style:italic}
    hr{border:none;border-top:1px solid #e5e7eb;margin:1.5em 0}
    a{color:#2563eb}img{max-width:100%;height:auto}
    @media(prefers-color-scheme:dark){
      body{color:#e5e7eb;background:#111827}
      td,th{border-color:#374151}th{background:#1f2937}hr{border-color:#374151}
    }
  </style></head><body>${body}</body></html>`;
}

// ── Component ─────────────────────────────────────────────────────────────────

export interface DocPreviewDialogProps {
  doc: ApplicationDocument & { appName?: string };
  onClose: () => void;
  onAnnotate?: () => void;
}

export function DocPreviewDialog({ doc, onClose, onAnnotate }: DocPreviewDialogProps) {
  const [signedUrl, setSignedUrl] = useState<string | null>(doc.signed_url ?? null);
  const [blobUrl,   setBlobUrl]   = useState<string | null>(null);
  const [docxHtml,  setDocxHtml]  = useState<string | null>(null);
  const [loading,   setLoading]   = useState(true);
  const [pdfError,  setPdfError]  = useState<string | null>(null);
  const [docxError, setDocxError] = useState<string | null>(null);

  // Detect mobile / iOS where <iframe> PDF rendering doesn't work.
  const [isMobile] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return /iPhone|iPad|iPod/i.test(navigator.userAgent) || window.innerWidth < 768;
  });

  useEffect(() => {
    setBlobUrl(null);
    setDocxHtml(null);
    setPdfError(null);
    setDocxError(null);

    let cancelled = false;
    let objectUrl: string | null = null;

    const run = async () => {
      setLoading(true);
      try {
        // Step 1 — get a valid signed URL (used for image rendering and "no URL" guard)
        let url = doc.signed_url ?? null;
        if (!url && doc.id) {
          const r = await fetch(`/api/documents/refresh-url?document_id=${doc.id}`, { credentials: "include" });
          const d = await r.json() as { signed_url?: string };
          url = d.signed_url ?? null;
        }
        if (!cancelled) setSignedUrl(url);

        // Step 2 — desktop PDF: fetch as blob for toolbar-free iframe
        if (!isMobile && url && doc.mime_type === "application/pdf") {
          const res = await fetch(proxyUrl(doc.storage_path), { credentials: "include" });
          if (!cancelled) {
            if (res.ok) {
              const blob = await res.blob();
              objectUrl = URL.createObjectURL(blob);
              setBlobUrl(objectUrl + "#toolbar=0&navpanes=0");
            } else {
              setPdfError("Could not load PDF. Try opening it in a new tab.");
            }
          }
        }

        // Step 3 — DOCX: convert to HTML on the server, render in sandboxed iframe
        if (!cancelled && isDocx(doc.mime_type)) {
          try {
            const res = await fetch(
              `/api/documents/preview-html?path=${encodeURIComponent(doc.storage_path)}`,
              { credentials: "include" },
            );
            if (!cancelled) {
              if (res.ok) {
                const data = (await res.json()) as { html: string };
                setDocxHtml(data.html);
              } else {
                setDocxError("Could not generate preview.");
              }
            }
          } catch {
            if (!cancelled) setDocxError("Could not generate preview.");
          }
        }
      } catch {
        if (!cancelled) setPdfError("Could not load PDF. Try opening it in a new tab.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void run();
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [doc.id, doc.signed_url, doc.storage_path, doc.mime_type, isMobile]);

  const fileUrl = proxyUrl(doc.storage_path);

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent
        aria-describedby={undefined}
        showClose={false}
        className={cn(
          "flex flex-col p-0 overflow-hidden",
          isMobile
            ? "w-screen h-dvh max-w-none rounded-none border-0 translate-x-0 translate-y-0 left-0 top-0 inset-0"
            : "w-[95vw] max-w-4xl h-[90dvh]",
        )}
      >
        {/* ── Header ─────────────────────────────────────────────────────── */}
        <DialogHeader
          className={cn(
            "border-b flex-row items-center gap-2 space-y-0 shrink-0",
            isMobile ? "px-4 py-3" : "px-4 sm:px-5 py-3 sm:py-3.5",
          )}
        >
          <div className={cn("h-8 w-8 rounded-lg flex items-center justify-center shrink-0", mimeColour(doc.mime_type))}>
            <MimeIcon mimeType={doc.mime_type} className="h-4 w-4" />
          </div>
          <div className="flex-1 min-w-0">
            <DialogTitle className="text-sm font-semibold truncate">{doc.label}</DialogTitle>
            {doc.appName && <p className="text-xs text-muted-foreground truncate">From: {doc.appName}</p>}
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-1 shrink-0">
            {onAnnotate && doc.mime_type === "application/pdf" && (
              <button
                type="button"
                onClick={() => { onClose(); onAnnotate(); }}
                title="Annotate — add sticky notes"
                className="inline-flex items-center justify-center h-9 w-9 rounded-lg hover:bg-muted text-muted-foreground hover:text-[#99462a] transition-colors"
              >
                <StickyNote className="h-4 w-4" />
                <span className="sr-only">Annotate</span>
              </button>
            )}
            <a
              href={fileUrl}
              download={doc.original_name ?? doc.label ?? "document"}
              title="Download"
              className="inline-flex items-center justify-center h-9 w-9 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
            >
              <Download className="h-4 w-4" />
              <span className="sr-only">Download</span>
            </a>
            <a
              href={fileUrl}
              target="_blank"
              rel="noopener noreferrer"
              title="Open in new tab"
              className="inline-flex items-center justify-center h-9 w-9 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
            >
              <ExternalLink className="h-4 w-4" />
              <span className="sr-only">Open in new tab</span>
            </a>
            <button
              type="button"
              onClick={onClose}
              className="inline-flex items-center justify-center h-9 w-9 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
              title="Close"
            >
              <X className="h-4 w-4" />
              <span className="sr-only">Close</span>
            </button>
          </div>
        </DialogHeader>

        {/* ── Body ───────────────────────────────────────────────────────── */}
        <div className="flex-1 overflow-hidden min-h-0 flex flex-col">

          {/* Loading */}
          {loading && (
            <div className="flex items-center justify-center flex-1">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          )}

          {/* No signed URL — shown only for types that need one (not PDF blob path, not DOCX proxy path) */}
          {!loading && !signedUrl && doc.mime_type !== "application/pdf" && !isDocx(doc.mime_type) && (
            <div className="flex flex-col items-center justify-center flex-1 gap-3 text-center px-6">
              <Lock className="h-8 w-8 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">Preview not available. File may have expired.</p>
            </div>
          )}

          {/* ── Image ─────────────────────────────────────────────────── */}
          {!loading && signedUrl && doc.mime_type.startsWith("image/") && (
            <div className="flex items-center justify-center flex-1 p-4 overflow-auto">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={fileUrl}
                alt={doc.label}
                className="max-h-full max-w-full object-contain rounded-lg"
              />
            </div>
          )}

          {/* ── PDF ───────────────────────────────────────────────────── */}
          {!loading && doc.mime_type === "application/pdf" && (
            <>
              {/* Mobile: iOS Safari can't render PDFs in iframes — use native browser instead */}
              {isMobile && (
                <div className="flex flex-col items-center justify-center flex-1 gap-5 text-center px-8">
                  <div className="h-20 w-20 rounded-2xl bg-red-50 dark:bg-red-950/40 flex items-center justify-center">
                    <FileText className="h-10 w-10 text-red-500" />
                  </div>
                  <div className="space-y-1.5">
                    <p className="font-semibold text-base text-foreground">
                      {doc.original_name ?? doc.label}
                    </p>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      Tap the button below to open this PDF in your browser&apos;s built-in viewer.
                    </p>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-3 w-full max-w-xs">
                    <a href={fileUrl} target="_blank" rel="noopener noreferrer" className="flex-1">
                      <Button className="w-full gap-2">
                        <ExternalLink className="h-4 w-4" /> Open PDF
                      </Button>
                    </a>
                    <a href={fileUrl} download={doc.original_name ?? doc.label ?? "document"} className="flex-1">
                      <Button variant="outline" className="w-full gap-2">
                        <Download className="h-4 w-4" /> Download
                      </Button>
                    </a>
                  </div>
                </div>
              )}

              {/* Desktop: blob URL in iframe works fine */}
              {!isMobile && blobUrl && (
                <iframe
                  src={blobUrl}
                  title={doc.label}
                  className="w-full flex-1 border-0 bg-white min-h-0"
                />
              )}

              {/* Desktop PDF error */}
              {!isMobile && !blobUrl && pdfError && (
                <div className="flex flex-col items-center justify-center h-64 gap-4 text-center px-6">
                  <File className="h-12 w-12 text-muted-foreground/40" />
                  <div>
                    <p className="text-sm font-medium text-foreground">Unable to load PDF</p>
                    <p className="text-xs text-muted-foreground mt-1">{pdfError}</p>
                  </div>
                  <a href={fileUrl} target="_blank" rel="noopener noreferrer">
                    <Button variant="outline" size="sm" className="gap-2">
                      <ExternalLink className="h-3.5 w-3.5" /> Open in browser
                    </Button>
                  </a>
                </div>
              )}
            </>
          )}

          {/* ── DOCX ──────────────────────────────────────────────────── */}
          {!loading && isDocx(doc.mime_type) && (
            docxHtml ? (
              // Rendered in sandbox="" iframe — no scripts can execute regardless of HTML content
              <iframe
                srcDoc={docxSrcDoc(docxHtml)}
                sandbox=""
                title={doc.label}
                className="w-full flex-1 border-0 min-h-0"
              />
            ) : docxError ? (
              <div className="flex flex-col items-center justify-center flex-1 gap-4 text-center px-6">
                <File className="h-12 w-12 text-muted-foreground/40" />
                <div>
                  <p className="text-sm font-medium text-foreground">Could not preview this document</p>
                  <p className="text-xs text-muted-foreground mt-1">{docxError}</p>
                </div>
                <div className="flex gap-3">
                  <a href={fileUrl} target="_blank" rel="noopener noreferrer">
                    <Button variant="outline" size="sm" className="gap-2">
                      <ExternalLink className="h-3.5 w-3.5" /> Open in browser
                    </Button>
                  </a>
                  <a href={fileUrl} download={doc.original_name ?? doc.label ?? "document"}>
                    <Button variant="outline" size="sm" className="gap-2">
                      <Download className="h-3.5 w-3.5" /> Download
                    </Button>
                  </a>
                </div>
              </div>
            ) : (
              // Should not normally be visible (loading covers this), but safe fallback
              <div className="flex items-center justify-center flex-1">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            )
          )}

          {/* ── Non-previewable files (TXT, etc.) ─────────────────────── */}
          {!loading && signedUrl && !isPreviewable(doc.mime_type) && (
            <div className="flex flex-col items-center justify-center flex-1 gap-4 text-center px-6">
              <File className="h-12 w-12 text-muted-foreground/40" />
              <div>
                <p className="text-sm font-medium text-foreground">{doc.original_name ?? doc.label}</p>
                <p className="text-xs text-muted-foreground mt-1">This file type cannot be previewed inline.</p>
              </div>
              <div className="flex gap-3">
                <a href={fileUrl} target="_blank" rel="noopener noreferrer">
                  <Button variant="outline" size="sm" className="gap-2">
                    <ExternalLink className="h-3.5 w-3.5" /> Open in browser
                  </Button>
                </a>
                <a href={fileUrl} download={doc.original_name ?? doc.label ?? "document"}>
                  <Button variant="outline" size="sm" className="gap-2">
                    <Download className="h-3.5 w-3.5" /> Download
                  </Button>
                </a>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
