"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { RefreshCw } from "lucide-react";
import type { IndexStatus } from "@/lib/features/index-status";

interface UsageData {
  cap: { daily: number; used: number; remaining: number };
  plan: "free" | "pro";
  index?: IndexStatus | null;
}

export function UsageSummary() {
  const [data, setData] = useState<UsageData | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const active = useRef(false);
  const controller = useRef<AbortController | null>(null);
  const refresh = useCallback(async () => {
    if (active.current) return;
    active.current = true;
    const current = new AbortController();
    controller.current = current;
    setBusy(true);
    try {
      const response = await fetch("/api/nesta-ai/analytics", { credentials: "include", cache: "no-store", signal: current.signal });
      if (!response.ok) throw new Error("Usage unavailable");
      const result = await response.json();
      if (current.signal.aborted) return;
      setData(result);
      setError(false);
    } catch {
      if (!current.signal.aborted) setError(true);
    } finally {
      if (controller.current === current) {
        active.current = false;
        if (!current.signal.aborted) setBusy(false);
      }
    }
  }, []);
  useEffect(() => {
    void refresh();
    const interval = window.setInterval(() => { if (document.visibilityState === "visible") void refresh(); }, 60_000);
    window.addEventListener("nestai:usage-updated", refresh);
    return () => { clearInterval(interval); window.removeEventListener("nestai:usage-updated", refresh); controller.current?.abort(); active.current = false; };
  }, [refresh]);
  const percent = data ? Math.min(100, Math.max(0, Math.round(data.cap.used / Math.max(1, data.cap.daily) * 100))) : 0;
  const index = data?.index;
  const status = { recent: "Recently updated", stale: "Update due", empty: "Not indexed yet", unavailable: "Status unavailable" };
  return (
    <section className="shrink-0 border-t border-border px-3 py-3 text-xs" aria-label="NESTAi usage and search index">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-semibold text-foreground">Daily AI usage</h2>
        <button type="button" onClick={() => void refresh()} disabled={busy} aria-label="Refresh AI usage" className="flex min-h-11 min-w-11 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50">
          <RefreshCw className={`h-3.5 w-3.5 ${busy ? "animate-spin" : ""}`} aria-hidden="true" />
        </button>
      </div>
      {error ? <p role="status" className="text-muted-foreground">Could not refresh usage. Try again.</p> : !data ? <p role="status" className="text-muted-foreground">Loading usage…</p> : <>
        <p className="mb-2 tabular-nums text-muted-foreground">{data.cap.used.toLocaleString()} / {data.cap.daily.toLocaleString()} tokens</p>
        <div role="progressbar" aria-label="Daily token allowance used" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent} className="h-1.5 overflow-hidden rounded-full bg-muted">
          <div className={`h-full rounded-full ${percent >= 90 ? "bg-destructive" : "bg-primary"}`} style={{ width: `${percent}%` }} />
        </div>
        <p className="mt-1.5 text-muted-foreground">Resets at midnight UTC.</p>
        {data.plan === "pro" && index && <div className="mt-3 rounded-xl border border-border bg-muted/30 p-3">
          <h3 className="font-semibold text-foreground">Search index</h3>
          <p className="mt-1 tabular-nums text-foreground">{index.embeddingCount === null ? "Embedding count unavailable" : `${index.embeddingCount.toLocaleString()} indexed items`}</p>
          <p className="mt-1 text-muted-foreground">{status[index.status]}</p>
          {index.lastUpdatedAt && <p className="mt-1 text-muted-foreground">Latest update: <time dateTime={index.lastUpdatedAt}>{new Date(index.lastUpdatedAt).toLocaleString()}</time></p>}
          {index.status === "empty" && <p className="mt-2 text-muted-foreground">Your job search data is indexed when you chat and during scheduled updates.</p>}
        </div>}
      </>}
    </section>
  );
}
