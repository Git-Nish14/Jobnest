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

function isPreviewable(mimeType: string) {
  return mimeType === "application/pdf" || mimeType.startsWith("image/");
}

// Proxy URL — uses our own domain, not a raw Supabase CDN link.
function proxyUrl(storagePath: string) {
  return `/api/documents?path=${encodeURIComponent(storagePath)}`;
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
  const [loading,   setLoading]   = useState(true);
  const [pdfError,  setPdfError]  = useState<string | null>(null);

  // Detect mobile / iOS where <iframe> PDF rendering doesn't work.
  // Lazy initializer runs only on the client — avoids a second render pass and
  // the wasted blob fetch that would be kicked off before the effect fires.
  const [isMobile] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return /iPhone|iPad|iPod/i.test(navigator.userAgent) || window.innerWidth < 768;
  });

  useEffect(() => {
    setBlobUrl(null);
    setPdfError(null);

    let cancelled = false;
    let objectUrl: string | null = null;

    const run = async () => {
      setLoading(true);
      try {
        // Step 1 — get a valid signed URL (used for loading check only now).
        let url = doc.signed_url ?? null;
        if (!url && doc.id) {
          const r = await fetch(`/api/documents/refresh-url?document_id=${doc.id}`, { credentials: "include" });
          const d = await r.json() as { signed_url?: string };
          url = d.signed_url ?? null;
        }
        if (!cancelled) setSignedUrl(url);

        // Step 2 — fetch blob for desktop PDF iframe.
        // On mobile we skip this entirely: the browser's native PDF handler
        // (triggered by a direct link open) works far better than a blob iframe.
        if (!isMobile && url && doc.mime_type === "application/pdf") {
          const res = await fetch(proxyUrl(doc.storage_path), { credentials: "include" });
          if (!cancelled) {
            if (res.ok) {
              const blob = await res.blob();
              // Store the raw blob URL in objectUrl for correct revocation.
              // The hash fragment (#toolbar=0) is appended only for the iframe src
              // — URL.revokeObjectURL ignores/mishandles fragments so it must receive
              // the bare blob: URL to actually free the memory.
              objectUrl = URL.createObjectURL(blob);
              setBlobUrl(objectUrl + "#toolbar=0&navpanes=0");
            } else {
              setPdfError("Could not load PDF. Try opening it in a new tab.");
            }
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
          // Mobile: true fullscreen so the PDF/image fills the whole screen.
          // Desktop: floating card capped at 4xl / 90dvh.
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
            {/* Download */}
            <a
              href={fileUrl}
              download={doc.original_name ?? doc.label ?? "document"}
              title="Download"
              className="inline-flex items-center justify-center h-9 w-9 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
            >
              <Download className="h-4 w-4" />
              <span className="sr-only">Download</span>
            </a>
            {/* Open in browser */}
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
            {/* Close — always visible; replaces Radix's absolute button on mobile */}
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

          {/* No URL available */}
          {!loading && !signedUrl && doc.mime_type !== "application/pdf" && (
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
                    <a
                      href={fileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1"
                    >
                      <Button className="w-full gap-2">
                        <ExternalLink className="h-4 w-4" /> Open PDF
                      </Button>
                    </a>
                    <a
                      href={fileUrl}
                      download={doc.original_name ?? doc.label ?? "document"}
                      className="flex-1"
                    >
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

          {/* ── Non-previewable files (DOCX, TXT, etc.) ───────────────── */}
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
