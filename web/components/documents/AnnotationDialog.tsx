"use client";

import {
  useState, useEffect, useRef, useCallback,
} from "react";
import {
  X, StickyNote, Loader2, Trash2, GripVertical,
} from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import type { ApplicationDocument } from "@/types/application";

// ── Types ─────────────────────────────────────────────────────────────────────

interface Annotation {
  id: string;
  document_id: string;
  page_number: number;
  x_pct: number;
  y_pct: number;
  width_pct: number;
  content: string;
  color: string;
  created_at: string;
  updated_at: string;
}

interface PageDims {
  width: number;
  height: number;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const NOTE_COLORS = [
  { hex: "#fef08a", label: "Yellow" },
  { hex: "#fbcfe8", label: "Pink" },
  { hex: "#bfdbfe", label: "Blue" },
  { hex: "#bbf7d0", label: "Green" },
  { hex: "#e9d5ff", label: "Purple" },
];

// ── Sticky Note ───────────────────────────────────────────────────────────────

function StickyNoteCard({
  ann,
  pageDims,
  onUpdate,
  onDelete,
}: {
  ann: Annotation;
  pageDims: PageDims;
  onUpdate: (id: string, patch: Partial<Annotation>) => void;
  onDelete: (id: string) => void;
}) {
  const [content, setContent]     = useState(ann.content);
  const [color, setColor]         = useState(ann.color);
  const [showColors, setShowColors] = useState(false);
  const [saving, setSaving]       = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const left  = `${(ann.x_pct * 100).toFixed(2)}%`;
  const top   = `${(ann.y_pct * 100).toFixed(2)}%`;
  const width = `${(ann.width_pct * pageDims.width).toFixed(0)}px`;

  // Debounced save on content/color change
  const scheduleSave = useCallback((patch: Partial<Annotation>) => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    setSaving(true);
    saveTimer.current = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/documents/${ann.document_id}/annotations/${ann.id}`,
          {
            method: "PUT",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(patch),
          }
        );
        if (res.ok) onUpdate(ann.id, patch);
      } catch {/* silent */}
      finally { setSaving(false); }
    }, 600);
  }, [ann.document_id, ann.id, onUpdate]);

  const handleContentBlur = () => scheduleSave({ content });
  const handleColorPick = (hex: string) => {
    setColor(hex);
    setShowColors(false);
    scheduleSave({ color: hex });
  };

  // Drag state
  const dragging = useRef<{ startMouseX: number; startMouseY: number; startXPct: number; startYPct: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const onMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).tagName === "TEXTAREA") return;
    e.preventDefault();
    const rect = containerRef.current?.parentElement?.getBoundingClientRect();
    if (!rect) return;
    dragging.current = {
      startMouseX: e.clientX,
      startMouseY: e.clientY,
      startXPct: ann.x_pct,
      startYPct: ann.y_pct,
    };
  };

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!dragging.current || !containerRef.current) return;
      const rect = containerRef.current.parentElement!.getBoundingClientRect();
      const dx = (e.clientX - dragging.current.startMouseX) / rect.width;
      const dy = (e.clientY - dragging.current.startMouseY) / rect.height;
      const newX = Math.max(0, Math.min(0.9, dragging.current.startXPct + dx));
      const newY = Math.max(0, Math.min(0.9, dragging.current.startYPct + dy));
      if (containerRef.current) {
        containerRef.current.style.left = `${(newX * 100).toFixed(2)}%`;
        containerRef.current.style.top  = `${(newY * 100).toFixed(2)}%`;
      }
    };
    const onUp = (e: MouseEvent) => {
      if (!dragging.current || !containerRef.current) return;
      const rect = containerRef.current.parentElement!.getBoundingClientRect();
      const dx = (e.clientX - dragging.current.startMouseX) / rect.width;
      const dy = (e.clientY - dragging.current.startMouseY) / rect.height;
      const newX = Math.max(0, Math.min(0.9, dragging.current.startXPct + dx));
      const newY = Math.max(0, Math.min(0.9, dragging.current.startYPct + dy));
      dragging.current = null;
      onUpdate(ann.id, { x_pct: newX, y_pct: newY });
      fetch(`/api/documents/${ann.document_id}/annotations/${ann.id}`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ x_pct: newX, y_pct: newY }),
      }).catch(() => {/* silent */});
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup",   onUp);
    return () => { window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); };
  }, [ann.document_id, ann.id, onUpdate]);

  return (
    <div
      ref={containerRef}
      className="absolute z-10 rounded-xl shadow-lg overflow-hidden flex flex-col"
      style={{ left, top, width, minHeight: "80px" }}
      onMouseDown={onMouseDown}
    >
      {/* Header bar */}
      <div
        className="flex items-center justify-between px-2 py-1 cursor-grab active:cursor-grabbing select-none"
        style={{ backgroundColor: color }}
      >
        <div className="flex items-center gap-1">
          <GripVertical className="h-3 w-3 opacity-50" />
          {/* Color picker */}
          <div className="relative">
            <button
              type="button"
              onMouseDown={(e) => e.stopPropagation()}
              onClick={() => setShowColors((p) => !p)}
              className="w-3.5 h-3.5 rounded-full border border-black/20"
              style={{ backgroundColor: color }}
              title="Change color"
            />
            {showColors && (
              <div
                className="absolute top-5 left-0 z-20 flex gap-1 p-1.5 rounded-lg bg-white shadow-xl border border-gray-100"
                onMouseDown={(e) => e.stopPropagation()}
              >
                {NOTE_COLORS.map((c) => (
                  <button
                    key={c.hex}
                    type="button"
                    title={c.label}
                    onClick={() => handleColorPick(c.hex)}
                    className="w-4 h-4 rounded-full border-2 transition-transform hover:scale-125"
                    style={{
                      backgroundColor: c.hex,
                      borderColor: color === c.hex ? "#333" : "transparent",
                    }}
                  />
                ))}
              </div>
            )}
          </div>
          {saving && <Loader2 className="h-2.5 w-2.5 animate-spin opacity-50" />}
        </div>
        <button
          type="button"
          onMouseDown={(e) => e.stopPropagation()}
          onClick={() => onDelete(ann.id)}
          className="opacity-50 hover:opacity-100 transition-opacity"
          title="Delete note"
        >
          <X className="h-3 w-3" />
        </button>
      </div>

      {/* Note body */}
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        onBlur={handleContentBlur}
        onMouseDown={(e) => e.stopPropagation()}
        placeholder="Add a note…"
        className="flex-1 resize-none bg-white/90 text-xs text-[#1a1c1b] p-2 focus:outline-none leading-relaxed placeholder:text-black/25 min-h-[60px]"
        rows={3}
      />
    </div>
  );
}

// ── Main Dialog ───────────────────────────────────────────────────────────────

export interface AnnotationDialogProps {
  doc: ApplicationDocument & { signed_url?: string };
  onClose: () => void;
}

export function AnnotationDialog({ doc, onClose }: AnnotationDialogProps) {
  const [numPages,    setNumPages]    = useState(0);
  const [pageDims,    setPageDims]    = useState<PageDims[]>([]);
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [addMode,     setAddMode]     = useState(false);
  const [loading,     setLoading]     = useState(true);
  const [pdfError,    setPdfError]    = useState<string | null>(null);

  const canvasRefs = useRef<(HTMLCanvasElement | null)[]>([]);
  const pdfRef     = useRef<unknown>(null);

  // Load PDF.js and render all pages
  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      setLoading(true);
      try {
        // Get blob URL for the PDF (reuse DocPreviewDialog pattern)
        let url = doc.signed_url ?? null;
        if (!url && doc.id) {
          const r = await fetch(`/api/documents/refresh-url?document_id=${doc.id}`, { credentials: "include" });
          const d = await r.json();
          url = d.signed_url ?? null;
        }
        if (!url) { setPdfError("Could not load PDF."); setLoading(false); return; }

        // Fetch PDF bytes via proxy (same approach as DocPreviewDialog)
        const res = await fetch(`/api/documents?path=${encodeURIComponent(doc.storage_path)}`, { credentials: "include" });
        if (!res.ok) { setPdfError("Could not fetch PDF bytes."); setLoading(false); return; }
        const bytes = await res.arrayBuffer();

        // Dynamic import to keep PDF.js out of the main bundle
        const pdfjsLib = await import("pdfjs-dist");
        pdfjsLib.GlobalWorkerOptions.workerSrc =
          `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

        const pdfDoc = await pdfjsLib.getDocument({ data: bytes }).promise;
        if (cancelled) return;
        pdfRef.current = pdfDoc;
        setNumPages(pdfDoc.numPages);

        const dims: PageDims[] = [];
        for (let i = 1; i <= pdfDoc.numPages; i++) {
          const page    = await pdfDoc.getPage(i);
          const vp      = page.getViewport({ scale: 1.5 });
          dims.push({ width: vp.width, height: vp.height });

          const canvas  = canvasRefs.current[i - 1];
          if (!canvas || cancelled) continue;
          const ctx     = canvas.getContext("2d");
          if (!ctx) continue;
          canvas.width  = vp.width;
          canvas.height = vp.height;
          await page.render({ canvasContext: ctx, viewport: vp, canvas }).promise;
        }
        if (!cancelled) setPageDims(dims);
      } catch (err) {
        if (!cancelled) setPdfError(err instanceof Error ? err.message : "Failed to load PDF.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void run();
    return () => { cancelled = true; };
  }, [doc.id, doc.signed_url, doc.storage_path]);

  // Load annotations
  useEffect(() => {
    fetch(`/api/documents/${doc.id}/annotations`, { credentials: "include" })
      .then((r) => r.json())
      .then((d) => setAnnotations(d.annotations ?? []))
      .catch(() => {/* silent */});
  }, [doc.id]);

  const handlePageClick = async (e: React.MouseEvent<HTMLDivElement>, pageIndex: number) => {
    if (!addMode) return;
    const rect  = e.currentTarget.getBoundingClientRect();
    const x_pct = Math.max(0, Math.min(0.78, (e.clientX - rect.left) / rect.width));
    const y_pct = Math.max(0, Math.min(0.9,  (e.clientY - rect.top)  / rect.height));

    try {
      const res = await fetch(`/api/documents/${doc.id}/annotations`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ page_number: pageIndex + 1, x_pct, y_pct }),
      });
      if (!res.ok) { toast.error("Failed to create note."); return; }
      const data = await res.json();
      setAnnotations((p) => [...p, data.annotation]);
      setAddMode(false);
    } catch {
      toast.error("Failed to create note.");
    }
  };

  const handleUpdate = useCallback((id: string, patch: Partial<Annotation>) => {
    setAnnotations((prev) => prev.map((a) => a.id === id ? { ...a, ...patch } : a));
  }, []);

  const handleDelete = async (id: string) => {
    const ann = annotations.find((a) => a.id === id);
    if (!ann) return;
    const res = await fetch(`/api/documents/${doc.id}/annotations/${id}`, {
      method: "DELETE", credentials: "include",
    });
    if (res.ok) {
      setAnnotations((p) => p.filter((a) => a.id !== id));
      toast.success("Note deleted.");
    } else {
      toast.error("Failed to delete note.");
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent
        aria-describedby={undefined}
        className="w-[95vw] max-w-5xl max-h-[92vh] flex flex-col p-0 overflow-hidden"
      >
        {/* Header */}
        <DialogHeader className="px-5 py-3.5 border-b flex-row items-center gap-3 space-y-0 shrink-0">
          <StickyNote className="h-4 w-4 text-[#99462a] shrink-0" />
          <div className="flex-1 min-w-0">
            <DialogTitle className="text-sm font-semibold truncate">{doc.label}</DialogTitle>
            {numPages > 0 && (
              <p className="text-xs text-muted-foreground">{numPages} page{numPages !== 1 ? "s" : ""} · {annotations.length} note{annotations.length !== 1 ? "s" : ""}</p>
            )}
          </div>
          <div className="flex items-center gap-2 mr-8">
            <button
              type="button"
              onClick={() => setAddMode((p) => !p)}
              className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold border transition-colors ${
                addMode
                  ? "bg-[#99462a] text-white border-[#99462a]"
                  : "bg-[#f4f3f1] text-[#55433d] border-[#dbc1b9] hover:border-[#99462a]"
              }`}
              title={addMode ? "Click anywhere on a page to place a note" : "Enable note placement"}
            >
              <StickyNote className="h-3.5 w-3.5" />
              {addMode ? "Click page to place…" : "Add note"}
            </button>
          </div>
        </DialogHeader>

        {/* Body */}
        <div className="flex-1 overflow-y-auto bg-[#f4f3f1] min-h-0 p-4 space-y-4">
          {loading && (
            <div className="flex items-center justify-center py-20 text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin mr-2" />
              Loading PDF…
            </div>
          )}

          {pdfError && (
            <div className="flex items-center justify-center py-20 text-center text-sm text-muted-foreground">
              {pdfError}
            </div>
          )}

          {!loading && !pdfError && pageDims.map((dims, i) => (
            <div
              key={i}
              className="relative mx-auto shadow-lg rounded-sm overflow-hidden"
              style={{ width: dims.width, maxWidth: "100%" }}
              onClick={(e) => handlePageClick(e, i)}
            >
              {/* Page number badge */}
              <div className="absolute top-1.5 left-2 z-20 rounded-md bg-black/40 px-1.5 py-0.5 text-[10px] font-semibold text-white select-none pointer-events-none">
                {i + 1}
              </div>

              {/* Crosshair cursor when adding */}
              {addMode && (
                <div className="absolute inset-0 z-5 cursor-crosshair" />
              )}

              {/* PDF canvas */}
              <canvas
                ref={(el) => { canvasRefs.current[i] = el; }}
                className="block w-full"
                style={{ height: dims.height, maxWidth: "100%" }}
              />

              {/* Annotation overlay */}
              <div className="absolute inset-0 pointer-events-none">
                {annotations
                  .filter((a) => a.page_number === i + 1)
                  .map((ann) => (
                    <div key={ann.id} className="pointer-events-auto">
                      <StickyNoteCard
                        ann={ann}
                        pageDims={dims}
                        onUpdate={handleUpdate}
                        onDelete={handleDelete}
                      />
                    </div>
                  ))}
              </div>
            </div>
          ))}

          {!loading && !pdfError && annotations.length === 0 && numPages > 0 && (
            <p className="text-center text-xs text-muted-foreground pt-2">
              Click <strong>Add note</strong> then click anywhere on a page to place a sticky note.
            </p>
          )}
        </div>

        {/* Footer: bulk delete */}
        {annotations.length > 0 && (
          <div className="shrink-0 border-t px-5 py-2.5 flex items-center justify-between bg-background">
            <p className="text-xs text-muted-foreground">
              {annotations.length} note{annotations.length !== 1 ? "s" : ""} on this document
            </p>
            <button
              type="button"
              onClick={async () => {
                if (!confirm("Delete all notes on this document? This cannot be undone.")) return;
                await Promise.all(annotations.map((a) =>
                  fetch(`/api/documents/${doc.id}/annotations/${a.id}`, {
                    method: "DELETE", credentials: "include",
                  })
                ));
                setAnnotations([]);
                toast.success("All notes deleted.");
              }}
              className="flex items-center gap-1.5 text-xs text-red-500 hover:text-red-600"
            >
              <Trash2 className="h-3 w-3" />
              Delete all notes
            </button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
