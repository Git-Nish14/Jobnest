"use client";

import { useState } from "react";
import { FileText, Download, Eye, ExternalLink } from "lucide-react";
import { DocPreviewDialog } from "@/components/documents/DocPreviewDialog";

interface DocumentViewerProps {
  path: string;
  downloadUrl: string;
  title: string;
  type: "resume" | "cover_letter";
}

const TYPE_CONFIG = {
  resume:       { bg: "bg-red-100 dark:bg-red-950/40",  text: "text-red-600 dark:text-red-400",  label: "Resume" },
  cover_letter: { bg: "bg-blue-100 dark:bg-blue-950/40", text: "text-blue-600 dark:text-blue-400", label: "Cover Letter" },
};

export function DocumentViewer({ path, downloadUrl, title, type }: DocumentViewerProps) {
  const [isOpen, setIsOpen] = useState(false);
  // iOS Safari can't render PDFs in iframes — detect once at mount via lazy initializer
  const [canRenderPdf] = useState(() => !/iPad|iPhone|iPod/.test(navigator.userAgent));

  const config = TYPE_CONFIG[type];

  // Construct a synthetic ApplicationDocument for DocPreviewDialog.
  // downloadUrl is always provided so the refresh-url step is never triggered.
  const doc = {
    id: "",
    application_id: null,
    user_id: "",
    label: title,
    storage_path: path,
    mime_type: "application/pdf" as const,
    size_bytes: 0,
    is_current: true,
    is_master: false,
    uploaded_at: "",
    original_name: title,
    signed_url: downloadUrl,
  };

  return (
    <>
      {/* ── Trigger card ── */}
      <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-muted/50 border border-border/50 hover:bg-muted/80 transition-colors group">
        <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${config.bg} ${config.text}`}>
          <FileText className="h-4 w-4" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground truncate">{title}</p>
          <p className="text-xs text-muted-foreground">{config.label} · PDF</p>
        </div>
        <div className="flex items-center gap-1 opacity-60 group-hover:opacity-100 transition-opacity">
          <button
            type="button"
            onClick={() => canRenderPdf ? setIsOpen(true) : window.open(downloadUrl, "_blank")}
            title="Preview"
            className="inline-flex items-center justify-center h-8 w-8 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <Eye className="h-4 w-4" />
            <span className="sr-only">Preview {title}</span>
          </button>
          <a
            href={downloadUrl}
            download
            title="Download"
            className="inline-flex items-center justify-center h-8 w-8 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <Download className="h-4 w-4" />
            <span className="sr-only">Download {title}</span>
          </a>
          <a
            href={downloadUrl}
            target="_blank"
            rel="noopener noreferrer"
            title="Open in new tab"
            className="inline-flex items-center justify-center h-8 w-8 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <ExternalLink className="h-4 w-4" />
            <span className="sr-only">Open {title} in new tab</span>
          </a>
        </div>
      </div>

      {/* ── Shared preview dialog ── */}
      {isOpen && (
        <DocPreviewDialog doc={doc} onClose={() => setIsOpen(false)} />
      )}
    </>
  );
}
