"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  MoreHorizontal, Pencil, Trash2, ExternalLink,
  MapPin, DollarSign, Calendar, ScanSearch, Copy, Check,
} from "lucide-react";
import { toast } from "sonner";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui";
import type { JobApplication } from "@/types";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { CompletenessRing } from "./completeness-ring";

interface ApplicationCardProps {
  application: JobApplication;
  selectable?: boolean;
  selected?: boolean;
  onSelect?: (id: string) => void;
}

function statusTokens(status: string) {
  const map: Record<string, { accent: string; avatar: string; badge: string }> = {
    "Interview":    { accent: "bg-[#006d34]",  avatar: "db-status-interview", badge: "db-status-interview" },
    "Phone Screen": { accent: "bg-primary",     avatar: "db-status-phone",    badge: "db-status-phone" },
    "Applied":      { accent: "bg-amber-500",   avatar: "db-status-applied",  badge: "db-status-applied" },
    "Offer":        { accent: "bg-[#006d34]",   avatar: "db-status-offer",    badge: "db-status-offer" },
    "Accepted":     { accent: "bg-[#006d34]",   avatar: "db-status-accepted", badge: "db-status-accepted" },
    "Rejected":     { accent: "bg-[#ba1a1a]",   avatar: "db-status-rejected", badge: "db-status-rejected" },
    "Withdrawn":    { accent: "bg-muted-foreground", avatar: "db-status-withdrawn", badge: "db-status-withdrawn" },
    "Ghosted":      { accent: "bg-zinc-400",    avatar: "db-status-ghosted",  badge: "db-status-ghosted" },
  };
  return map[status] ?? { accent: "bg-border", avatar: "db-status-default", badge: "db-status-default" };
}

export function ApplicationCard({ application, selectable, selected, onSelect }: ApplicationCardProps) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [duplicating, setDuplicating] = useState(false);
  const [duplicated, setDuplicated] = useState(false);

  const handleDuplicate = async () => {
    setDuplicating(true);
    try {
      const res = await fetch(`/api/applications/${application.id}/duplicate`, { method: "POST" });
      if (res.ok) {
        setDuplicated(true);
        setTimeout(() => setDuplicated(false), 2000);
        router.refresh();
      } else {
        toast.error("Failed to duplicate application. Please try again.");
      }
    } catch {
      toast.error("Failed to duplicate application. Please try again.");
    } finally {
      setDuplicating(false);
    }
  };

  const handleDeleteClick = () => {
    setConfirmingDelete(true);
    setTimeout(() => setConfirmingDelete(false), 4000);
  };

  const handleDeleteConfirm = async () => {
    setConfirmingDelete(false);
    setDeleting(true);
    const supabase = createClient();
    const { error } = await supabase
      .from("job_applications")
      .delete()
      .eq("id", application.id);

    if (error) {
      toast.error("Failed to delete application");
      setDeleting(false);
      return;
    }
    toast.success("Application deleted");
    router.refresh();
  };

  const formattedDate = new Date(application.applied_date).toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric",
  });

  const initial = application.company.charAt(0).toUpperCase();
  const { accent, avatar, badge } = statusTokens(application.status);

  return (
    <div className={cn("db-app-card group relative overflow-hidden pl-5 sm:pl-6", selected && "ring-2 ring-[#99462a] dark:ring-[#ccff00]")}>
      <div className={cn("absolute left-0 inset-y-0 w-1.5 rounded-l-xl", accent)} />

      {/* Selection checkbox — shown in selectable mode */}
      {selectable && (
        <button
          type="button"
          onClick={() => onSelect?.(application.id)}
          aria-label={selected ? "Deselect application" : "Select application"}
          className="absolute top-3 right-3 z-10 h-5 w-5 rounded border-2 flex items-center justify-center transition-colors
            border-muted-foreground/30 hover:border-[#99462a] dark:hover:border-[#ccff00]
            bg-background data-checked:bg-[#99462a] dark:data-checked:bg-[#ccff00]"
          data-checked={selected || undefined}
        >
          {selected && <Check className="h-3 w-3 text-white dark:text-black" />}
        </button>
      )}

      <div className="flex items-start gap-4 sm:gap-5">
        <div className={cn("db-company-avatar-lg shrink-0", avatar)}>
          {initial}
        </div>

        <div className="flex-1 min-w-0">

          {/* ── Top row: title / company + status + actions ── */}
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <Link
                href={`/applications/${application.id}`}
                className="db-headline text-lg sm:text-xl font-semibold text-foreground hover:text-[#99462a] dark:hover:text-[#ccff00] transition-colors leading-tight line-clamp-2 block"
              >
                {application.position}
              </Link>
              <p className="text-muted-foreground text-sm font-medium mt-0.5 truncate">
                {application.company}
              </p>
            </div>

            {/* Status + actions — clean, no data badges */}
            <div className="flex items-center gap-1.5 shrink-0">
              <span className={cn("db-status-badge hidden sm:inline-block", badge)}>
                {application.status}
              </span>
              <div className="flex items-center sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                {application.job_url && (
                  <a
                    href={application.job_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`View job posting for ${application.position} at ${application.company}`}
                    title="View job posting"
                    className="p-1.5 rounded-lg text-muted-foreground/50 hover:text-[#99462a] dark:hover:text-[#ccff00] hover:bg-[#99462a]/8 dark:hover:bg-[#ccff00]/8 transition-colors"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                )}
                <DropdownMenu modal={false}>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      className="p-1.5 rounded-lg text-muted-foreground/50 hover:text-[#99462a] dark:hover:text-[#ccff00] hover:bg-[#99462a]/8 dark:hover:bg-[#ccff00]/8 transition-colors"
                      aria-label={`Options for ${application.position} at ${application.company}`}
                      title="More options"
                    >
                      <MoreHorizontal className="h-3.5 w-3.5" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem asChild>
                      <Link href={`/applications/${application.id}/edit`} className="flex items-center">
                        <Pencil className="mr-2 h-4 w-4" />
                        Edit
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={handleDuplicate} disabled={duplicating || duplicated}>
                      {duplicated ? (
                        <><Check className="mr-2 h-4 w-4 text-emerald-600" />Duplicated</>
                      ) : (
                        <><Copy className="mr-2 h-4 w-4" />{duplicating ? "Duplicating…" : "Duplicate"}</>
                      )}
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    {confirmingDelete ? (
                      <DropdownMenuItem
                        onClick={handleDeleteConfirm}
                        className="text-destructive focus:text-destructive font-medium"
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Confirm delete
                      </DropdownMenuItem>
                    ) : (
                      <DropdownMenuItem
                        onClick={handleDeleteClick}
                        disabled={deleting}
                        className="text-destructive focus:text-destructive"
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        {deleting ? "Deleting…" : "Delete"}
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </div>

          {/* Mobile-only status badge */}
          <span className={cn("db-status-badge sm:hidden mt-2 inline-block", badge)}>
            {application.status}
          </span>

          {/* ── Bottom row: meta info + completeness ring + ATS ── */}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 mt-2.5">
            {/* Date / location / salary */}
            <span className="flex items-center gap-1.5 text-xs sm:text-sm text-muted-foreground/75">
              <Calendar className="h-3.5 w-3.5 shrink-0" />
              {formattedDate}
            </span>
            {application.location && (
              <span className="flex items-center gap-1.5 text-xs sm:text-sm text-muted-foreground/75">
                <MapPin className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate max-w-28 sm:max-w-none">{application.location}</span>
              </span>
            )}
            {application.salary_range && (
              <span className="hidden sm:flex items-center gap-1.5 text-xs sm:text-sm text-muted-foreground/75">
                <DollarSign className="h-3.5 w-3.5 shrink-0" />
                {application.salary_range}
              </span>
            )}
            {application.source && (
              <span className="hidden sm:inline-block text-xs text-muted-foreground/50 bg-muted/60 rounded-full px-2 py-0.5">
                {application.source}
              </span>
            )}

            {/* Spacer pushes quality signals to the right */}
            <span className="flex-1" />

            {/* ATS score pill */}
            {application.ats_score !== null && application.ats_score !== undefined && (
              <Link
                href={`/ats`}
                title="ATS keyword match — click to re-scan"
                onClick={(e) => e.stopPropagation()}
                className={cn(
                  "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold tabular-nums transition-opacity hover:opacity-80",
                  application.ats_score >= 70
                    ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                    : application.ats_score >= 45
                    ? "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
                    : "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300"
                )}
              >
                <ScanSearch className="h-3 w-3 shrink-0" />
                ATS {application.ats_score}%
              </Link>
            )}

            {/* Completeness ring — visual only on list; full detail on application page */}
            <CompletenessRing application={application} size={36} simple />
          </div>
        </div>
      </div>

      {application.notes && (
        <p className="db-card-notes ml-0 sm:ml-21 line-clamp-2 mt-1">
          &ldquo;{application.notes}&rdquo;
        </p>
      )}
    </div>
  );
}
