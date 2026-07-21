"use client";

import { useState } from "react";
import { Trash2, Archive, BookOpen, X } from "lucide-react";
import { toast } from "sonner";

interface Props {
  applicationId: string;
  daysLeft: number;
  purgeAt: string; // ISO
}

export function DocumentPurgeBanner({ applicationId, daysLeft, purgeAt }: Props) {
  const [dismissed, setDismissed] = useState(false);
  const [loading, setLoading] = useState<"retain" | "library" | null>(null);

  if (dismissed) return null;

  const purgeDate = new Date(purgeAt).toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric",
  });

  const handle = async (action: "retain" | "library") => {
    setLoading(action);
    try {
      const res = await fetch(`/api/applications/${applicationId}/retain-documents`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ action }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Request failed");
      }
      toast.success(
        action === "library"
          ? "Documents saved to your library and purge cancelled."
          : "Documents will be kept. Auto-purge cancelled."
      );
      setDismissed(true);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="rounded-xl border border-red-200 dark:border-red-800/40 bg-red-50 dark:bg-red-950/20 px-4 py-3 flex items-start gap-3">
      <Trash2 className="h-4 w-4 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-red-700 dark:text-red-300">
          Documents auto-delete in {daysLeft} day{daysLeft !== 1 ? "s" : ""} ({purgeDate})
        </p>
        <p className="text-xs text-red-600/80 dark:text-red-400/80 mt-0.5">
          Storage files for rejected applications are removed after 30 days. Save or keep them before then.
        </p>
        <div className="flex flex-wrap items-center gap-2 mt-2.5">
          <button
            type="button"
            disabled={loading !== null}
            onClick={() => handle("library")}
            className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 transition-colors"
          >
            <BookOpen className="h-3 w-3" />
            {loading === "library" ? "Saving…" : "Save to library"}
          </button>
          <button
            type="button"
            disabled={loading !== null}
            onClick={() => handle("retain")}
            className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold bg-white dark:bg-white/10 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-700/40 hover:bg-red-50 dark:hover:bg-white/20 disabled:opacity-50 transition-colors"
          >
            <Archive className="h-3 w-3" />
            {loading === "retain" ? "Saving…" : "Keep files"}
          </button>
        </div>
      </div>
      <button
        type="button"
        onClick={() => setDismissed(true)}
        aria-label="Dismiss"
        className="h-9 w-9 flex items-center justify-center rounded-md text-red-400 hover:text-red-600 hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors shrink-0"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
