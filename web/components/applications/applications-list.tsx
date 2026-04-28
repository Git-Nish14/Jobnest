"use client";

import { useState, useCallback, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Trash2, RefreshCw, Download, X, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { ApplicationCard } from "./application-card";
import type { JobApplication } from "@/types";
import { APPLICATION_STATUSES } from "@/config/constants";
import type { ApplicationStatus } from "@/config/constants";
import { cn } from "@/lib/utils";
import { APPLICATIONS_PAGE_SIZE } from "@/types/api";

interface Filters {
  search?: string;
  status?: string;
  location?: string;
  dateRange?: string;
}

interface Props {
  applications: JobApplication[];
  hasMore?: boolean;
  nextCursor?: string | null;
  filters?: Filters;
}

function exportCSV(apps: JobApplication[]) {
  const cols = ["Company", "Position", "Status", "Applied Date", "Location", "Salary", "Source", "ATS Score", "Job URL"];
  const rows = apps.map((a) => [
    a.company, a.position, a.status, a.applied_date,
    a.location ?? "", a.salary_range ?? "", a.source ?? "",
    a.ats_score != null ? String(a.ats_score) : "", a.job_url ?? "",
  ].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","));
  const csv = [cols.join(","), ...rows].join("\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
  const a = document.createElement("a");
  a.href = url; a.download = "applications-selected.csv"; a.click();
  URL.revokeObjectURL(url);
}

export function ApplicationsList({
  applications: initialApplications,
  hasMore: initialHasMore = false,
  nextCursor: initialCursor = null,
  filters = {},
}: Props) {
  const router = useRouter();

  // ── Cursor pagination state ────────────────────────────────────────────────
  const [extraApps, setExtraApps]       = useState<JobApplication[]>([]);
  const [cursor, setCursor]             = useState<string | null>(initialCursor);
  const [hasMore, setHasMore]           = useState(initialHasMore);
  const [loadingMore, setLoadingMore]   = useState(false);

  // Combined list: server-rendered initial page + client-loaded extras
  const allApps = useMemo(
    () => [...initialApplications, ...extraApps],
    [initialApplications, extraApps]
  );

  const loadMore = useCallback(async () => {
    if (!cursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const supabase = createClient();
      let query = supabase
        .from("job_applications")
        .select("*");

      // Replicate server-side filters on the client
      if (filters.search) {
        query = query.or(`company.ilike.%${filters.search}%,position.ilike.%${filters.search}%`);
      }
      if (filters.status && filters.status !== "all") {
        query = query.eq("status", filters.status);
      }
      if (filters.location) {
        query = query.ilike("location", `%${filters.location}%`);
      }
      if (filters.dateRange && filters.dateRange !== "all") {
        const now = new Date();
        let startDate: Date;
        switch (filters.dateRange) {
          case "today":   startDate = new Date(now); startDate.setHours(0, 0, 0, 0); break;
          case "week":    { startDate = new Date(now); startDate.setDate(now.getDate() - now.getDay()); startDate.setHours(0,0,0,0); break; }
          case "month":   startDate = new Date(now.getFullYear(), now.getMonth(), 1); break;
          case "quarter": startDate = new Date(now); startDate.setMonth(now.getMonth() - 3); break;
          case "year":    startDate = new Date(now.getFullYear(), 0, 1); break;
          default:        startDate = new Date(0);
        }
        query = query.gte("applied_date", startDate.toISOString().split("T")[0]);
      }

      // Decode cursor: base64("applied_date|id")
      const [cursorDate, cursorId] = atob(cursor).split("|");
      if (cursorDate && cursorId) {
        query = query.or(
          `applied_date.lt.${cursorDate},and(applied_date.eq.${cursorDate},id.lt.${cursorId})`
        );
      }

      const { data, error } = await query
        .order("applied_date", { ascending: false })
        .order("id",           { ascending: false })
        .limit(APPLICATIONS_PAGE_SIZE + 1);

      if (error) { toast.error("Failed to load more applications."); return; }

      const rows = (data ?? []) as JobApplication[];
      const nextHasMore = rows.length > APPLICATIONS_PAGE_SIZE;
      const page = nextHasMore ? rows.slice(0, APPLICATIONS_PAGE_SIZE) : rows;

      setExtraApps((prev) => [...prev, ...page]);
      setHasMore(nextHasMore);
      setCursor(nextHasMore
        ? btoa(`${page[page.length - 1].applied_date}|${page[page.length - 1].id}`)
        : null
      );
    } catch {
      toast.error("Failed to load more applications.");
    } finally {
      setLoadingMore(false);
    }
  }, [cursor, loadingMore, filters]);

  // ── Bulk selection state ───────────────────────────────────────────────────
  const [selected, setSelected]               = useState<Set<string>>(new Set());
  const [bulkLoading, setBulkLoading]         = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const confirmTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const currentIds = useMemo(
    () => new Set(allApps.map((a) => a.id)),
    [allApps]
  );
  const effectiveSelected = useMemo(
    () => new Set([...selected].filter((id) => currentIds.has(id))),
    [selected, currentIds]
  );

  const toggleSelect = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) { next.delete(id); } else { next.add(id); }
      return next;
    });
  }, []);

  const selectAll = () => {
    setSelected(new Set(allApps.map((a) => a.id)));
    setConfirmingDelete(false);
    if (confirmTimerRef.current) clearTimeout(confirmTimerRef.current);
  };
  const clearSelection = () => {
    setSelected(new Set());
    setConfirmingDelete(false);
    if (confirmTimerRef.current) clearTimeout(confirmTimerRef.current);
  };

  const handleBulkDeleteClick = () => {
    setConfirmingDelete(true);
    if (confirmTimerRef.current) clearTimeout(confirmTimerRef.current);
    confirmTimerRef.current = setTimeout(() => setConfirmingDelete(false), 4000);
  };

  const bulkDelete = async () => {
    setConfirmingDelete(false);
    if (!effectiveSelected.size) return;
    setBulkLoading(true);
    const supabase = createClient();
    const { error } = await supabase
      .from("job_applications")
      .delete()
      .in("id", [...effectiveSelected]);
    setBulkLoading(false);
    if (error) { toast.error("Failed to delete some applications."); return; }
    toast.success(`Deleted ${effectiveSelected.size} application${effectiveSelected.size > 1 ? "s" : ""}.`);
    clearSelection();
    router.refresh();
  };

  const bulkSetStatus = async (status: ApplicationStatus) => {
    if (!effectiveSelected.size) return;
    setBulkLoading(true);
    const supabase = createClient();
    const { error } = await supabase
      .from("job_applications")
      .update({ status })
      .in("id", [...effectiveSelected]);
    setBulkLoading(false);
    if (error) { toast.error("Failed to update status."); return; }
    toast.success(`Updated ${effectiveSelected.size} application${effectiveSelected.size > 1 ? "s" : ""} to "${status}".`);
    clearSelection();
    router.refresh();
  };

  const bulkExport = () => exportCSV(allApps.filter((a) => effectiveSelected.has(a.id)));

  const selectable = effectiveSelected.size > 0;

  return (
    <div>
      {/* ── Bulk actions bar ── */}
      {selectable && (
        <div className="sticky top-16 z-20 mb-4 flex flex-wrap items-center gap-2 rounded-xl border border-[#99462a]/30 dark:border-[#ccff00]/30 bg-background/95 backdrop-blur px-4 py-2.5 shadow-md">
          <span className="text-xs font-semibold text-foreground mr-1">
            {effectiveSelected.size} selected
          </span>

          {/* Status change — aria-label required for accessibility (no visible label element) */}
          <select
            aria-label="Set status for selected applications"
            disabled={bulkLoading}
            onChange={(e) => { if (e.target.value) bulkSetStatus(e.target.value as ApplicationStatus); e.target.value = ""; }}
            defaultValue=""
            className="text-xs rounded-lg border border-border bg-background px-2 py-1.5 text-muted-foreground focus:outline-none focus:ring-1 focus:ring-[#99462a] dark:focus:ring-[#ccff00] disabled:opacity-50"
          >
            <option value="" disabled>Set status…</option>
            {APPLICATION_STATUSES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>

          {/* Export */}
          <button
            type="button"
            onClick={bulkExport}
            disabled={bulkLoading}
            className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-lg border border-border hover:bg-muted transition-colors disabled:opacity-50"
          >
            <Download className="h-3.5 w-3.5" />
            Export
          </button>

          {/* Delete — two-step confirm */}
          {confirmingDelete ? (
            <button
              type="button"
              onClick={bulkDelete}
              disabled={bulkLoading}
              className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-lg bg-destructive text-destructive-foreground hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Confirm delete {effectiveSelected.size}
            </button>
          ) : (
            <button
              type="button"
              onClick={handleBulkDeleteClick}
              disabled={bulkLoading}
              className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-lg border border-destructive/40 text-destructive hover:bg-destructive/8 transition-colors disabled:opacity-50"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Delete
            </button>
          )}

          <div className="flex-1" />

          <button
            type="button"
            onClick={effectiveSelected.size === allApps.length ? clearSelection : selectAll}
            disabled={bulkLoading}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
          >
            <RefreshCw className="h-3 w-3" />
            {effectiveSelected.size === allApps.length ? "Deselect all" : "Select all"}
          </button>
          <button
            type="button"
            onClick={clearSelection}
            disabled={bulkLoading}
            aria-label="Exit selection mode"
            className="h-6 w-6 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* ── Cards ── */}
      <div className={cn("space-y-4", bulkLoading && "pointer-events-none opacity-60")}>
        {allApps.map((app) => (
          <ApplicationCard
            key={app.id}
            application={app}
            selectable={true}
            selected={effectiveSelected.has(app.id)}
            onSelect={toggleSelect}
          />
        ))}
      </div>

      {/* ── Load more ── */}
      {hasMore && (
        <div className="flex justify-center mt-6">
          <button
            type="button"
            onClick={loadMore}
            disabled={loadingMore}
            className="inline-flex items-center gap-2 text-sm font-medium px-5 py-2.5 rounded-xl border border-border hover:bg-muted transition-colors disabled:opacity-50"
          >
            {loadingMore
              ? <><Loader2 className="h-4 w-4 animate-spin" />Loading…</>
              : <>Load more applications</>}
          </button>
        </div>
      )}
    </div>
  );
}
