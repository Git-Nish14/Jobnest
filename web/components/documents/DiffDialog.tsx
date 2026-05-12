"use client";

import { useState } from "react";
import { GitCompare, Loader2, Plus, Minus } from "lucide-react";
import { formatDate as fmtDate } from "@/lib/utils/date";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui";
import { toast } from "sonner";

interface DiffChange {
  value: string;
  added?: boolean;
  removed?: boolean;
}

interface DiffResult {
  base:    { id: string; label: string; name: string | null; uploaded_at: string };
  compare: { id: string; label: string; name: string | null; uploaded_at: string };
  changes: DiffChange[];
  stats:   { added: number; removed: number; unchanged: number };
}

interface DiffDialogProps {
  currentId:  string;
  compareId:  string;
  compareLabel: string;
  compareDate:  string;
}

const formatDate = (iso: string) => fmtDate(iso);

export function DiffDialog({ currentId, compareId, compareLabel, compareDate }: DiffDialogProps) {
  const [open,    setOpen]    = useState(false);
  const [loading, setLoading] = useState(false);
  const [result,  setResult]  = useState<DiffResult | null>(null);

  const handleOpen = async () => {
    setOpen(true);
    if (result) return; // already loaded
    setLoading(true);
    try {
      const res = await fetch("/api/documents/diff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ base_id: currentId, compare_id: compareId }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Diff failed");
      setResult(json.data ?? json);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to compute diff");
      setOpen(false);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={handleOpen}
        className="inline-flex items-center gap-1 text-[10px] font-medium text-blue-600 dark:text-blue-400 hover:underline"
        title="Compare with current version"
      >
        <GitCompare className="h-3 w-3" />
        Compare
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent aria-describedby={undefined} className="max-w-4xl w-[95vw] h-[85vh] flex flex-col overflow-hidden p-0">
          <DialogHeader className="px-5 py-4 border-b border-border shrink-0">
            <DialogTitle className="flex items-center gap-2 text-base">
              <GitCompare className="h-4 w-4 text-[#99462a]" />
              Document Diff
            </DialogTitle>
            {result && (
              <div className="flex items-center gap-4 mt-1">
                <span className="text-xs text-muted-foreground">
                  Current vs <span className="font-medium text-foreground">{compareLabel}</span> ({formatDate(compareDate)})
                </span>
                <div className="flex items-center gap-3 text-[10px]">
                  <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-semibold">
                    <Plus className="h-3 w-3" />{result.stats.added} words added
                  </span>
                  <span className="flex items-center gap-1 text-red-600 dark:text-red-400 font-semibold">
                    <Minus className="h-3 w-3" />{result.stats.removed} words removed
                  </span>
                </div>
              </div>
            )}
          </DialogHeader>

          <div className="flex-1 overflow-y-auto p-5">
            {loading ? (
              <div className="flex flex-col items-center justify-center h-full gap-3">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                <p className="text-sm text-muted-foreground">Extracting text and computing diff…</p>
              </div>
            ) : result ? (
              <div className="rounded-xl border border-border bg-muted/10 p-4">
                <pre className="text-sm leading-relaxed whitespace-pre-wrap font-sans wrap-break-word">
                  {result.changes.map((change, i) => {
                    if (change.added) {
                      return (
                        <mark key={i} className="bg-emerald-100 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300 rounded px-0.5 not-italic">
                          {change.value}
                        </mark>
                      );
                    }
                    if (change.removed) {
                      return (
                        <del key={i} className="bg-red-100 dark:bg-red-950/50 text-red-700 dark:text-red-300 rounded px-0.5 line-through decoration-red-500">
                          {change.value}
                        </del>
                      );
                    }
                    return <span key={i}>{change.value}</span>;
                  })}
                </pre>
              </div>
            ) : null}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
