"use client";

import { useState, useEffect, useCallback } from "react";
import { Sparkles, Loader2, RefreshCw, CheckSquare, Square, AlertCircle, Pencil } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

interface Props {
  applicationId: string;
  hasJobDescription: boolean;
}

function storageKey(id: string) { return `jobnest_tailoring_${id}`; }

export function TailoringChecklist({ applicationId, hasJobDescription }: Props) {
  const [items, setItems] = useState<string[]>([]);
  const [checked, setChecked] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generated, setGenerated] = useState(false);

  // Restore persisted state on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey(applicationId));
      if (saved) {
        const { items: savedItems, checked: savedChecked } = JSON.parse(saved) as {
          items: string[];
          checked: number[];
        };
        if (Array.isArray(savedItems) && savedItems.length > 0) {
          setItems(savedItems);
          setChecked(new Set(savedChecked ?? []));
          setGenerated(true);
        }
      }
    } catch {
      // ignore parse errors
    }
  }, [applicationId]);

  // Persist whenever items or checked changes
  useEffect(() => {
    if (items.length === 0) return;
    try {
      localStorage.setItem(
        storageKey(applicationId),
        JSON.stringify({ items, checked: [...checked] })
      );
    } catch {
      // ignore storage errors
    }
  }, [applicationId, items, checked]);

  const generate = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/applications/${applicationId}/tailoring-checklist`, {
        method: "POST",
      });
      const data = await res.json() as { items?: string[]; error?: string };
      if (!res.ok) {
        setError(data.error ?? "Failed to generate. Please try again.");
        return;
      }
      setItems(data.items ?? []);
      setChecked(new Set());
      setGenerated(true);
    } catch {
      setError("Request failed. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }, [applicationId]);

  const toggleItem = (i: number) => {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(i)) { next.delete(i); } else { next.add(i); }
      return next;
    });
  };

  const doneCount = checked.size;
  const totalCount = items.length;

  return (
    <section className="db-content-card">
      <div className="flex items-center justify-between mb-4">
        <h2 className="db-headline text-base font-semibold text-foreground flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-[#99462a] dark:text-[#ccff00] shrink-0" />
          Resume Tailoring
        </h2>
        {generated && !loading && (
          <button
            type="button"
            onClick={generate}
            title="Regenerate checklist"
            className="h-7 w-7 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {!hasJobDescription && !generated && (
        <div className="flex flex-col items-center text-center py-4 gap-3">
          <AlertCircle className="h-8 w-8 text-muted-foreground/30" />
          <p className="text-xs text-muted-foreground leading-relaxed">
            Add a job description to generate tailoring tips for this role.
          </p>
          <Link
            href={`/applications/${applicationId}/edit`}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#99462a] dark:text-[#ccff00] hover:underline underline-offset-2"
          >
            <Pencil className="h-3 w-3" />
            Add job description
          </Link>
        </div>
      )}

      {hasJobDescription && !generated && !loading && (
        <div className="flex flex-col items-center text-center py-3 gap-3">
          <p className="text-xs text-muted-foreground leading-relaxed">
            Generate AI-powered tips to tailor your resume for this specific role.
          </p>
          <button
            type="button"
            onClick={generate}
            className="inline-flex items-center gap-1.5 text-xs font-semibold bg-[#99462a] dark:bg-[#ccff00] text-white dark:text-black px-3 py-1.5 rounded-lg hover:opacity-90 transition-opacity"
          >
            <Sparkles className="h-3.5 w-3.5" />
            Generate checklist
          </button>
        </div>
      )}

      {loading && (
        <div className="flex items-center justify-center py-6 gap-2 text-muted-foreground text-xs">
          <Loader2 className="h-4 w-4 animate-spin" />
          Analysing job description…
        </div>
      )}

      {error && (
        <p className="text-xs text-destructive bg-destructive/8 border border-destructive/20 rounded-lg px-3 py-2 mt-1">
          {error}
        </p>
      )}

      {generated && items.length > 0 && !loading && (
        <>
          {/* Progress bar */}
          <div className="mb-3">
            <div className="flex items-center justify-between text-[10px] text-muted-foreground mb-1.5">
              <span>{doneCount}/{totalCount} done</span>
              {doneCount === totalCount && (
                <span className="text-emerald-600 dark:text-emerald-400 font-semibold">All complete ✓</span>
              )}
            </div>
            <div className="h-1 w-full rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full bg-[#99462a] dark:bg-[#ccff00] transition-all duration-300"
                style={{ width: totalCount > 0 ? `${(doneCount / totalCount) * 100}%` : "0%" }}
              />
            </div>
          </div>

          {/* Checklist items */}
          <ul className="space-y-2">
            {items.map((item, i) => (
              <li key={i}>
                <button
                  type="button"
                  onClick={() => toggleItem(i)}
                  className={cn(
                    "w-full flex items-start gap-2.5 text-left text-xs rounded-lg px-2 py-1.5 transition-colors",
                    "hover:bg-muted/50",
                    checked.has(i) && "opacity-50"
                  )}
                >
                  {checked.has(i) ? (
                    <CheckSquare className="h-3.5 w-3.5 text-[#99462a] dark:text-[#ccff00] shrink-0 mt-0.5" />
                  ) : (
                    <Square className="h-3.5 w-3.5 text-muted-foreground/50 shrink-0 mt-0.5" />
                  )}
                  <span className={cn("leading-relaxed", checked.has(i) && "line-through")}>
                    {item}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
