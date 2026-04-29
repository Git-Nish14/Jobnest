"use client";

import { useState, useEffect } from "react";
import {
  Download, ExternalLink, File, FileText, FileImage, Lock, Loader2,
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

// ── Component ─────────────────────────────────────────────────────────────────

export interface DocPreviewDialogProps {
  doc: ApplicationDocument & { appName?: string };
  onClose: () => void;
}

export function DocPreviewDialog({ doc, onClose }: DocPreviewDialogProps) {
  const [signedUrl, setSignedUrl] = useState<string | null>(doc.signed_url ?? null);
  const [blobUrl, setBlobUrl]     = useState<string | null>(null);
  const [loading, setLoading]     = useState(true);
  const [pdfError, setPdfError]   = useState<string | null>(null);

  useEffect(() => {
    // Reset state when the document changes
    setBlobUrl(null);
    setPdfError(null);

    let cancelled = false;
    let objectUrl: string | null = null;

    const run = async () => {
      setLoading(true);
      try {
        // Step 1 — get signed URL (refresh if absent)
        let url = doc.signed_url ?? null;
        if (!url && doc.id) {
          const r = await fetch(`/api/documents/refresh-url?document_id=${doc.id}`, { credentials: "include" });
          const d = await r.json();
          url = d.signed_url ?? null;
        }
        if (!cancelled) setSignedUrl(url);

        // Step 2 — for PDFs fetch blob: URL (CSP blocks external iframe src)
        if (url && doc.mime_type === "application/pdf") {
          const res = await fetch(`/api/documents?path=${encodeURIComponent(doc.storage_path)}`, { credentials: "include" });
          if (!cancelled) {
            if (res.ok) {
              const blob = await res.blob();
              // #toolbar=0&navpanes=0 suppresses Chrome/Edge's native PDF hover-controls overlay
              objectUrl = URL.createObjectURL(blob) + "#toolbar=0&navpanes=0";
              setBlobUrl(objectUrl);
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
  }, [doc.id, doc.signed_url, doc.storage_path, doc.mime_type]);

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent
        aria-describedby={undefined}
        className="w-[95vw] max-w-4xl max-h-[90vh] flex flex-col p-0 overflow-hidden"
      >
        <DialogHeader className="px-5 py-3.5 border-b flex-row items-center gap-3 space-y-0">
          <div className={cn("h-8 w-8 rounded-lg flex items-center justify-center shrink-0", mimeColour(doc.mime_type))}>
            <MimeIcon mimeType={doc.mime_type} className="h-4 w-4" />
          </div>
          <div className="flex-1 min-w-0">
            <DialogTitle className="text-sm font-semibold truncate">{doc.label}</DialogTitle>
            {doc.appName && <p className="text-xs text-muted-foreground">From: {doc.appName}</p>}
          </div>
          {/* mr-8 reserves space for the Radix absolute close button (right-4 ~28px) */}
          {signedUrl && (
            <div className="flex items-center gap-1 shrink-0 mr-8">
              <a
                href={signedUrl}
                download
                title="Download"
                className="inline-flex items-center justify-center h-8 w-8 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
              >
                <Download className="h-4 w-4" />
                <span className="sr-only">Download</span>
              </a>
              <a
                href={signedUrl}
                target="_blank"
                rel="noopener noreferrer"
                title="Open in new tab"
                className="inline-flex items-center justify-center h-8 w-8 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
              >
                <ExternalLink className="h-4 w-4" />
                <span className="sr-only">Open in new tab</span>
              </a>
            </div>
          )}
        </DialogHeader>

        <div className="flex-1 overflow-hidden min-h-0">
          {loading && (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          )}

          {!loading && !signedUrl && (
            <div className="flex flex-col items-center justify-center h-64 gap-3 text-center px-6">
              <Lock className="h-8 w-8 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">Preview not available. File may have expired.</p>
            </div>
          )}

          {!loading && signedUrl && doc.mime_type.startsWith("image/") && (
            <div className="flex items-center justify-center h-full p-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={signedUrl} alt={doc.label} className="max-h-full max-w-full object-contain rounded-lg" />
            </div>
          )}

          {!loading && doc.mime_type === "application/pdf" && (
            blobUrl ? (
              <iframe
                src={blobUrl}
                title={doc.label}
                className="w-full h-full min-h-[60vh] border-0 bg-white"
              />
            ) : pdfError ? (
              <div className="flex flex-col items-center justify-center h-64 gap-4 text-center px-6">
                <File className="h-12 w-12 text-muted-foreground/40" />
                <div>
                  <p className="text-sm font-medium text-foreground">Unable to load PDF</p>
                  <p className="text-xs text-muted-foreground mt-1">{pdfError}</p>
                </div>
                {signedUrl && (
                  <a href={signedUrl} target="_blank" rel="noopener noreferrer">
                    <Button variant="outline" size="sm" className="gap-2">
                      <ExternalLink className="h-3.5 w-3.5" /> Open in browser
                    </Button>
                  </a>
                )}
              </div>
            ) : null
          )}

          {!loading && signedUrl && !isPreviewable(doc.mime_type) && (
            <div className="flex flex-col items-center justify-center h-64 gap-4 text-center px-6">
              <File className="h-12 w-12 text-muted-foreground/40" />
              <div>
                <p className="text-sm font-medium text-foreground">{doc.original_name ?? doc.label}</p>
                <p className="text-xs text-muted-foreground mt-1">This file type cannot be previewed inline.</p>
              </div>
              <a href={signedUrl} target="_blank" rel="noopener noreferrer">
                <Button variant="outline" size="sm" className="gap-2">
                  <ExternalLink className="h-3.5 w-3.5" /> Open in browser
                </Button>
              </a>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
