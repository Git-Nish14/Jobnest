"use client";

import { useState, useCallback, useRef, useMemo } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Trash2, RefreshCw, Download, X, ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { ApplicationCard } from "./application-card";
import type { JobApplication } from "@/types";
import { APPLICATION_STATUSES } from "@/config/constants";
import type { ApplicationStatus } from "@/config/constants";
import { cn } from "@/lib/utils";

interface Props {
  applications: JobApplication[];
  total: number;
  currentPage: number;
  totalPages: number;
  pageSize: number;
}

type PaginationItem = number | "ellipsis-left" | "ellipsis-right";

export function getPaginationItems(currentPage: number, totalPages: number): PaginationItem[] {
  if (totalPages <= 5) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }

  if (currentPage <= 3) return [1, 2, 3, "ellipsis-right", totalPages];
  if (currentPage >= totalPages - 2) {
    return [1, "ellipsis-left", totalPages - 2, totalPages - 1, totalPages];
  }
  return [1, "ellipsis-left", currentPage, "ellipsis-right", totalPages];
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
  applications,
  total,
  currentPage,
  totalPages,
  pageSize,
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const pageHref = useCallback((page: number) => {
    const params = new URLSearchParams(searchParams.toString());
    if (page <= 1) params.delete("page"); else params.set("page", String(page));
    const query = params.toString();
    return `/applications${query ? `?${query}` : ""}`;
  }, [searchParams]);

  const paginationItems = useMemo(
    () => getPaginationItems(currentPage, totalPages),
    [currentPage, totalPages],
  );

  // ── Bulk selection state ───────────────────────────────────────────────────
  const [selected, setSelected]               = useState<Set<string>>(new Set());
  const [bulkLoading, setBulkLoading]         = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const confirmTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const currentIds = useMemo(
    () => new Set(applications.map((a) => a.id)),
    [applications]
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
    setSelected(new Set(applications.map((a) => a.id)));
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

  const bulkExport = () => exportCSV(applications.filter((a) => effectiveSelected.has(a.id)));

  const selectable = effectiveSelected.size > 0;

  return (
    <div>
      {/* ── Bulk actions bar — stacks above the sticky filter bar ── */}
      {selectable && (
        <div className="mb-4 flex flex-wrap items-center gap-2 rounded-xl border border-[#99462a]/30 dark:border-[#ccff00]/30 bg-background px-4 py-2.5 shadow-sm">
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
            onClick={effectiveSelected.size === applications.length ? clearSelection : selectAll}
            disabled={bulkLoading}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
          >
            <RefreshCw className="h-3 w-3" />
            {effectiveSelected.size === applications.length ? "Deselect all" : "Select page"}
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

      {/* ── Count row ── */}
      <p className="text-xs text-muted-foreground mb-3 px-0.5">
        {total} application{total !== 1 ? "s" : ""} · Showing {(currentPage - 1) * pageSize + 1}–{Math.min(currentPage * pageSize, total)}
        {effectiveSelected.size > 0 && (
          <span className="ml-1.5 font-semibold text-[#99462a] dark:text-[#ccff00]">
            · {effectiveSelected.size} selected
          </span>
        )}
      </p>

      {/* ── Cards — tighter gap on mobile, comfortable on desktop ── */}
      <div className={cn("space-y-3 sm:space-y-4", bulkLoading && "pointer-events-none opacity-60")}>
        {applications.map((app) => (
          <ApplicationCard
            key={app.id}
            application={app}
            selectable={true}
            selected={effectiveSelected.has(app.id)}
            onSelect={toggleSelect}
          />
        ))}
      </div>

      {totalPages > 1 && (
        <nav className="mt-8 flex items-center justify-center gap-1" aria-label="Applications pagination">
          {currentPage > 1 ? (
            <Link
              href={pageHref(currentPage - 1)}
              aria-label="Go to previous page"
              className="mr-1 inline-flex h-9 items-center gap-1 rounded-lg border border-border bg-background px-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <ChevronLeft className="h-4 w-4" />
              <span className="hidden sm:inline">Previous</span>
            </Link>
          ) : (
            <span aria-disabled="true" className="mr-1 inline-flex h-9 items-center gap-1 rounded-lg border border-border px-2.5 text-sm text-muted-foreground/40">
              <ChevronLeft className="h-4 w-4" />
              <span className="hidden sm:inline">Previous</span>
            </span>
          )}

          {paginationItems.map((item) => typeof item === "number" ? (
            <Link
              key={item}
              href={pageHref(item)}
              aria-label={`Go to page ${item}`}
              aria-current={item === currentPage ? "page" : undefined}
              className={cn(
                "inline-flex h-9 min-w-9 items-center justify-center rounded-lg px-2 text-sm font-medium transition-colors",
                item === currentPage
                  ? "bg-[#99462a] text-white dark:bg-[#ccff00] dark:text-black"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              {item}
            </Link>
          ) : (
            <span key={item} className="inline-flex h-9 min-w-7 items-center justify-center text-sm text-muted-foreground" aria-hidden="true">…</span>
          ))}

          {currentPage < totalPages ? (
            <Link
              href={pageHref(currentPage + 1)}
              aria-label="Go to next page"
              className="ml-1 inline-flex h-9 items-center gap-1 rounded-lg border border-border bg-background px-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <span className="hidden sm:inline">Next</span>
              <ChevronRight className="h-4 w-4" />
            </Link>
          ) : (
            <span aria-disabled="true" className="ml-1 inline-flex h-9 items-center gap-1 rounded-lg border border-border px-2.5 text-sm text-muted-foreground/40">
              <span className="hidden sm:inline">Next</span>
              <ChevronRight className="h-4 w-4" />
            </span>
          )}
        </nav>
      )}
    </div>
  );
}
