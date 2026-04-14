"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import {
  Library, Upload, Search, Loader2, FileText,
  File, FileImage, Trash2, Download, Eye, Share2,
  Link2, X, CheckCircle2, Plus, ScanSearch,
  ArrowLeft, ExternalLink, Lock,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import type { ApplicationDocument } from "@/types/application";
import { mimeToLabel } from "@/lib/utils/storage";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

// ── Constants ─────────────────────────────────────────────────────────────────

const QUOTA_BYTES = 1 * 1024 * 1024 * 1024; // 1 GB

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

function MimeIcon({ mimeType, className = "h-5 w-5" }: { mimeType: string; className?: string }) {
  if (mimeType.startsWith("image/")) return <FileImage className={className} />;
  if (mimeType === "application/pdf") return <FileText className={className} />;
  return <File className={className} />;
}

function mimeColour(mimeType: string): string {
  if (mimeType === "application/pdf")  return "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400";
  if (mimeType.includes("wordprocessing") || mimeType === "application/msword")
    return "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400";
  if (mimeType.startsWith("image/"))   return "bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-400";
  return "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400";
}

function isPreviewable(mimeType: string) {
  return mimeType === "application/pdf" || mimeType.startsWith("image/");
}

// ── Inline preview popup ──────────────────────────────────────────────────────

function PreviewPopup({
  doc,
  onClose,
}: {
  doc: ApplicationDocument & { appName?: string };
  onClose: () => void;
}) {
  const [signedUrl, setSignedUrl] = useState<string | null>(doc.signed_url ?? null);
  const [loading, setLoading] = useState(!doc.signed_url);

  useEffect(() => {
    if (doc.signed_url) return;
    // loading is already initialised to true when signed_url is absent;
    // no synchronous setState needed here.
    fetch(`/api/documents/refresh-url?document_id=${doc.id}`, { credentials: "include" })
      .then((r) => r.json())
      .then((d) => { if (d.signed_url) setSignedUrl(d.signed_url); })
      .finally(() => setLoading(false));
  }, [doc.id, doc.signed_url]);

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="w-[95vw] max-w-4xl max-h-[90vh] flex flex-col p-0 overflow-hidden">
        <DialogHeader className="px-5 py-3.5 border-b flex-row items-center gap-3 space-y-0">
          <div className={cn("h-8 w-8 rounded-lg flex items-center justify-center shrink-0", mimeColour(doc.mime_type))}>
            <MimeIcon mimeType={doc.mime_type} className="h-4 w-4" />
          </div>
          <div className="flex-1 min-w-0">
            <DialogTitle className="text-sm font-semibold truncate">{doc.label}</DialogTitle>
            {doc.appName && <p className="text-xs text-muted-foreground">From: {doc.appName}</p>}
          </div>
          {signedUrl && (
            <div className="flex items-center gap-1 shrink-0">
              <a href={signedUrl} download title="Download" className="p-1.5 rounded-md hover:bg-muted text-muted-foreground transition-colors">
                <Download className="h-4 w-4" />
              </a>
              <a href={signedUrl} target="_blank" rel="noopener noreferrer" title="Open in new tab" className="p-1.5 rounded-md hover:bg-muted text-muted-foreground transition-colors">
                <ExternalLink className="h-4 w-4" />
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
              <ExternalLink className="h-8 w-8 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">Preview not available. File may have expired.</p>
            </div>
          )}
          {!loading && signedUrl && doc.mime_type.startsWith("image/") && (
            <div className="flex items-center justify-center h-full p-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={signedUrl} alt={doc.label} className="max-h-full max-w-full object-contain rounded-lg" />
            </div>
          )}
          {!loading && signedUrl && doc.mime_type === "application/pdf" && (
            <iframe
              src={signedUrl}
              title={doc.label}
              className="w-full h-full min-h-[60vh]"
              sandbox="allow-scripts allow-same-origin"
            />
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

// ── Extended doc type ──────────────────────────────────────────────────────────

type DocWithMeta = ApplicationDocument & { appName?: string };

// ── Filter type ───────────────────────────────────────────────────────────────

type FilterType = "all" | "pdf" | "docx" | "image" | "text";
type OriginFilter = "all" | "library" | "application";

// ── Page ──────────────────────────────────────────────────────────────────────

export default function DocumentLibraryPage() {
  const searchParams = useSearchParams();
  const fromATS = searchParams.get("from") === "ats";

  const [allDocs, setAllDocs] = useState<DocWithMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterType>("all");
  const [originFilter, setOriginFilter] = useState<OriginFilter>("all");
  const [uploading, setUploading] = useState(false);
  const [labelInput, setLabelInput] = useState("Master Resume");
  const [showUpload, setShowUpload] = useState(false);
  const [importUrl, setImportUrl] = useState("");
  const [importing, setImporting] = useState(false);
  const [shareDocId, setShareDocId] = useState<string | null>(null);
  const [previewDoc, setPreviewDoc] = useState<DocWithMeta | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const quotaBarRef = useRef<HTMLDivElement>(null);

  const totalBytes = allDocs.reduce((s, d) => s + d.size_bytes, 0);
  const quotaPct = Math.min((totalBytes / QUOTA_BYTES) * 100, 100);

  // Set quota bar width imperatively to avoid inline style linter warning
  useEffect(() => {
    if (quotaBarRef.current) {
      quotaBarRef.current.style.width = `${quotaPct.toFixed(2)}%`;
    }
  }, [quotaPct]);

  // Fetch ALL documents (library + application-linked), enrich with app names
  const fetch_ = useCallback(async () => {
    setLoading(true);
    try {
      const supabase = createClient();

      const [docsRes, { data: apps }] = await Promise.all([
        fetch("/api/documents/list?include_versions=false", { credentials: "include" }),
        supabase.from("job_applications").select("id, company"),
      ]);

      const docsData = docsRes.ok ? await docsRes.json() : { documents: [] };

      // Build applicationId → company name map
      const appMap: Record<string, string> = {};
      for (const app of (apps ?? [])) {
        appMap[app.id] = app.company;
      }

      const enriched: DocWithMeta[] = (docsData.documents ?? []).map((d: ApplicationDocument) => ({
        ...d,
        appName: d.application_id ? appMap[d.application_id] : undefined,
      }));

      setAllDocs(enriched);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetch_(); }, [fetch_]);

  // Filter + search
  const filtered = allDocs.filter((d) => {
    const matchSearch = search === "" || [d.label, d.original_name ?? "", d.appName ?? ""].join(" ").toLowerCase().includes(search.toLowerCase());
    const matchType =
      filter === "all" ||
      (filter === "pdf"   && d.mime_type === "application/pdf") ||
      (filter === "docx"  && (d.mime_type.includes("wordprocessing") || d.mime_type === "application/msword")) ||
      (filter === "image" && d.mime_type.startsWith("image/")) ||
      (filter === "text"  && (d.mime_type === "text/plain" || d.mime_type === "text/markdown"));
    const matchOrigin =
      originFilter === "all" ||
      (originFilter === "library"     && !d.application_id) ||
      (originFilter === "application" && !!d.application_id);
    return matchSearch && matchType && matchOrigin;
  });

  const upload = async (file: File) => {
    if (!labelInput.trim()) { toast.error("Enter a label."); return; }
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("label", labelInput.trim());
      form.append("is_master", "true");
      const res = await fetch("/api/documents/upload", { method: "POST", credentials: "include", body: form });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error ?? "Upload failed."); return; }
      toast.success(`"${labelInput}" added to library.`);
      setShowUpload(false);
      await fetch_();
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const handleImport = async () => {
    if (!importUrl.trim() || !labelInput.trim()) { toast.error("Enter a URL and label."); return; }
    setImporting(true);
    try {
      const res = await fetch("/api/documents/import-url", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: importUrl.trim(), label: labelInput.trim(), is_master: true }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error ?? "Import failed."); return; }
      toast.success(`Imported "${labelInput}" from URL.`);
      setImportUrl(""); setShowUpload(false);
      await fetch_();
    } finally {
      setImporting(false);
    }
  };

  // Only library docs can be deleted from this page
  const handleDelete = async (doc: DocWithMeta) => {
    if (doc.application_id) return; // guarded — shouldn't reach here
    if (!confirm(`Delete "${doc.label}"? This cannot be undone.`)) return;
    const res = await fetch(`/api/documents/${doc.id}`, { method: "DELETE", credentials: "include" });
    if (res.ok) { toast.success("Document deleted."); await fetch_(); }
    else toast.error("Failed to delete document.");
  };

  const TYPE_FILTERS: { key: FilterType; label: string }[] = [
    { key: "all", label: "All types" },
    { key: "pdf", label: "PDF" },
    { key: "docx", label: "DOCX" },
    { key: "image", label: "Image" },
    { key: "text", label: "Text" },
  ];

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div>
        {/* Back to ATS — shown when navigated from ATS page, or as a persistent link */}
        <Link
          href="/ats"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-3"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          {fromATS ? "Back to ATS Scanner" : "ATS Scanner"}
        </Link>

        <div className="db-page-header">
          <div>
            <h1 className="db-page-title">Document Library</h1>
            <p className="db-page-subtitle">
              Resumes, cover letters, and all application documents in one place.
            </p>
          </div>
          <Button onClick={() => setShowUpload((p) => !p)} className="gap-2 shrink-0">
            {showUpload ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
            {showUpload ? "Cancel" : "Add document"}
          </Button>
        </div>
      </div>

      {/* ── Storage quota ── */}
      <div className="db-content-card">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-semibold text-foreground">Storage</span>
          <span className="text-sm text-muted-foreground">{formatBytes(totalBytes)} / 1 GB</span>
        </div>
        <div className="h-2 rounded-full bg-muted overflow-hidden">
          <div
            ref={quotaBarRef}
            className={cn(
              "h-full rounded-full transition-all",
              quotaPct > 90 ? "bg-red-500" : quotaPct > 70 ? "bg-amber-500" : "bg-[#99462a]"
            )}
          />
        </div>
        <p className="text-xs text-muted-foreground mt-1.5">
          {allDocs.length} document{allDocs.length !== 1 ? "s" : ""} ·{" "}
          {allDocs.filter((d) => !d.application_id).length} library ·{" "}
          {allDocs.filter((d) => !!d.application_id).length} from applications
        </p>
      </div>

      {/* ── Upload panel ── */}
      {showUpload && (
        <div className="db-content-card space-y-3">
          <h2 className="text-sm font-semibold text-foreground">Add to library</h2>
          <input
            type="text"
            value={labelInput}
            onChange={(e) => setLabelInput(e.target.value)}
            placeholder="Label (e.g. Master Resume)"
            maxLength={80}
            className="w-full rounded-lg border border-border/50 bg-muted/30 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="w-full flex items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border bg-muted/20 py-4 text-sm text-muted-foreground hover:border-primary/40 hover:bg-primary/5 transition-colors disabled:opacity-50"
          >
            {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            {uploading ? "Uploading & scanning…" : "Upload file"}
          </button>
          <div className="flex gap-2">
            <input
              type="url"
              value={importUrl}
              onChange={(e) => setImportUrl(e.target.value)}
              placeholder="Or import from URL: https://…"
              className="flex-1 rounded-lg border border-border/50 bg-muted/30 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
            <Button onClick={handleImport} disabled={importing} size="sm" className="gap-1.5 shrink-0">
              {importing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Link2 className="h-3.5 w-3.5" />}
              Import
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            PDF, DOCX, DOC, TXT, MD, PNG, JPEG · max 10 MB · virus scanned on upload
          </p>
          <input
            ref={fileRef}
            type="file"
            aria-label="Upload document to library"
            accept=".pdf,.docx,.doc,.txt,.md,.png,.jpg,.jpeg"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); }}
          />
        </div>
      )}

      {/* ── Search + filters ── */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/50 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, label, or application…"
            className="w-full rounded-lg border border-border/50 bg-muted/30 pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1 shrink-0">
          {/* Origin filter */}
          {(["all", "library", "application"] as OriginFilter[]).map((o) => (
            <button
              type="button"
              key={o}
              onClick={() => setOriginFilter(o)}
              className={cn(
                "shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors border",
                originFilter === o ? "bg-primary text-primary-foreground border-primary" : "bg-muted/30 text-muted-foreground border-border/50"
              )}
            >
              {o === "all" ? "All" : o === "library" ? "Library" : "Applications"}
            </button>
          ))}
          <div className="w-px bg-border/50 self-stretch" />
          {/* Type filter */}
          {TYPE_FILTERS.map((f) => (
            <button
              type="button"
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={cn(
                "shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors border",
                filter === f.key ? "bg-foreground text-background border-foreground" : "bg-muted/30 text-muted-foreground border-border/50"
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Loading ── */}
      {loading && (
        <div className="flex items-center justify-center py-20 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin mr-2" />
          Loading documents…
        </div>
      )}

      {/* ── Empty library ── */}
      {!loading && allDocs.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="h-16 w-16 rounded-2xl bg-muted flex items-center justify-center mb-4">
            <Library className="h-8 w-8 text-muted-foreground/40" />
          </div>
          <h3 className="db-headline text-lg font-semibold text-foreground mb-2">No documents yet</h3>
          <p className="text-sm text-muted-foreground max-w-xs leading-relaxed">
            Upload resume templates here or attach documents when adding an application.
          </p>
          <Button onClick={() => setShowUpload(true)} className="mt-5 gap-2">
            <Upload className="h-4 w-4" /> Add your first document
          </Button>
        </div>
      )}

      {/* ── No filter results ── */}
      {!loading && allDocs.length > 0 && filtered.length === 0 && (
        <p className="text-center text-sm text-muted-foreground py-10">No documents match your filters.</p>
      )}

      {/* ── Document grid ── */}
      {!loading && filtered.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((doc) => {
            const isLibrary = !doc.application_id;
            const canDelete = isLibrary;

            return (
              <div
                key={doc.id}
                className="db-content-card hover:shadow-md transition-shadow flex flex-col gap-3"
              >
                {/* Icon + title + origin badge */}
                <div className="flex items-start gap-3">
                  <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl", mimeColour(doc.mime_type))}>
                    <MimeIcon mimeType={doc.mime_type} className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-foreground truncate text-sm">{doc.label}</p>
                    <p className="text-xs text-muted-foreground truncate">{doc.original_name ?? "—"}</p>
                  </div>
                  {/* Origin tag */}
                  {doc.application_id ? (
                    <span className="shrink-0 text-[10px] font-medium rounded-full bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 px-2 py-0.5">
                      {doc.appName ?? "App"}
                    </span>
                  ) : (
                    <span className="shrink-0 text-[10px] font-medium rounded-full bg-muted text-muted-foreground px-2 py-0.5">
                      Library
                    </span>
                  )}
                </div>

                {/* Meta */}
                <div className="flex gap-2 text-xs text-muted-foreground flex-wrap">
                  <span className="rounded-full bg-muted px-2 py-0.5 font-medium">{mimeToLabel(doc.mime_type)}</span>
                  <span>{formatBytes(doc.size_bytes)}</span>
                  <span className="ml-auto">{new Date(doc.uploaded_at).toLocaleDateString()}</span>
                </div>

                {/* Actions ── */}
                <div className="flex items-center gap-1 border-t border-border/20 pt-2">
                  {/* Eye / Preview */}
                  <button
                    type="button"
                    onClick={() => setPreviewDoc(doc)}
                    title="Preview"
                    className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <Eye className="h-4 w-4" />
                  </button>

                  {/* Download */}
                  {doc.signed_url && (
                    <a href={doc.signed_url} download title="Download" className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
                      <Download className="h-4 w-4" />
                    </a>
                  )}

                  {/* Share */}
                  <button
                    type="button"
                    onClick={() => setShareDocId(doc.id)}
                    title="Share"
                    className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <Share2 className="h-4 w-4" />
                  </button>

                  {/* ATS Scan — always available for resume-compatible types */}
                  {(doc.mime_type === "application/pdf" || doc.mime_type.includes("wordprocessing") || doc.mime_type === "application/msword" || doc.mime_type === "text/plain" || doc.mime_type === "text/markdown") && (
                    <Link
                      href={`/ats?doc_id=${doc.id}`}
                      title="Run ATS scan with this document"
                      className="p-1.5 rounded-md hover:bg-[#99462a]/10 text-[#99462a] dark:text-[#ccff00] dark:hover:bg-[#ccff00]/10 transition-colors"
                    >
                      <ScanSearch className="h-4 w-4" />
                    </Link>
                  )}

                  {/* Delete — library only; app docs show a locked indicator */}
                  {canDelete ? (
                    <button
                      type="button"
                      onClick={() => handleDelete(doc)}
                      title="Delete"
                      className="ml-auto p-1.5 rounded-md hover:bg-red-50 dark:hover:bg-red-950 text-red-500 transition-colors"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  ) : (
                    <span
                      title="Manage this document from the application it belongs to"
                      className="ml-auto p-1.5 text-muted-foreground/30"
                    >
                      <Lock className="h-3.5 w-3.5" />
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Preview popup ── */}
      {previewDoc && (
        <PreviewPopup doc={previewDoc} onClose={() => setPreviewDoc(null)} />
      )}

      {/* ── Share dialog ── */}
      {shareDocId && (
        <ShareDialogInline docId={shareDocId} onClose={() => setShareDocId(null)} />
      )}
    </div>
  );
}

// ── Share dialog ──────────────────────────────────────────────────────────────

function ShareDialogInline({ docId, onClose }: { docId: string; onClose: () => void }) {
  const [expiry, setExpiry] = useState<"1d" | "7d" | "30d">("7d");
  const [url, setUrl]       = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const create = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/documents/share", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ document_id: docId, expires_in: expiry }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error ?? "Failed to create link"); return; }
      setUrl(data.share_url);
      await navigator.clipboard.writeText(data.share_url).catch(() => {});
      toast.success("Link created and copied!");
    } finally {
      setLoading(false);
    }
  };

  const copy = async () => {
    if (!url) return;
    await navigator.clipboard.writeText(url).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="w-[95vw] max-w-md p-5">
        <DialogHeader><DialogTitle>Share Document</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="flex gap-2 flex-wrap">
            {(["1d", "7d", "30d"] as const).map((e) => (
              <button type="button" key={e} onClick={() => setExpiry(e)}
                className={cn(
                  "rounded-full px-3 py-1 text-xs font-semibold border transition-colors",
                  expiry === e ? "bg-primary text-primary-foreground border-primary" : "bg-background text-muted-foreground border-border"
                )}>
                {e === "1d" ? "1 day" : e === "7d" ? "7 days" : "30 days"}
              </button>
            ))}
          </div>
          <Button onClick={create} disabled={loading} className="w-full gap-2">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />}
            Generate link
          </Button>
          {url && (
            <div className="flex gap-2 items-center rounded-lg bg-muted px-3 py-2">
              <p className="flex-1 text-xs font-mono text-foreground truncate">{url}</p>
              <button type="button" onClick={copy} className="shrink-0" title="Copy">
                {copied ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <Link2 className="h-4 w-4 text-muted-foreground" />}
              </button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
