"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  MoreHorizontal, Pencil, Trash2, ExternalLink,
  MapPin, DollarSign, Calendar, ScanSearch, Copy,
  Check, Stamp, Loader2,
} from "lucide-react";
import { toast } from "sonner";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui";
import type { JobApplication } from "@/types";
import { cn } from "@/lib/utils";
import { SOURCE_COLORS } from "@/config/constants";
import type { ApplicationStatus } from "@/config/constants";
import { AtsProviderBadge } from "@/components/ui/brand-icons";
import { formatDate } from "@/lib/utils/date";
import { CompletenessRing } from "./completeness-ring";
import { StatusPicker } from "./status-picker";
import { MobileApplicationCard } from "./mobile-application-card";

// ── Per-status tokens ─────────────────────────────────────────────────────────
// tint: very-low-opacity wash on the card background — the TODO item finally shipped.
// accent: left border colour.
// avatar: reuses existing dashboard.css db-status-* classes for the company initial.
const STATUS_TOKENS: Record<
  string,
  { tint: string; accent: string; avatar: string }
> = {
  "Applied":      { tint: "bg-amber-500/[0.05] dark:bg-amber-500/[0.08]",     accent: "bg-amber-400",    avatar: "db-status-applied" },
  "Phone Screen": { tint: "bg-orange-500/[0.05] dark:bg-orange-500/[0.08]",   accent: "bg-[#99462a]",    avatar: "db-status-phone" },
  "Interview":    { tint: "bg-emerald-500/[0.06] dark:bg-emerald-500/[0.09]", accent: "bg-emerald-500",  avatar: "db-status-interview" },
  "Offer":        { tint: "bg-blue-500/[0.06] dark:bg-blue-500/[0.09]",       accent: "bg-blue-500",     avatar: "db-status-offer" },
  "Rejected":     { tint: "bg-red-500/[0.05] dark:bg-red-500/[0.08]",         accent: "bg-red-400",      avatar: "db-status-rejected" },
  "Withdrawn":    { tint: "",                                                  accent: "bg-zinc-300 dark:bg-zinc-600", avatar: "db-status-withdrawn" },
  "Ghosted":      { tint: "bg-zinc-500/[0.04] dark:bg-zinc-500/[0.07]",       accent: "bg-zinc-300 dark:bg-zinc-600", avatar: "db-status-ghosted" },
};

function tokens(status: string) {
  return STATUS_TOKENS[status] ?? {
    tint: "", accent: "bg-border", avatar: "db-status-default",
  };
}

interface ApplicationCardProps {
  application: JobApplication;
  selectable?: boolean;
  selected?: boolean;
  onSelect?: (id: string) => void;
  mobileSelectionMode?: boolean;
}

export function ApplicationCard({ application, selectable, selected, onSelect, mobileSelectionMode = false }: ApplicationCardProps) {
  const router = useRouter();
  const [deleting, setDeleting]               = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [duplicating, setDuplicating]         = useState(false);
  const [duplicated, setDuplicated]           = useState(false);
  const [currentStatus, setCurrentStatus]     = useState<ApplicationStatus>(application.status);
  const [statusUpdating, setStatusUpdating]   = useState(false);

  useEffect(() => {
    setCurrentStatus(application.status);
  }, [application.status]);

  const tok      = tokens(currentStatus);
  const initial  = application.company.charAt(0).toUpperCase();
  const dateStr  = formatDate(application.applied_date);

  const sourceColor = application.source
    ? (SOURCE_COLORS[application.source] ?? SOURCE_COLORS["Other"])
    : null;

  const atsColor =
    application.ats_score == null ? "" :
    application.ats_score >= 70   ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300" :
    application.ats_score >= 45   ? "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300" :
                                    "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300";

  const handleDuplicate = async () => {
    setDuplicating(true);
    try {
      const res = await fetch(`/api/applications/${application.id}/duplicate`, { method: "POST" });
      if (res.ok) {
        setDuplicated(true);
        setTimeout(() => setDuplicated(false), 2000);
        router.refresh();
        toast.success("Application duplicated");
        return true;
      } else {
        toast.error("Failed to duplicate application. Please try again.");
        return false;
      }
    } catch {
      toast.error("Failed to duplicate application. Please try again.");
      return false;
    } finally {
      setDuplicating(false);
    }
  };

  const handleDeleteClick = (e: Event) => {
    e.preventDefault(); // keep dropdown open for confirm step
    setConfirmingDelete(true);
    setTimeout(() => setConfirmingDelete(false), 5000);
  };

  const handleDeleteConfirm = async () => {
    setConfirmingDelete(false);
    setDeleting(true);
    try {
      const res = await fetch(`/api/applications/${application.id}`, { method: "DELETE" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Delete failed");
      }
      toast.success("Application deleted");
      router.refresh();
      return true;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete application");
      setDeleting(false);
      return false;
    }
  };

  const saveStatus = async (status: ApplicationStatus) => {
    const response = await fetch(`/api/applications/${application.id}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });

    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new Error((body as { error?: string }).error || "Status update failed");
    }
  };

  const handleStatusChange = async (nextStatus: ApplicationStatus) => {
    if (nextStatus === currentStatus || statusUpdating) return false;
    const previousStatus = currentStatus;
    setCurrentStatus(nextStatus);
    setStatusUpdating(true);

    try {
      await saveStatus(nextStatus);
      toast.success(`Moved ${application.company} to ${nextStatus}`, {
        description: application.position,
        action: {
          label: "Undo",
          onClick: () => {
            void (async () => {
              try {
                setCurrentStatus(previousStatus);
                await saveStatus(previousStatus);
                toast.success("Status change undone");
                router.refresh();
              } catch {
                setCurrentStatus(nextStatus);
                toast.error("Could not undo the status change");
              }
            })();
          },
        },
      });
      router.refresh();
      return true;
    } catch (error) {
      setCurrentStatus(previousStatus);
      toast.error(error instanceof Error ? error.message : "Failed to update status");
      return false;
    } finally {
      setStatusUpdating(false);
    }
  };

  return (
    <>
    <MobileApplicationCard
      application={application}
      status={currentStatus}
      selected={selected}
      selectionMode={selectable && mobileSelectionMode}
      onSelect={onSelect}
      saving={statusUpdating}
      deleting={deleting}
      duplicating={duplicating}
      onSaveStatus={handleStatusChange}
      onDuplicate={handleDuplicate}
      onDelete={handleDeleteConfirm}
    />
    <div
      data-testid="application-card"
      className={cn(
        // ── Shell ──────────────────────────────────────────────────────────
        "group relative isolate hidden rounded-2xl border overflow-hidden transition-all duration-200 md:block",
        "border-[#dbc1b9]/40 dark:border-white/[0.07]",
        "hover:border-[#dbc1b9]/70 dark:hover:border-white/12 hover:shadow-md",
        // Status tint — very subtle background wash per status
        tok.tint,
        selected && "ring-2 ring-[#99462a] dark:ring-[#ccff00] border-transparent",
        deleting && "pointer-events-none opacity-50",
      )}
    >
      {/* ── Deletion overlay ── */}
      {deleting && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/50 backdrop-blur-[2px] rounded-2xl">
          <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground bg-background/95 px-3.5 py-2 rounded-full shadow-sm border border-border">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Deleting…
          </div>
        </div>
      )}

      {/* ── Left accent bar (status colour) ── */}
      <div className={cn("absolute left-0 inset-y-0 w-0.75 rounded-l-2xl", tok.accent)} />

      {/* ── Card body ── */}
      <div className="relative pl-6 pr-4 py-4 sm:pl-7 sm:pr-5 sm:py-4.5">
        <div className="flex gap-3 sm:gap-3.5">
          {selectable && (
            <button
              type="button"
              onClick={() => onSelect?.(application.id)}
              aria-label={selected ? `Deselect ${application.position} at ${application.company}` : `Select ${application.position} at ${application.company}`}
              aria-pressed={selected}
              title={selected ? "Deselect application" : "Select for bulk actions"}
              className={cn(
                "relative z-20 h-11 w-11 shrink-0 items-center justify-center rounded-lg sm:flex",
                mobileSelectionMode ? "flex" : "hidden",
              )}
            >
              <span
                className={cn(
                  "flex h-5 w-5 items-center justify-center rounded-md border transition-colors",
                  selected
                    ? "border-[#99462a] bg-[#99462a] text-white dark:border-[#ccff00] dark:bg-[#ccff00] dark:text-black"
                    : "border-[#dbc1b9] bg-background/80 text-transparent hover:border-[#99462a] dark:border-white/20 dark:hover:border-[#ccff00]",
                )}
              >
                <Check className="h-3 w-3" strokeWidth={3} aria-hidden="true" />
              </span>
            </button>
          )}

          {/* Company avatar — status-coloured background */}
          <div
            className={cn(
              "h-11 w-11 sm:h-12 sm:w-12 rounded-xl flex items-center justify-center",
              "shrink-0 text-base sm:text-lg font-bold db-headline select-none",
              "transition-transform group-hover:scale-105",
              tok.avatar,
            )}
            aria-hidden="true"
          >
            {initial}
          </div>

          {/* Main content */}
          <div className="flex-1 min-w-0">

            {/* ── Row 1: Position + Actions ── */}
            <div className="flex items-start gap-2">
              <Link
                href={`/applications/${application.id}`}
                className="relative z-10 block min-w-0 flex-1"
              >
                <h3 className="font-semibold text-[15px] sm:text-base text-foreground hover:text-[#99462a] dark:hover:text-[#ccff00] transition-colors leading-snug line-clamp-2">
                  {application.position}
                </h3>
              </Link>

              {/* Actions — always visible, no hover-only on mobile */}
              <div className="relative z-10 -mt-0.5 flex items-center gap-0.5 shrink-0">
                {application.job_url && (
                  <a
                    href={application.job_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`View job posting for ${application.position} at ${application.company}`}
                    title="View job posting"
                    className="hidden h-8 w-8 items-center justify-center rounded-lg text-muted-foreground/50 hover:text-[#99462a] dark:hover:text-[#ccff00] hover:bg-black/5 dark:hover:bg-white/5 transition-colors sm:flex"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                )}
                <DropdownMenu modal={false}>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      aria-label={`Options for ${application.position} at ${application.company}`}
                      className="flex h-11 w-11 items-center justify-center rounded-xl text-muted-foreground/60 hover:text-[#99462a] dark:hover:text-[#ccff00] hover:bg-black/5 dark:hover:bg-white/5 transition-colors sm:h-8 sm:w-8 sm:rounded-lg"
                    >
                      <MoreHorizontal className="h-4 w-4" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-44">
                    <DropdownMenuItem asChild>
                      <Link href={`/applications/${application.id}/edit`} className="flex items-center">
                        <Pencil className="mr-2 h-3.5 w-3.5" /> Edit
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link href={`/applications/${application.id}`} className="flex items-center">
                        <ExternalLink className="mr-2 h-3.5 w-3.5" /> View details
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={handleDuplicate} disabled={duplicating || duplicated}>
                      {duplicated
                        ? <><Check className="mr-2 h-3.5 w-3.5 text-emerald-600" />Duplicated!</>
                        : <><Copy className="mr-2 h-3.5 w-3.5" />{duplicating ? "Duplicating…" : "Duplicate"}</>}
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    {confirmingDelete ? (
                      <DropdownMenuItem
                        onClick={handleDeleteConfirm}
                        className="text-destructive focus:text-destructive font-semibold"
                      >
                        <Trash2 className="mr-2 h-3.5 w-3.5" /> Confirm delete
                      </DropdownMenuItem>
                    ) : (
                      <DropdownMenuItem
                        onSelect={handleDeleteClick}
                        disabled={deleting}
                        className="text-destructive focus:text-destructive"
                      >
                        <Trash2 className="mr-2 h-3.5 w-3.5" /> Delete
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>

            {/* ── Row 2: Company + inline status action ── */}
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <span className="text-sm text-muted-foreground font-medium leading-none">
                {application.company}
              </span>
              <span className="hidden text-[10px] font-medium uppercase tracking-wider text-muted-foreground/55 sm:inline">Status</span>
              <StatusPicker
                status={currentStatus}
                company={application.company}
                position={application.position}
                pending={statusUpdating}
                onChange={handleStatusChange}
              />
              {application.requires_sponsorship && (
                <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300 shrink-0">
                  <Stamp className="h-2.5 w-2.5 shrink-0" />
                  Visa
                </span>
              )}
            </div>

            {/* ── Row 3: Meta info ── */}
            <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-2 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <Calendar className="h-3 w-3 shrink-0" />
                {dateStr}
              </span>
              {application.location && (
                <span className="flex items-center gap-1">
                  <MapPin className="h-3 w-3 shrink-0" />
                  <span className="truncate max-w-28 sm:max-w-none">{application.location}</span>
                </span>
              )}
              {application.salary_range && (
                <span className="hidden sm:flex items-center gap-1">
                  <DollarSign className="h-3 w-3 shrink-0" />
                  {application.salary_range}
                </span>
              )}
              {sourceColor && application.source && (
                <span className={cn(
                  "hidden sm:inline-block text-[11px] font-medium rounded-full px-2 py-0.5",
                  sourceColor.bg, sourceColor.text, sourceColor.darkBg, sourceColor.darkText,
                )}>
                  {application.source}
                </span>
              )}
            </div>

            {/* ── Row 4: Quality signals ── */}
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              {application.ats_provider && (
                <AtsProviderBadge provider={application.ats_provider} />
              )}
              {application.ats_score != null && (
                <Link
                  href="/ats"
                  onClick={(e) => e.stopPropagation()}
                  title="ATS keyword match — click to re-scan"
                  className={cn(
                    "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold tabular-nums hover:opacity-80 transition-opacity",
                    atsColor,
                  )}
                >
                  <ScanSearch className="h-3 w-3 shrink-0" />
                  ATS {application.ats_score}%
                </Link>
              )}
              {application.has_referral && (
                <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold bg-violet-50 text-violet-700 dark:bg-violet-950 dark:text-violet-300 shrink-0">
                  Referred
                </span>
              )}
              {application.glassdoor_rating != null && (
                <a
                  href={`https://www.glassdoor.com/Search/results.htm?keyword=${encodeURIComponent(application.company)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  title="Glassdoor rating — click to view on Glassdoor"
                  onClick={(e) => e.stopPropagation()}
                  className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 hover:opacity-80 transition-opacity shrink-0"
                >
                  ★ {application.glassdoor_rating.toFixed(1)}
                </a>
              )}
              <span className="ml-auto hidden shrink-0 sm:flex">
                <CompletenessRing application={application} size={30} simple />
              </span>
            </div>

            {/* ── Notes preview ── */}
            {application.notes && (
              <p className="mt-2 hidden text-xs text-muted-foreground/60 italic line-clamp-1 border-t border-border/30 pt-1.5 sm:block">
                &ldquo;{application.notes}&rdquo;
              </p>
            )}
          </div>
        </div>
      </div>

    </div>
    </>
  );
}
