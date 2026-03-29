"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  Library, Upload, Search, Loader2, FileText,
  File, FileImage, Trash2, Download, Eye, Share2,
  Link2, X, CheckCircle2, Plus,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import type { ApplicationDocument } from "@/types/application";
import { mimeToLabel } from "@/lib/utils/storage";

export const dynamic = "force-dynamic";

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
  return "bg-green-100 text-green-600";
}

// ── Page component ────────────────────────────────────────────────────────────

type FilterType = "all" | "pdf" | "docx" | "image" | "text";

export default function DocumentLibraryPage() {
  const [allDocs, setAllDocs]   = useState<ApplicationDocument[]>([]);
  const [loading, setLoading]   = useState(true);
  const [search, setSearch]     = useState("");
  const [filter, setFilter]     = useState<FilterType>("all");
  const [uploading, setUploading] = useState(false);
  const [labelInput, setLabelInput] = useState("Master Resume");
  const [showUpload, setShowUpload] = useState(false);
  const [importUrl, setImportUrl]   = useState("");
  const [importing, setImporting]   = useState(false);
  const [shareDocId, setShareDocId] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const totalBytes = allDocs.reduce((s, d) => s + d.size_bytes, 0);

  const fetch_ = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/documents/list?master=true&include_versions=false", { credentials: "include" });
      if (!res.ok) return;
      const data = await res.json();
      setAllDocs(data.documents ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetch_(); }, [fetch_]);

  // Filter + search
  const filtered = allDocs.filter((d) => {
    const matchSearch = search === "" || [d.label, d.original_name ?? ""].join(" ").toLowerCase().includes(search.toLowerCase());
    const matchFilter =
      filter === "all" ||
      (filter === "pdf" && d.mime_type === "application/pdf") ||
      (filter === "docx" && (d.mime_type.includes("wordprocessing") || d.mime_type === "application/msword")) ||
      (filter === "image" && d.mime_type.startsWith("image/")) ||
      (filter === "text" && (d.mime_type === "text/plain" || d.mime_type === "text/markdown"));
    return matchSearch && matchFilter;
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

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this document? This cannot be undone.")) return;
    const res = await fetch(`/api/documents/${id}`, { method: "DELETE", credentials: "include" });
    if (res.ok) { toast.success("Document deleted."); await fetch_(); }
    else toast.error("Failed to delete document.");
  };

  const FILTERS: { key: FilterType; label: string }[] = [
    { key: "all",   label: "All" },
    { key: "pdf",   label: "PDF" },
    { key: "docx",  label: "DOCX" },
    { key: "image", label: "Image" },
    { key: "text",  label: "Text" },
  ];

  return (
    <div>
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 sm:mb-8">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#99462a]/10">
              <Library className="h-5 w-5 text-[#99462a]" />
            </div>
            <h1 className="db-headline text-2xl sm:text-3xl font-semibold text-[#1a1c1b]">Document Library</h1>
          </div>
          <p className="text-sm text-[#55433d]/70 ml-13">
            Master templates you can reuse across all applications
          </p>
        </div>
        <Button onClick={() => setShowUpload((p) => !p)} className="gap-2 shrink-0">
          {showUpload ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
          {showUpload ? "Cancel" : "Add document"}
        </Button>
      </div>

      {/* ── Storage quota widget ── */}
      <div className="db-content-card mb-6 flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="flex-1">
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm font-semibold text-[#1a1c1b]">Library storage</span>
            <span className="text-sm text-[#55433d]">{formatBytes(totalBytes)} used</span>
          </div>
          <div className="h-2 rounded-full bg-[#f4f3f1] overflow-hidden">
            <div
              className="h-full rounded-full bg-[#99462a] transition-all"
              style={{ width: `${Math.min((totalBytes / (50 * 1024 * 1024)) * 100, 100)}%` }}
            />
          </div>
          <p className="text-xs text-[#55433d]/60 mt-1">of 50 MB free · {allDocs.length} document{allDocs.length !== 1 ? "s" : ""}</p>
        </div>
      </div>

      {/* ── Upload panel ── */}
      {showUpload && (
        <div className="db-content-card mb-6 space-y-3">
          <h2 className="db-headline text-lg font-semibold text-[#1a1c1b]">Add to library</h2>
          <input
            type="text"
            value={labelInput}
            onChange={(e) => setLabelInput(e.target.value)}
            placeholder="Label (e.g. Master Resume)"
            maxLength={80}
            className="w-full rounded-lg border border-[#dbc1b9]/50 bg-[#f4f3f1] px-3 py-2 text-sm text-[#1a1c1b] placeholder:text-[#55433d]/50 focus:outline-none focus:ring-2 focus:ring-[#99462a]"
          />
          <div className="flex gap-2">
            <button
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="flex-1 flex items-center justify-center gap-2 rounded-xl border-2 border-dashed border-[#dbc1b9] bg-[#f4f3f1] py-3 text-sm text-[#55433d] hover:border-[#99462a] hover:bg-[#faf9f7] transition-colors disabled:opacity-50"
            >
              {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              {uploading ? "Uploading…" : "Upload file"}
            </button>
          </div>
          <div className="flex gap-2">
            <input
              type="url"
              value={importUrl}
              onChange={(e) => setImportUrl(e.target.value)}
              placeholder="Or import from URL: https://…"
              className="flex-1 rounded-lg border border-[#dbc1b9]/50 bg-[#f4f3f1] px-3 py-2 text-sm text-[#1a1c1b] placeholder:text-[#55433d]/50 focus:outline-none focus:ring-2 focus:ring-[#99462a]"
            />
            <Button onClick={handleImport} disabled={importing} size="sm" className="gap-1.5 shrink-0">
              {importing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Link2 className="h-3.5 w-3.5" />}
              Import
            </Button>
          </div>
          <p className="text-xs text-[#55433d]/50">PDF, DOCX, DOC, TXT, MD, PNG, JPEG · max 10 MB</p>
          <input
            ref={fileRef}
            type="file"
            accept=".pdf,.docx,.doc,.txt,.md,.png,.jpg,.jpeg"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); }}
          />
        </div>
      )}

      {/* ── Search + filter ── */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#55433d]/50 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search documents…"
            className="w-full rounded-lg border border-[#dbc1b9]/50 bg-[#f4f3f1] pl-9 pr-3 py-2 text-sm text-[#1a1c1b] placeholder:text-[#55433d]/50 focus:outline-none focus:ring-2 focus:ring-[#99462a]"
          />
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${filter === f.key ? "bg-[#99462a] text-white" : "bg-[#f4f3f1] text-[#55433d] border border-[#dbc1b9]"}`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Document grid ── */}
      {loading && (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin mr-2" />
          <span>Loading library…</span>
        </div>
      )}

      {!loading && allDocs.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#f4f3f1] mb-4">
            <Library className="h-8 w-8 text-[#55433d]/40" />
          </div>
          <h3 className="db-headline text-lg font-semibold text-[#1a1c1b] mb-2">Library is empty</h3>
          <p className="text-sm text-[#55433d]/70 max-w-xs">
            Upload master templates here and reuse them across all your applications without re-uploading.
          </p>
          <Button onClick={() => setShowUpload(true)} className="mt-4 gap-2">
            <Upload className="h-4 w-4" /> Add your first document
          </Button>
        </div>
      )}

      {!loading && allDocs.length > 0 && filtered.length === 0 && (
        <p className="text-center text-sm text-muted-foreground py-10">No documents match your search or filter.</p>
      )}

      {!loading && filtered.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((doc) => (
            <div
              key={doc.id}
              className="db-content-card hover:shadow-md transition-shadow flex flex-col gap-3"
            >
              {/* Icon + title */}
              <div className="flex items-start gap-3">
                <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${mimeColour(doc.mime_type)}`}>
                  <MimeIcon mimeType={doc.mime_type} className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-[#1a1c1b] truncate">{doc.label}</p>
                  <p className="text-xs text-[#55433d]/60 truncate">{doc.original_name ?? "—"}</p>
                </div>
              </div>

              {/* Meta */}
              <div className="flex gap-3 text-xs text-[#55433d]/70">
                <span className="rounded-full bg-[#f4f3f1] px-2 py-0.5 font-medium">{mimeToLabel(doc.mime_type)}</span>
                <span>{formatBytes(doc.size_bytes)}</span>
                <span className="ml-auto">{new Date(doc.uploaded_at).toLocaleDateString()}</span>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1.5 border-t border-[#dbc1b9]/20 pt-2">
                {doc.signed_url && (
                  <a href={doc.signed_url} target="_blank" rel="noopener noreferrer" title="Preview / open">
                    <button className="rounded-md p-1.5 hover:bg-[#f4f3f1] text-[#55433d] transition-colors">
                      <Eye className="h-4 w-4" />
                    </button>
                  </a>
                )}
                {doc.signed_url && (
                  <a href={doc.signed_url} download title="Download">
                    <button className="rounded-md p-1.5 hover:bg-[#f4f3f1] text-[#55433d] transition-colors">
                      <Download className="h-4 w-4" />
                    </button>
                  </a>
                )}
                <button
                  onClick={() => setShareDocId(doc.id)}
                  className="rounded-md p-1.5 hover:bg-[#f4f3f1] text-[#55433d] transition-colors"
                  title="Share"
                >
                  <Share2 className="h-4 w-4" />
                </button>
                <button
                  onClick={() => handleDelete(doc.id)}
                  className="ml-auto rounded-md p-1.5 hover:bg-red-50 text-red-500 transition-colors"
                  title="Delete"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Share dialog (inline, minimal) */}
      {shareDocId && (
        <ShareDialogInline docId={shareDocId} onClose={() => setShareDocId(null)} />
      )}
    </div>
  );
}

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
      await navigator.clipboard.writeText(data.share_url).catch(() => {/* ignore */});
      toast.success("Link created and copied!");
    } finally {
      setLoading(false);
    }
  };

  const copy = async () => {
    if (!url) return;
    await navigator.clipboard.writeText(url).catch(() => {/* ignore */});
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
              <button key={e} onClick={() => setExpiry(e)}
                className={`rounded-full px-3 py-1 text-xs font-semibold border transition-colors ${expiry === e ? "bg-[#99462a] text-white border-[#99462a]" : "bg-white text-[#55433d] border-[#dbc1b9]"}`}>
                {e === "1d" ? "1 day" : e === "7d" ? "7 days" : "30 days"}
              </button>
            ))}
          </div>
          <Button onClick={create} disabled={loading} className="w-full gap-2">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />}
            Generate link
          </Button>
          {url && (
            <div className="flex gap-2 items-center rounded-lg bg-[#f4f3f1] px-3 py-2">
              <p className="flex-1 text-xs font-mono text-[#55433d] truncate">{url}</p>
              <button onClick={copy} className="shrink-0">
                {copied ? <CheckCircle2 className="h-4 w-4 text-green-600" /> : <Link2 className="h-4 w-4 text-[#55433d]" />}
              </button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
