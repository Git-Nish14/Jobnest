"use client";

import {
  useState, useRef, useCallback, useEffect,
} from "react";
import {
  FileText, Upload, X, Download, Eye, Trash2, RotateCcw,
  Clock, Share2, Link2, CheckCircle2, AlertCircle, Loader2,
  FileImage, File, ChevronDown, ChevronUp, Plus, ExternalLink,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import type { ApplicationDocument } from "@/types/application";
import { mimeToLabel, isPreviewable } from "@/lib/utils/storage";

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

function MimeIcon({ mimeType, className = "h-5 w-5" }: { mimeType: string; className?: string }) {
  if (mimeType.startsWith("image/")) return <FileImage className={className} />;
  if (mimeType === "application/pdf") return <FileText className={className} />;
  return <File className={className} />;
}

function mimeColour(mimeType: string): string {
  if (mimeType === "application/pdf")  return "bg-red-100 text-red-600";
  if (mimeType.includes("wordprocessing") || mimeType === "application/msword")
    return "bg-blue-100 text-blue-600";
  if (mimeType.startsWith("image/"))   return "bg-purple-100 text-purple-600";
  if (mimeType === "text/plain" || mimeType === "text/markdown")
    return "bg-green-100 text-green-600";
  return "bg-[#dbc1b9]/40 text-[#55433d]";
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
  /** Docs stored on job_applications.resume_path / cover_letter_path (pre-migration) */
  legacyDocs?: LegacyDoc[];
}

// ── Sub-components ────────────────────────────────────────────────────────────

function PreviewDialog({
  doc,
  signedUrl,
  onClose,
}: {
  doc: ApplicationDocument;
  signedUrl: string;
  onClose: () => void;
}) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);

  useEffect(() => {
    if (!isPreviewable(doc.mime_type)) { setLoading(false); return; }
    fetch(`/api/documents?path=${encodeURIComponent(doc.storage_path)}`, { credentials: "include" })
      .then((r) => { if (!r.ok) throw new Error("Failed to load"); return r.blob(); })
      .then((blob) => { setBlobUrl(URL.createObjectURL(blob)); setLoading(false); })
      .catch(() => { setError("Could not load preview."); setLoading(false); });
    return () => { if (blobUrl) URL.revokeObjectURL(blobUrl); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc.storage_path, doc.mime_type]);

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="w-[95vw] max-w-4xl h-[90vh] flex flex-col p-4 gap-3">
        <DialogHeader className="flex-shrink-0">
          <div className="flex items-center justify-between">
            <DialogTitle className="truncate text-base pr-4">{doc.original_name ?? doc.label}</DialogTitle>
            <div className="flex gap-2 shrink-0">
              <a href={signedUrl} target="_blank" rel="noopener noreferrer">
                <Button variant="outline" size="sm" className="gap-1.5 text-xs h-8">
                  <ExternalLink className="h-3.5 w-3.5" /> Open
                </Button>
              </a>
              <a href={signedUrl} download>
                <Button variant="outline" size="sm" className="gap-1.5 text-xs h-8">
                  <Download className="h-3.5 w-3.5" /> Download
                </Button>
              </a>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 min-h-0 rounded-lg border bg-muted/30 flex items-center justify-center overflow-hidden">
          {loading && <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />}
          {error && (
            <div className="text-center p-6">
              <AlertCircle className="h-10 w-10 text-destructive mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">{error}</p>
              <a href={signedUrl} target="_blank" rel="noopener noreferrer">
                <Button className="mt-3 gap-1.5" size="sm"><ExternalLink className="h-3.5 w-3.5" /> Open in browser</Button>
              </a>
            </div>
          )}
          {blobUrl && !loading && !error && (
            doc.mime_type.startsWith("image/")
              /* eslint-disable-next-line @next/next/no-img-element -- blob: URLs cannot be handled by next/image */
              ? <img src={blobUrl} alt={doc.label} className="max-h-full max-w-full object-contain" />
              : <iframe src={blobUrl} className="w-full h-full border-0 bg-white" title={doc.label} />
          )}
          {!isPreviewable(doc.mime_type) && !loading && (
            <div className="text-center p-6">
              <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
              <p className="font-medium">{doc.original_name ?? doc.label}</p>
              <p className="text-sm text-muted-foreground mt-1">Preview not available for {mimeToLabel(doc.mime_type)} files</p>
              <a href={signedUrl} target="_blank" rel="noopener noreferrer">
                <Button className="mt-3 gap-1.5" size="sm"><ExternalLink className="h-3.5 w-3.5" /> Open in browser</Button>
              </a>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

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
      <DialogContent className="w-[95vw] max-w-lg p-5">
        <DialogHeader>
          <DialogTitle>Share Document</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Create new link */}
          <div className="rounded-xl bg-[#f4f3f1] p-4 space-y-3">
            <p className="text-sm font-medium text-[#1a1c1b]">Create share link</p>
            <div className="flex gap-2 flex-wrap">
              {(["1d", "7d", "30d"] as const).map((e) => (
                <button
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

          {/* Existing links */}
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
                      {link.is_expired ? "Expired" : `Expires ${new Date(link.expires_at).toLocaleDateString()}`}
                      {" · "}{link.view_count} {link.view_count === 1 ? "view" : "views"}
                    </p>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    {!link.is_expired && (
                      <button
                        onClick={() => copy(link.share_url)}
                        className="rounded-md p-1.5 hover:bg-[#f4f3f1] text-[#55433d] transition-colors"
                        title="Copy link"
                      >
                        {copied === link.share_url ? <CheckCircle2 className="h-4 w-4 text-green-600" /> : <Link2 className="h-4 w-4" />}
                      </button>
                    )}
                    <button
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
}: {
  doc: ApplicationDocument;
  versions: ApplicationDocument[];
  onDelete: (id: string) => void;
  onRestore: (id: string) => void;
  onPurge: (id: string) => Promise<{ bytes_freed: number }>;
  onRefresh: () => void;
}) {
  const [showVersions, setShowVersions] = useState(false);
  const [previewOpen, setPreviewOpen]   = useState(false);
  const [shareOpen, setShareOpen]       = useState(false);
  const [purging, setPurging]           = useState(false);

  const oldVersions = versions.filter((v) => v.id !== doc.id);
  const signedUrl   = doc.signed_url ?? "";

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
              {doc.original_name ?? "—"} · {mimeToLabel(doc.mime_type)} · {formatBytes(doc.size_bytes)}
            </p>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1 shrink-0">
            {signedUrl && (
              <button
                onClick={() => setPreviewOpen(true)}
                className="rounded-md p-1.5 hover:bg-[#f4f3f1] text-[#55433d] transition-colors"
                title="Preview"
              >
                <Eye className="h-4 w-4" />
              </button>
            )}
            {signedUrl && (
              <a href={signedUrl} download target="_blank" rel="noopener noreferrer">
                <button className="rounded-md p-1.5 hover:bg-[#f4f3f1] text-[#55433d] transition-colors" title="Download">
                  <Download className="h-4 w-4" />
                </button>
              </a>
            )}
            <button
              onClick={() => setShareOpen(true)}
              className="rounded-md p-1.5 hover:bg-[#f4f3f1] text-[#55433d] transition-colors"
              title="Share"
            >
              <Share2 className="h-4 w-4" />
            </button>
            <button
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
                      {v.original_name ?? v.label} · {formatBytes(v.size_bytes)} · {new Date(v.uploaded_at).toLocaleDateString()}
                    </p>
                    <button
                      onClick={() => onRestore(v.id)}
                      className="rounded-md p-1.5 hover:bg-[#f4f3f1] text-[#55433d] transition-colors"
                      title="Restore this version"
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                    </button>
                    <button
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
        <PreviewDialog doc={doc} signedUrl={signedUrl} onClose={() => setPreviewOpen(false)} />
      )}
      {shareOpen && (
        <ShareDialog docId={doc.id} onClose={() => setShareOpen(false)} />
      )}
    </>
  );
}

// ── Legacy doc card (read-only, uses old 3-part storage path) ────────────────

function LegacyDocCard({ doc }: { doc: LegacyDoc }) {
  const [previewOpen, setPreviewOpen] = useState(false);
  const [blobUrl, setBlobUrl]         = useState<string | null>(null);
  const [loading, setLoading]         = useState(false);
  const [error, setError]             = useState<string | null>(null);

  const isPdf   = doc.mimeType === "application/pdf";
  const isImage = doc.mimeType.startsWith("image/");
  const canPreview = isPdf || isImage;

  const openPreview = () => {
    setPreviewOpen(true);
    if (blobUrl || !canPreview) return;
    setLoading(true);
    fetch(`/api/documents?path=${encodeURIComponent(doc.path)}`, { credentials: "include" })
      .then((r) => { if (!r.ok) throw new Error("Failed to load"); return r.blob(); })
      .then((blob) => { setBlobUrl(URL.createObjectURL(blob)); })
      .catch(() => setError("Could not load preview."))
      .finally(() => setLoading(false));
  };

  const handleClose = (open: boolean) => {
    if (!open && blobUrl) { URL.revokeObjectURL(blobUrl); setBlobUrl(null); }
    setPreviewOpen(open);
    if (!open) setError(null);
  };

  const ext = doc.path.split(".").pop()?.toLowerCase() ?? "";

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
              <button type="button" onClick={openPreview} className="rounded-md p-1.5 hover:bg-[#f4f3f1] text-[#55433d] transition-colors" title="Preview">
                <Eye className="h-4 w-4" />
              </button>
            )}
            <a href={doc.signedUrl} download target="_blank" rel="noopener noreferrer" title={`Download ${doc.label}`}>
              <button type="button" title={`Download ${doc.label}`} className="rounded-md p-1.5 hover:bg-[#f4f3f1] text-[#55433d] transition-colors">
                <Download className="h-4 w-4" />
              </button>
            </a>
          </div>
        </div>
      </div>

      {previewOpen && (
        <Dialog open onOpenChange={handleClose}>
          <DialogContent className="w-[95vw] max-w-4xl h-[90vh] flex flex-col p-4 gap-3">
            <DialogHeader className="shrink-0">
              <div className="flex items-center justify-between">
                <DialogTitle className="truncate text-base pr-4">{doc.label}</DialogTitle>
                <div className="flex gap-2 shrink-0">
                  <a href={doc.signedUrl} target="_blank" rel="noopener noreferrer">
                    <Button variant="outline" size="sm" className="gap-1.5 text-xs h-8"><ExternalLink className="h-3.5 w-3.5" /> Open</Button>
                  </a>
                  <a href={doc.signedUrl} download>
                    <Button variant="outline" size="sm" className="gap-1.5 text-xs h-8"><Download className="h-3.5 w-3.5" /> Download</Button>
                  </a>
                </div>
              </div>
            </DialogHeader>
            <div className="flex-1 min-h-0 rounded-lg border bg-muted/30 flex items-center justify-center overflow-hidden">
              {loading && <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />}
              {error && (
                <div className="text-center p-6">
                  <AlertCircle className="h-10 w-10 text-destructive mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">{error}</p>
                  <a href={doc.signedUrl} target="_blank" rel="noopener noreferrer">
                    <Button className="mt-3 gap-1.5" size="sm"><ExternalLink className="h-3.5 w-3.5" /> Open in browser</Button>
                  </a>
                </div>
              )}
              {blobUrl && !loading && !error && (
                isImage
                  /* eslint-disable-next-line @next/next/no-img-element -- blob: URLs cannot be handled by next/image */
                  ? <img src={blobUrl} alt={doc.label} className="max-h-full max-w-full object-contain" />
                  : <iframe src={blobUrl} className="w-full h-full border-0 bg-white" title={doc.label} />
              )}
            </div>
          </DialogContent>
        </Dialog>
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

  const handleImport = async () => {
    if (!importUrl.trim() || !label.trim()) { toast.error("Enter a URL and label."); return; }
    setImporting(true);
    try {
      const res = await fetch("/api/documents/import-url", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: importUrl.trim(), application_id: applicationId, label: label.trim() }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error ?? "Import failed."); return; }
      toast.success(`Imported "${label}" from URL.`);
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

      {/* Upload button */}
      <div className="flex gap-2">
        <button
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="flex-1 flex items-center justify-center gap-2 rounded-xl border-2 border-dashed border-[#dbc1b9] bg-[#f4f3f1] py-3 text-sm text-[#55433d] hover:border-[#99462a] hover:bg-[#faf9f7] transition-colors disabled:opacity-50"
        >
          {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
          {uploading ? "Uploading…" : "Choose file"}
        </button>
        <button
          onClick={() => setShowImport((p) => !p)}
          className="rounded-xl border border-[#dbc1b9] bg-[#f4f3f1] px-3 py-2 text-sm text-[#55433d] hover:bg-[#faf9f7] transition-colors"
          title="Import from URL"
        >
          <Link2 className="h-4 w-4" />
        </button>
      </div>
      <input
        ref={fileRef}
        type="file"
        accept={ACCEPTED}
        className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); }}
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
          <Button onClick={handleImport} disabled={importing} size="sm" className="gap-1.5">
            {importing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
            Import
          </Button>
        </div>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function DocumentManager({ applicationId, initialDocuments = [], legacyDocs = [] }: DocumentManagerProps) {
  const [docs, setDocs]     = useState<ApplicationDocument[]>(initialDocuments);
  const [loading, setLoading] = useState(initialDocuments.length === 0);
  const [showUpload, setShowUpload] = useState(false);

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

  useEffect(() => { fetchDocs(); }, [fetchDocs]);

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

  // Group docs: current versions keyed by label, with all versions attached
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

        {/* Legacy docs (resume_path / cover_letter_path on job_applications) */}
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
          />
        ))}
      </div>
    </section>
  );
}
