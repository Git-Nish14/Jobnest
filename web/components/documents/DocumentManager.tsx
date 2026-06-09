"use client";

import {
  useState, useRef, useCallback, useEffect,
} from "react";
import {
  FileText, Upload, X, Download, Eye, Trash2, RotateCcw,
  Clock, Share2, Link2, CheckCircle2, Loader2,
  ChevronDown, ChevronUp, Plus, StickyNote, TextCursorInput,
  CloudDownload, HardDriveDownload,
} from "lucide-react";
import { DiffDialog } from "./DiffDialog";
import { DocPreviewDialog, mimeColour, MimeIcon } from "./DocPreviewDialog";
import { AnnotationDialog } from "./AnnotationDialog";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import type { ApplicationDocument } from "@/types/application";
import { mimeToLabel } from "@/lib/utils/storage";
import { substituteVariables, extractVariableKeys } from "@/lib/utils/template-helpers";
import { formatDate, formatMonthYear } from "@/lib/utils/date";

// ── Legacy doc type (pre-migration docs stored on job_applications) ──────────
export interface LegacyDoc {
  label: string;
  path: string;
  signedUrl: string;
  mimeType: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface ShareLink {
  id: string;
  token: string;
  expires_at: string;
  view_count: number;
  share_url: string;
  is_expired: boolean;
}

interface DocumentManagerProps {
  applicationId: string;
  initialDocuments?: ApplicationDocument[];
  legacyDocs?: LegacyDoc[];
  /** Application metadata for cover-letter variable substitution */
  applicationCompany?: string;
  applicationPosition?: string;
}

// ── Cover Letter Preview Dialog ───────────────────────────────────────────────

function CoverLetterPreviewDialog({
  doc,
  applicationCompany,
  applicationPosition,
  onClose,
}: {
  doc: ApplicationDocument;
  applicationCompany?: string;
  applicationPosition?: string;
  onClose: () => void;
}) {
  const [text,    setText]    = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);
  const [vars,    setVars]    = useState<Record<string, string>>({
    company:  applicationCompany ?? "",
    position: applicationPosition ?? "",
    date:     formatMonthYear(new Date().toISOString()),
  });
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const run = async () => {
      setLoading(true);
      try {
        const res = await fetch(
          `/api/documents?path=${encodeURIComponent(doc.storage_path)}`,
          { credentials: "include" }
        );
        if (!res.ok) { setError("Could not load document text."); return; }
        const raw = await res.text();
        setText(raw);
        // Detect additional variable keys and add them to vars if not already present
        const keys = extractVariableKeys(raw);
        setVars((prev) => {
          const merged = { ...prev };
          for (const k of keys) if (!(k in merged)) merged[k] = "";
          return merged;
        });
      } catch {
        setError("Failed to fetch document.");
      } finally {
        setLoading(false);
      }
    };
    void run();
  }, [doc.storage_path]);

  const preview  = text ? substituteVariables(text, vars) : "";
  const keys     = text ? extractVariableKeys(text) : [];
  const unresolved = keys.filter((k) => !vars[k]);

  const copy = async () => {
    await navigator.clipboard.writeText(preview).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success("Filled cover letter copied to clipboard!");
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent aria-describedby={undefined} className="w-[95vw] max-w-2xl max-h-[90vh] flex flex-col p-0 overflow-hidden">
        <DialogHeader className="px-5 py-3.5 border-b flex-row items-center gap-2 space-y-0 shrink-0">
          <TextCursorInput className="h-4 w-4 text-[#99462a] shrink-0" />
          <div className="flex-1 min-w-0">
            <DialogTitle className="text-sm font-semibold truncate">{doc.label} — Variable preview</DialogTitle>
            <p className="text-xs text-muted-foreground">{keys.length} variable{keys.length !== 1 ? "s" : ""} detected</p>
          </div>
          <button
            type="button"
            onClick={copy}
            disabled={!text || loading}
            className="mr-8 flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold bg-[#99462a] text-white hover:bg-[#7a3620] disabled:opacity-40 transition-colors"
          >
            {copied ? <CheckCircle2 className="h-3 w-3" /> : <Link2 className="h-3 w-3" />}
            {copied ? "Copied!" : "Copy filled text"}
          </button>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto min-h-0">
          {loading && (
            <div className="flex items-center justify-center py-16 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading…
            </div>
          )}
          {error && <p className="p-5 text-sm text-destructive">{error}</p>}

          {!loading && !error && text && (
            <div className="p-5 space-y-4">
              {/* Variable inputs */}
              {keys.length > 0 && (
                <div className="rounded-xl bg-[#f4f3f1] dark:bg-[#1a1a1a] p-4 space-y-3">
                  <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Fill variables</p>
                  <div className="grid grid-cols-2 gap-2">
                    {keys.map((k) => (
                      <div key={k} className="space-y-0.5">
                        <label className="text-[10px] font-semibold text-[#55433d] uppercase tracking-wide flex items-center gap-1">
                          {k}
                          {(k === "company" && applicationCompany) || (k === "position" && applicationPosition)
                            ? <span className="normal-case font-normal text-[#99462a]">(from application)</span>
                            : null}
                        </label>
                        <input
                          type="text"
                          value={vars[k] ?? ""}
                          onChange={(e) => setVars((p) => ({ ...p, [k]: e.target.value }))}
                          placeholder={`{{${k}}}`}
                          className="w-full h-7 px-2 text-xs rounded-lg border border-[#dbc1b9]/50 dark:border-white/10 bg-white dark:bg-[#0a0a0a] focus:outline-none focus:ring-1 focus:ring-[#99462a]/40"
                        />
                      </div>
                    ))}
                  </div>
                  {unresolved.length > 0 && (
                    <p className="text-[10px] text-amber-600 dark:text-amber-400">
                      {unresolved.length} unfilled: {unresolved.map((k) => `{{${k}}}`).join(", ")}
                    </p>
                  )}
                </div>
              )}

              {/* Live preview */}
              <div className="rounded-xl border border-[#dbc1b9]/40 bg-white dark:bg-[#1a1c1b] overflow-hidden">
                <div className="px-4 py-2 border-b border-[#dbc1b9]/20 bg-[#f4f3f1] dark:bg-[#0f0f0f]">
                  <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Preview</span>
                </div>
                <pre className="px-4 py-3 text-sm text-[#1a1c1b] dark:text-[#e0ddd8] whitespace-pre-wrap leading-relaxed font-sans overflow-x-auto">
                  {preview}
                </pre>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Dropbox Import Button ─────────────────────────────────────────────────────

function DropboxImportButton({ onUrl }: { onUrl: (url: string, name: string) => void }) {
  const appKey = process.env.NEXT_PUBLIC_DROPBOX_APP_KEY;

  useEffect(() => {
    if (!appKey || document.getElementById("dropbox-js")) return;
    const s = document.createElement("script");
    s.id = "dropbox-js";
    s.src = "https://www.dropbox.com/static/api/2/dropins.js";
    s.setAttribute("data-app-key", appKey);
    document.head.appendChild(s);
  }, [appKey]);

  const open = () => {
    if (!window.Dropbox) { toast.error("Dropbox SDK not loaded yet. Try again."); return; }
    window.Dropbox.choose({
      success:      (files) => onUrl(files[0].link.replace("dl=0", "dl=1"), files[0].name),
      cancel:       () => {},
      linkType:     "direct",
      multiselect:  false,
      extensions:   [".pdf", ".docx", ".doc", ".txt", ".md", ".png", ".jpg", ".jpeg"],
      folderselect: false,
    });
  };

  if (!appKey) {
    return (
      <button
        type="button"
        disabled
        title="Set NEXT_PUBLIC_DROPBOX_APP_KEY to enable Dropbox import"
        className="flex items-center justify-center gap-1.5 rounded-xl border border-[#dbc1b9]/60 bg-[#f4f3f1] px-3 py-2 text-xs text-[#55433d]/40 cursor-not-allowed"
      >
        <HardDriveDownload className="h-3.5 w-3.5" />
        Dropbox
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={open}
      className="flex items-center justify-center gap-1.5 rounded-xl border border-[#dbc1b9] bg-[#f4f3f1] px-3 py-2 text-xs text-[#55433d] hover:bg-[#faf9f7] hover:border-[#99462a]/40 transition-colors"
      title="Import from Dropbox"
    >
      <HardDriveDownload className="h-3.5 w-3.5" />
      Dropbox
    </button>
  );
}

// ── Google Drive Import Button ────────────────────────────────────────────────

function GoogleDriveImportButton({
  applicationId,
  isMaster,
  label,
  onImported,
}: {
  applicationId?: string;
  isMaster: boolean;
  label: string;
  onImported: () => void;
}) {
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

  const openPicker = async () => {
    if (!clientId || !apiKey) { toast.error("Google Drive is not configured."); return; }
    setLoading(true);
    try {
      await Promise.all([
        loadScript("https://apis.google.com/js/api.js", "gapi-js"),
        loadScript("https://accounts.google.com/gsi/client", "gsi-js"),
      ]);

      // Load picker library
      await new Promise<void>((res) => window.gapi!.load("picker", res));

      // Request OAuth token
      const tokenClient = window.google!.accounts.oauth2.initTokenClient({
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
              if (data.action !== window.google!.picker.Action.PICKED) {
                setLoading(false);
                return;
              }
              const file = data.docs[0];
              try {
                const res = await fetch("/api/documents/import-drive", {
                  method: "POST",
                  credentials: "include",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    file_id:      file.id,
                    access_token: token,
                    file_name:    file.name,
                    mime_type:    file.mimeType,
                    application_id: applicationId ?? null,
                    is_master:    isMaster,
                    label:        label || file.name,
                  }),
                });
                const d = await res.json();
                if (!res.ok) { toast.error(d.error ?? "Drive import failed."); return; }
                toast.success(`"${file.name}" imported from Google Drive.`);
                onImported();
              } finally {
                setLoading(false);
              }
            })
            .build();
          picker.setVisible(true);
        },
      });
      tokenClient.requestAccessToken();
    } catch {
      toast.error("Failed to open Google Drive picker.");
      setLoading(false);
    }
  };

  if (!clientId) {
    return (
      <button
        type="button"
        disabled
        title="Set NEXT_PUBLIC_GOOGLE_CLIENT_ID and NEXT_PUBLIC_GOOGLE_API_KEY to enable Google Drive"
        className="flex items-center justify-center gap-1.5 rounded-xl border border-[#dbc1b9]/60 bg-[#f4f3f1] px-3 py-2 text-xs text-[#55433d]/40 cursor-not-allowed"
      >
        <CloudDownload className="h-3.5 w-3.5" />
        Drive
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={openPicker}
      disabled={loading}
      className="flex items-center justify-center gap-1.5 rounded-xl border border-[#dbc1b9] bg-[#f4f3f1] px-3 py-2 text-xs text-[#55433d] hover:bg-[#faf9f7] hover:border-[#99462a]/40 transition-colors disabled:opacity-50"
      title="Import from Google Drive"
    >
      {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CloudDownload className="h-3.5 w-3.5" />}
      Drive
    </button>
  );
}

// ── Share Dialog ──────────────────────────────────────────────────────────────

function ShareDialog({
  docId,
  onClose,
}: {
  docId: string;
  onClose: () => void;
}) {
  const [links, setLinks]   = useState<ShareLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [expiry, setExpiry] = useState<"1d" | "7d" | "30d">("7d");

  useEffect(() => {
    fetch(`/api/documents/share?document_id=${docId}`, { credentials: "include" })
      .then((r) => r.json())
      .then((d) => { setLinks(d.links ?? []); setLoading(false); })
      .catch(() => setLoading(false));
  }, [docId]);

  const create = async () => {
    setCreating(true);
    try {
      const res = await fetch("/api/documents/share", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ document_id: docId, expires_in: expiry }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error ?? "Failed to create link"); return; }
      setLinks((p) => [{ ...data.link, share_url: data.share_url, is_expired: false }, ...p]);
      await navigator.clipboard.writeText(data.share_url).catch(() => {/* ignore */});
      toast.success("Share link created and copied to clipboard!");
    } finally {
      setCreating(false);
    }
  };

  const revoke = async (linkId: string) => {
    const res = await fetch(`/api/documents/share?link_id=${linkId}`, { method: "DELETE", credentials: "include" });
    if (res.ok) setLinks((p) => p.filter((l) => l.id !== linkId));
    else toast.error("Failed to revoke link");
  };

  const copy = async (url: string) => {
    await navigator.clipboard.writeText(url).catch(() => {/* ignore */});
    setCopied(url);
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent aria-describedby={undefined} className="w-[95vw] max-w-lg p-5">
        <DialogHeader>
          <DialogTitle>Share Document</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-xl bg-[#f4f3f1] p-4 space-y-3">
            <p className="text-sm font-medium text-[#1a1c1b]">Create share link</p>
            <div className="flex gap-2 flex-wrap">
              {(["1d", "7d", "30d"] as const).map((e) => (
                <button
                  type="button"
                  key={e}
                  onClick={() => setExpiry(e)}
                  className={`rounded-full px-3 py-1 text-xs font-semibold border transition-colors ${expiry === e ? "bg-[#99462a] dark:bg-[#ccff00] text-white dark:text-black border-[#99462a] dark:border-[#ccff00]" : "bg-[#f4f3f1] dark:bg-[#1a1a1a] text-[#55433d] dark:text-white/55 border-[#dbc1b9] dark:border-white/10"}`}
                >
                  {e === "1d" ? "1 day" : e === "7d" ? "7 days" : "30 days"}
                </button>
              ))}
            </div>
            <Button onClick={create} disabled={creating} size="sm" className="gap-1.5 w-full">
              {creating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Link2 className="h-3.5 w-3.5" />}
              Generate link
            </Button>
          </div>

          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-widest text-[#55433d]/60">Active links</p>
            {loading && <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />}
            {!loading && links.length === 0 && (
              <p className="text-sm text-muted-foreground italic">No links created yet.</p>
            )}
            {links.map((link) => (
              <div key={link.id} className={`rounded-lg border p-3 ${link.is_expired ? "opacity-50" : ""}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-mono text-[#55433d] truncate">{link.share_url}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {link.is_expired ? "Expired" : `Expires ${formatDate(link.expires_at)}`}
                      {" · "}{link.view_count} {link.view_count === 1 ? "view" : "views"}
                    </p>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    {!link.is_expired && (
                      <button
                        type="button"
                        onClick={() => copy(link.share_url)}
                        className="rounded-md p-1.5 hover:bg-[#f4f3f1] text-[#55433d] transition-colors"
                        title="Copy link"
                      >
                        {copied === link.share_url ? <CheckCircle2 className="h-4 w-4 text-green-600" /> : <Link2 className="h-4 w-4" />}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => revoke(link.id)}
                      className="rounded-md p-1.5 hover:bg-red-50 text-red-500 transition-colors"
                      title="Revoke link"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Document card ─────────────────────────────────────────────────────────────

function DocumentCard({
  doc,
  versions,
  onDelete,
  onRestore,
  onPurge,
  onRefresh,
  applicationCompany,
  applicationPosition,
}: {
  doc: ApplicationDocument;
  versions: ApplicationDocument[];
  onDelete: (id: string) => void;
  onRestore: (id: string) => void;
  onPurge: (id: string) => Promise<{ bytes_freed: number }>;
  onRefresh: () => void;
  applicationCompany?: string;
  applicationPosition?: string;
}) {
  const [showVersions,  setShowVersions]  = useState(false);
  const [previewOpen,   setPreviewOpen]   = useState(false);
  const [shareOpen,     setShareOpen]     = useState(false);
  const [annotateOpen,  setAnnotateOpen]  = useState(false);
  const [clPreviewOpen, setClPreviewOpen] = useState(false);
  const [purging, setPurging] = useState(false);

  const oldVersions = versions.filter((v) => v.id !== doc.id);
  const signedUrl   = doc.signed_url ?? "";

  const isPdf       = doc.mime_type === "application/pdf";
  const isCoverLike = doc.label.toLowerCase().includes("cover") ||
                      doc.mime_type === "text/plain" ||
                      doc.mime_type === "text/markdown";

  const handlePurge = async () => {
    if (!confirm(`Delete ${oldVersions.length} old version(s)? This cannot be undone.`)) return;
    setPurging(true);
    try {
      const result = await onPurge(doc.id);
      toast.success(`Deleted ${oldVersions.length} old version(s). Freed ${formatBytes(result.bytes_freed)}.`);
      onRefresh();
    } catch {
      toast.error("Failed to purge old versions.");
    } finally {
      setPurging(false);
    }
  };

  return (
    <>
      <div className="rounded-xl border border-[#dbc1b9]/40 bg-[#faf9f7] overflow-hidden">
        {/* Main row */}
        <div className="flex items-center gap-3 p-3">
          <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${mimeColour(doc.mime_type)}`}>
            <MimeIcon mimeType={doc.mime_type} className="h-4 w-4" />
          </div>

          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm text-[#1a1c1b] truncate">{doc.label}</p>
            <p className="text-xs text-[#55433d]/70 truncate">
              {doc.original_name ?? doc.label} · {mimeToLabel(doc.mime_type)} · {formatBytes(doc.size_bytes)}
            </p>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1 shrink-0">
            {signedUrl && (
              <button
                type="button"
                onClick={() => setPreviewOpen(true)}
                className="rounded-md p-1.5 hover:bg-[#f4f3f1] text-[#55433d] transition-colors"
                title="Preview"
              >
                <Eye className="h-4 w-4" />
              </button>
            )}

            {/* Cover letter variable preview */}
            {isCoverLike && (
              <button
                type="button"
                onClick={() => setClPreviewOpen(true)}
                className="rounded-md p-1.5 hover:bg-[#f4f3f1] text-[#55433d] transition-colors"
                title="Preview with variables filled"
              >
                <TextCursorInput className="h-4 w-4" />
              </button>
            )}

            {/* Annotate — PDF only */}
            {isPdf && (
              <button
                type="button"
                onClick={() => setAnnotateOpen(true)}
                className="rounded-md p-1.5 hover:bg-[#f4f3f1] text-[#55433d] hover:text-[#99462a] transition-colors"
                title="Annotate — add sticky notes"
              >
                <StickyNote className="h-4 w-4" />
              </button>
            )}

            {signedUrl && (
              <a
                href={signedUrl}
                download
                title="Download"
                className="rounded-md p-1.5 hover:bg-[#f4f3f1] text-[#55433d] transition-colors inline-flex items-center justify-center"
              >
                <Download className="h-4 w-4" />
                <span className="sr-only">Download</span>
              </a>
            )}
            <button
              type="button"
              onClick={() => setShareOpen(true)}
              className="rounded-md p-1.5 hover:bg-[#f4f3f1] text-[#55433d] transition-colors"
              title="Share"
            >
              <Share2 className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => { if (confirm("Delete this document? This cannot be undone.")) onDelete(doc.id); }}
              className="rounded-md p-1.5 hover:bg-red-50 text-red-500 transition-colors"
              title="Delete"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Version toggle */}
        {oldVersions.length > 0 && (
          <div className="border-t border-[#dbc1b9]/30">
            <button
              type="button"
              onClick={() => setShowVersions((p) => !p)}
              className="w-full flex items-center justify-between px-3 py-2 text-xs text-[#55433d]/70 hover:bg-[#f4f3f1] transition-colors"
            >
              <span className="flex items-center gap-1.5">
                <Clock className="h-3 w-3" />
                {oldVersions.length} older version{oldVersions.length !== 1 ? "s" : ""}
              </span>
              {showVersions ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            </button>

            {showVersions && (
              <div className="border-t border-[#dbc1b9]/20 bg-[#f4f3f1]/50 divide-y divide-[#dbc1b9]/20">
                {oldVersions.map((v) => (
                  <div key={v.id} className="flex items-center gap-2 px-3 py-2">
                    <p className="flex-1 text-xs text-[#55433d]/70 truncate">
                      {v.original_name ?? v.label} · {formatBytes(v.size_bytes)} · {formatDate(v.uploaded_at)}
                    </p>
                    <DiffDialog
                      currentId={doc.id}
                      compareId={v.id}
                      compareLabel={v.original_name ?? v.label}
                      compareDate={v.uploaded_at}
                    />
                    <button
                      type="button"
                      onClick={() => onRestore(v.id)}
                      className="rounded-md p-1.5 hover:bg-[#f4f3f1] text-[#55433d] transition-colors"
                      title="Restore this version"
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => { if (confirm("Delete this version?")) onDelete(v.id); }}
                      className="rounded-md p-1.5 hover:bg-red-50 text-red-500 transition-colors"
                      title="Delete this version"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
                <div className="px-3 py-2">
                  <button
                    type="button"
                    onClick={handlePurge}
                    disabled={purging}
                    className="flex items-center gap-1.5 text-xs text-red-500 hover:text-red-600 disabled:opacity-50"
                  >
                    {purging ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                    Purge all old versions
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {previewOpen && signedUrl && (
        <DocPreviewDialog
          doc={{ ...doc, signed_url: signedUrl }}
          onClose={() => setPreviewOpen(false)}
          onAnnotate={() => setAnnotateOpen(true)}
        />
      )}
      {shareOpen && (
        <ShareDialog docId={doc.id} onClose={() => setShareOpen(false)} />
      )}
      {annotateOpen && isPdf && (
        <AnnotationDialog
          doc={{ ...doc, signed_url: signedUrl || undefined }}
          onClose={() => setAnnotateOpen(false)}
        />
      )}
      {clPreviewOpen && (
        <CoverLetterPreviewDialog
          doc={doc}
          applicationCompany={applicationCompany}
          applicationPosition={applicationPosition}
          onClose={() => setClPreviewOpen(false)}
        />
      )}
    </>
  );
}

// ── Legacy doc card ───────────────────────────────────────────────────────────

function LegacyDocCard({ doc }: { doc: LegacyDoc }) {
  const [previewOpen, setPreviewOpen] = useState(false);

  const canPreview = doc.mimeType === "application/pdf" || doc.mimeType.startsWith("image/");
  const ext = doc.path.split(".").pop()?.toLowerCase() ?? "";

  const syntheticDoc = {
    id: "",
    application_id: null,
    user_id: "",
    label: doc.label,
    storage_path: doc.path,
    mime_type: doc.mimeType,
    size_bytes: 0,
    is_current: true,
    is_master: false,
    uploaded_at: "",
    original_name: doc.label,
    signed_url: doc.signedUrl,
  };

  return (
    <>
      <div className="rounded-xl border border-[#dbc1b9]/40 bg-[#faf9f7] overflow-hidden">
        <div className="flex items-center gap-3 p-3">
          <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${mimeColour(doc.mimeType)}`}>
            <MimeIcon mimeType={doc.mimeType} className="h-4 w-4" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <p className="font-semibold text-sm text-[#1a1c1b] truncate">{doc.label}</p>
              <span className="shrink-0 rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700">Legacy</span>
            </div>
            <p className="text-xs text-[#55433d]/70">{ext.toUpperCase()} · Upload new version to replace</p>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {canPreview && (
              <button type="button" onClick={() => setPreviewOpen(true)} className="rounded-md p-1.5 hover:bg-[#f4f3f1] text-[#55433d] transition-colors" title="Preview">
                <Eye className="h-4 w-4" />
              </button>
            )}
            <a
              href={doc.signedUrl}
              download
              title={`Download ${doc.label}`}
              className="rounded-md p-1.5 hover:bg-[#f4f3f1] text-[#55433d] transition-colors inline-flex items-center justify-center"
            >
              <Download className="h-4 w-4" />
              <span className="sr-only">Download {doc.label}</span>
            </a>
          </div>
        </div>
      </div>

      {previewOpen && (
        <DocPreviewDialog doc={syntheticDoc} onClose={() => setPreviewOpen(false)} />
      )}
    </>
  );
}

// ── Upload Area ───────────────────────────────────────────────────────────────

function UploadArea({
  applicationId,
  onUploaded,
}: {
  applicationId: string;
  onUploaded: () => void;
}) {
  const [label, setLabel]       = useState("Resume");
  const [uploading, setUploading] = useState(false);
  const [importUrl, setImportUrl] = useState("");
  const [importing, setImporting] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const ACCEPTED = ".pdf,.docx,.doc,.txt,.md,.png,.jpg,.jpeg";

  const upload = async (file: File) => {
    if (!label.trim()) { toast.error("Enter a label before uploading."); return; }
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("application_id", applicationId);
      form.append("label", label.trim());
      form.append("is_master", "false");

      const res = await fetch("/api/documents/upload", { method: "POST", credentials: "include", body: form });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error ?? "Upload failed."); return; }
      toast.success(`"${label}" uploaded successfully.`);
      onUploaded();
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const handleImport = async (url?: string, name?: string) => {
    const targetUrl = url ?? importUrl;
    if (!targetUrl.trim() || !label.trim()) { toast.error("Enter a URL and label."); return; }
    setImporting(true);
    try {
      const res = await fetch("/api/documents/import-url", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url:            targetUrl.trim(),
          application_id: applicationId,
          label:          name ? `${label} (${name.split(".").pop()?.toUpperCase()})` : label.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error ?? "Import failed."); return; }
      toast.success(name ? `Imported "${name}" from Dropbox.` : `Imported "${label}" from URL.`);
      setImportUrl("");
      setShowImport(false);
      onUploaded();
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="space-y-3">
      {/* Label input */}
      <div className="flex gap-2">
        <input
          type="text"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Document label (e.g. Resume)"
          maxLength={80}
          className="flex-1 rounded-lg border border-[#dbc1b9]/50 dark:border-white/10 bg-[#f4f3f1] dark:bg-[#1a1a1a] px-3 py-1.5 text-sm text-[#1a1c1b] dark:text-white placeholder:text-[#55433d]/50 dark:placeholder:text-white/25 focus:outline-none focus:ring-2 focus:ring-[#99462a] dark:focus:ring-[#ccff00]/25"
        />
      </div>

      {/* Upload button row */}
      <div className="flex gap-2 flex-wrap">
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="flex-1 flex items-center justify-center gap-2 rounded-xl border-2 border-dashed border-[#dbc1b9] bg-[#f4f3f1] py-3 text-sm text-[#55433d] hover:border-[#99462a] hover:bg-[#faf9f7] transition-colors disabled:opacity-50"
        >
          {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
          {uploading ? "Uploading…" : "Choose file"}
        </button>
        <button
          type="button"
          onClick={() => setShowImport((p) => !p)}
          className="rounded-xl border border-[#dbc1b9] bg-[#f4f3f1] px-3 py-2 text-sm text-[#55433d] hover:bg-[#faf9f7] transition-colors"
          title="Import from URL"
        >
          <Link2 className="h-4 w-4" />
        </button>

        {/* Cloud imports */}
        <DropboxImportButton
          onUrl={(url, name) => handleImport(url, name)}
        />
        <GoogleDriveImportButton
          applicationId={applicationId}
          isMaster={false}
          label={label}
          onImported={onUploaded}
        />
      </div>

      <input
        ref={fileRef}
        type="file"
        accept={ACCEPTED}
        aria-label="Upload document"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (!f) return;
          // Strip extension; fall back to the full filename for dotfiles (e.g. ".gitignore" → ".gitignore")
          const nameWithoutExt = f.name.replace(/\.[^/.]+$/, "") || f.name;
          if (!label.trim() || label === "Resume") setLabel(nameWithoutExt);
          upload(f);
        }}
      />
      <p className="text-xs text-[#55433d]/50">PDF, DOCX, DOC, TXT, MD, PNG, JPEG · max 10 MB</p>

      {/* URL import */}
      {showImport && (
        <div className="flex gap-2">
          <input
            type="url"
            value={importUrl}
            onChange={(e) => setImportUrl(e.target.value)}
            placeholder="https://example.com/resume.pdf"
            className="flex-1 rounded-lg border border-[#dbc1b9]/50 dark:border-white/10 bg-[#f4f3f1] dark:bg-[#1a1a1a] px-3 py-1.5 text-sm text-[#1a1c1b] dark:text-white placeholder:text-[#55433d]/50 dark:placeholder:text-white/25 focus:outline-none focus:ring-2 focus:ring-[#99462a] dark:focus:ring-[#ccff00]/25"
          />
          <Button onClick={() => handleImport()} disabled={importing} size="sm" className="gap-1.5">
            {importing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
            Import
          </Button>
        </div>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function DocumentManager({
  applicationId,
  initialDocuments = [],
  legacyDocs = [],
  applicationCompany,
  applicationPosition,
}: DocumentManagerProps) {
  const [docs, setDocs]       = useState<ApplicationDocument[]>(initialDocuments);
  const [loading, setLoading] = useState(initialDocuments.length === 0);
  const [showUpload, setShowUpload] = useState(false);

  // Skip the first fetch if the parent already pre-loaded documents server-side.
  const skipFirstFetch = useRef(initialDocuments.length > 0);

  const fetchDocs = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/documents/list?application_id=${applicationId}&include_versions=true`,
        { credentials: "include" }
      );
      if (!res.ok) return;
      const data = await res.json();
      setDocs(data.documents ?? []);
    } finally {
      setLoading(false);
    }
  }, [applicationId]);

  useEffect(() => {
    if (skipFirstFetch.current) { skipFirstFetch.current = false; return; }
    fetchDocs();
  }, [fetchDocs]);

  const handleDelete = async (id: string) => {
    const res = await fetch(`/api/documents/${id}`, { method: "DELETE", credentials: "include" });
    if (res.ok) {
      toast.success("Document deleted.");
      await fetchDocs();
    } else {
      const data = await res.json();
      toast.error(data.error ?? "Failed to delete document.");
    }
  };

  const handleRestore = async (id: string) => {
    const res = await fetch(`/api/documents/${id}/restore`, { method: "POST", credentials: "include" });
    if (res.ok) {
      toast.success("Version restored.");
      await fetchDocs();
    } else {
      toast.error("Failed to restore version.");
    }
  };

  const handlePurge = async (id: string): Promise<{ bytes_freed: number }> => {
    const res = await fetch(`/api/documents/${id}/purge-versions`, { method: "POST", credentials: "include" });
    if (!res.ok) throw new Error("Purge failed");
    return res.json();
  };

  const currentDocs = docs.filter((d) => d.is_current);
  const versionsByLabel: Record<string, ApplicationDocument[]> = {};
  docs.forEach((d) => {
    const key = d.label;
    if (!versionsByLabel[key]) versionsByLabel[key] = [];
    versionsByLabel[key].push(d);
  });

  return (
    <section className="db-content-card">
      <div className="flex items-center justify-between mb-4">
        <h2 className="db-headline text-xl font-semibold text-[#1a1c1b]">Documents</h2>
        <button
          type="button"
          onClick={() => setShowUpload((p) => !p)}
          className="flex items-center gap-1.5 rounded-full border border-[#dbc1b9] px-3 py-1.5 text-xs font-semibold text-[#55433d] hover:bg-[#f4f3f1] transition-colors"
        >
          {showUpload ? <X className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
          {showUpload ? "Cancel" : "Add"}
        </button>
      </div>

      {showUpload && (
        <div className="mb-4 p-3 rounded-xl bg-[#f4f3f1] border border-[#dbc1b9]/30">
          <UploadArea
            applicationId={applicationId}
            onUploaded={() => { fetchDocs(); setShowUpload(false); }}
          />
        </div>
      )}

      <div className="space-y-3">
        {loading && (
          <div className="flex items-center gap-2 py-6 justify-center text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span className="text-sm">Loading documents…</span>
          </div>
        )}

        {legacyDocs.map((doc) => (
          <LegacyDocCard key={doc.path} doc={doc} />
        ))}

        {!loading && currentDocs.length === 0 && legacyDocs.length === 0 && (
          <div className="py-8 text-center">
            <FileText className="h-10 w-10 text-muted-foreground mx-auto mb-2 opacity-40" />
            <p className="text-sm text-muted-foreground">No documents uploaded yet.</p>
            <button
              type="button"
              onClick={() => setShowUpload(true)}
              className="mt-2 text-sm font-medium text-[#99462a] hover:underline"
            >
              Upload your first document
            </button>
          </div>
        )}

        {!loading && currentDocs.map((doc) => (
          <DocumentCard
            key={doc.id}
            doc={doc}
            versions={versionsByLabel[doc.label] ?? [doc]}
            onDelete={handleDelete}
            onRestore={handleRestore}
            onPurge={handlePurge}
            onRefresh={fetchDocs}
            applicationCompany={applicationCompany}
            applicationPosition={applicationPosition}
          />
        ))}
      </div>
    </section>
  );
}
