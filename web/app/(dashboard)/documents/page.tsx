"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  Library, Upload, Search, Loader2,
  Trash2, Download, Eye, Share2,
  Link2, X, CheckCircle2, Plus, ScanSearch,
  ArrowLeft, Lock, HardDriveDownload, CloudDownload,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import type { ApplicationDocument } from "@/types/application";
import { mimeToLabel } from "@/lib/utils/storage";
import { cn } from "@/lib/utils";
import { DocPreviewDialog, mimeColour, MimeIcon } from "@/components/documents/DocPreviewDialog";

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

// ── Extended doc type ──────────────────────────────────────────────────────────

type DocWithMeta = ApplicationDocument;

// ── Filter type ───────────────────────────────────────────────────────────────

type FilterType = "all" | "pdf" | "docx" | "image" | "text";

// ── Page ──────────────────────────────────────────────────────────────────────

export default function DocumentLibraryPage() {
  const searchParams = useSearchParams();
  const fromATS = searchParams.get("from") === "ats";

  const [allDocs, setAllDocs] = useState<DocWithMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterType>("all");
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

  // Fetch ONLY master/library documents — application-specific docs live on their
  // respective application detail pages and must not appear here.
  const fetch_ = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/documents/list?master=true&include_versions=false", { credentials: "include" });
      const data = res.ok ? await res.json() : { documents: [] };
      setAllDocs(data.documents ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetch_(); }, [fetch_]);

  // Filter + search — all docs here are already library-only (master=true)
  const filtered = allDocs.filter((d) => {
    const matchSearch = search === "" || [d.label, d.original_name ?? ""].join(" ").toLowerCase().includes(search.toLowerCase());
    const matchType =
      filter === "all" ||
      (filter === "pdf"   && d.mime_type === "application/pdf") ||
      (filter === "docx"  && (d.mime_type.includes("wordprocessing") || d.mime_type === "application/msword")) ||
      (filter === "image" && d.mime_type.startsWith("image/")) ||
      (filter === "text"  && (d.mime_type === "text/plain" || d.mime_type === "text/markdown"));
    return matchSearch && matchType;
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
          {allDocs.length} document{allDocs.length !== 1 ? "s" : ""} in library
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

          {/* Cloud import row */}
          <div className="flex gap-2 flex-wrap">
            <LibraryDropboxButton label={labelInput} onImported={fetch_} />
            <LibraryDriveButton   label={labelInput} onImported={fetch_} />
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
                    <p className="text-xs text-muted-foreground truncate">
                      {doc.original_name ?? doc.label}
                    </p>
                  </div>
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
        <DocPreviewDialog doc={previewDoc} onClose={() => setPreviewDoc(null)} />
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
      <DialogContent aria-describedby={undefined} className="w-[95vw] max-w-md p-5">
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

// ── Library Dropbox import ────────────────────────────────────────────────────

function LibraryDropboxButton({ label, onImported }: { label: string; onImported: () => void }) {
  const appKey   = process.env.NEXT_PUBLIC_DROPBOX_APP_KEY;
  const [importing, setImporting] = useState(false);

  useEffect(() => {
    if (!appKey || document.getElementById("dropbox-js")) return;
    const s = document.createElement("script");
    s.id  = "dropbox-js";
    s.src = "https://www.dropbox.com/static/api/2/dropins.js";
    s.setAttribute("data-app-key", appKey);
    document.head.appendChild(s);
  }, [appKey]);

  const open = async () => {
    if (!window.Dropbox) { toast.error("Dropbox SDK not loaded yet. Try again."); return; }
    window.Dropbox.choose({
      success: async (files) => {
        if (!label.trim()) { toast.error("Enter a label before importing."); return; }
        setImporting(true);
        try {
          const url = files[0].link.replace("dl=0", "dl=1");
          const res = await fetch("/api/documents/import-url", {
            method: "POST", credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ url, label: label.trim(), is_master: true }),
          });
          const data = await res.json();
          if (!res.ok) { toast.error(data.error ?? "Dropbox import failed."); return; }
          toast.success(`"${files[0].name}" imported from Dropbox.`);
          onImported();
        } finally {
          setImporting(false);
        }
      },
      cancel:       () => {},
      linkType:     "direct",
      multiselect:  false,
      extensions:   [".pdf", ".docx", ".doc", ".txt", ".md", ".png", ".jpg", ".jpeg"],
      folderselect: false,
    });
  };

  if (!appKey) {
    return (
      <button type="button" disabled title="Set NEXT_PUBLIC_DROPBOX_APP_KEY to enable Dropbox"
        className="flex items-center gap-1.5 rounded-lg border border-border/50 bg-muted/20 px-3 py-2 text-xs text-muted-foreground/40 cursor-not-allowed">
        <HardDriveDownload className="h-3.5 w-3.5" /> Dropbox (not configured)
      </button>
    );
  }

  return (
    <button type="button" onClick={open} disabled={importing}
      className="flex items-center gap-1.5 rounded-lg border border-border bg-muted/20 px-3 py-2 text-xs text-foreground hover:bg-muted/40 transition-colors disabled:opacity-50">
      {importing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <HardDriveDownload className="h-3.5 w-3.5" />}
      Import from Dropbox
    </button>
  );
}

// ── Library Google Drive import ───────────────────────────────────────────────

function LibraryDriveButton({ label, onImported }: { label: string; onImported: () => void }) {
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
  const apiKey   = process.env.NEXT_PUBLIC_GOOGLE_API_KEY;
  const [loading, setLoading] = useState(false);

  const loadScript = (src: string, id: string) =>
    new Promise<void>((resolve) => {
      if (document.getElementById(id)) { resolve(); return; }
      const s = document.createElement("script");
      s.id = id; s.src = src; s.async = true;
      s.onload = () => resolve();
      document.head.appendChild(s);
    });

  const open = async () => {
    if (!clientId || !apiKey) { toast.error("Google Drive is not configured."); return; }
    if (!label.trim()) { toast.error("Enter a label before importing."); return; }
    setLoading(true);
    try {
      await Promise.all([
        loadScript("https://apis.google.com/js/api.js", "gapi-js"),
        loadScript("https://accounts.google.com/gsi/client", "gsi-js"),
      ]);
      await new Promise<void>((res) => window.gapi!.load("picker", res));

      const tc = window.google!.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope:     "https://www.googleapis.com/auth/drive.file",
        callback:  async (resp) => {
          if (resp.error || !resp.access_token) {
            toast.error("Google Drive authorisation failed.");
            setLoading(false);
            return;
          }
          const token = resp.access_token;
          const picker = new window.google!.picker.PickerBuilder()
            .addView(window.google!.picker.ViewId.DOCS)
            .setOAuthToken(token)
            .setDeveloperKey(apiKey)
            .setCallback(async (data: GooglePickerResponse) => {
              if (data.action !== window.google!.picker.Action.PICKED) { setLoading(false); return; }
              const file = data.docs[0];
              try {
                const res = await fetch("/api/documents/import-drive", {
                  method: "POST", credentials: "include",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    file_id: file.id, access_token: token,
                    file_name: file.name, mime_type: file.mimeType,
                    application_id: null, is_master: true, label: label.trim() || file.name,
                  }),
                });
                const d = await res.json();
                if (!res.ok) { toast.error(d.error ?? "Drive import failed."); return; }
                toast.success(`"${file.name}" imported from Google Drive.`);
                onImported();
              } finally { setLoading(false); }
            })
            .build();
          picker.setVisible(true);
        },
      });
      tc.requestAccessToken();
    } catch {
      toast.error("Failed to open Google Drive picker.");
      setLoading(false);
    }
  };

  if (!clientId) {
    return (
      <button type="button" disabled title="Set NEXT_PUBLIC_GOOGLE_CLIENT_ID and NEXT_PUBLIC_GOOGLE_API_KEY to enable Google Drive"
        className="flex items-center gap-1.5 rounded-lg border border-border/50 bg-muted/20 px-3 py-2 text-xs text-muted-foreground/40 cursor-not-allowed">
        <CloudDownload className="h-3.5 w-3.5" /> Google Drive (not configured)
      </button>
    );
  }

  return (
    <button type="button" onClick={open} disabled={loading}
      className="flex items-center gap-1.5 rounded-lg border border-border bg-muted/20 px-3 py-2 text-xs text-foreground hover:bg-muted/40 transition-colors disabled:opacity-50">
      {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CloudDownload className="h-3.5 w-3.5" />}
      Import from Google Drive
    </button>
  );
}
