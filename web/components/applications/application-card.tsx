"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  MoreHorizontal, Pencil, Trash2, ExternalLink,
  MapPin, DollarSign, Calendar,
} from "lucide-react";
import { toast } from "sonner";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui";
import type { JobApplication } from "@/types";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

interface ApplicationCardProps {
  application: JobApplication;
}

// Status → colour tokens
function statusTokens(status: string) {
  const map: Record<string, { accent: string; avatar: string; badge: string }> = {
    "Interview":    { accent: "bg-[#006d34]",  avatar: "db-status-interview", badge: "db-status-interview" },
    "Phone Screen": { accent: "bg-[#99462a]",  avatar: "db-status-phone",    badge: "db-status-phone" },
    "Applied":      { accent: "bg-amber-500",  avatar: "db-status-applied",  badge: "db-status-applied" },
    "Offer":        { accent: "bg-[#006d34]",  avatar: "db-status-offer",    badge: "db-status-offer" },
    "Accepted":     { accent: "bg-[#006d34]",  avatar: "db-status-accepted", badge: "db-status-accepted" },
    "Rejected":     { accent: "bg-[#ba1a1a]",  avatar: "db-status-rejected", badge: "db-status-rejected" },
    "Withdrawn":    { accent: "bg-[#88726c]",  avatar: "db-status-withdrawn",badge: "db-status-withdrawn" },
  };
  return map[status] ?? { accent: "bg-[#dbc1b9]", avatar: "db-status-default", badge: "db-status-default" };
}

export function ApplicationCard({ application }: ApplicationCardProps) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

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
    <div className="db-app-card group relative overflow-hidden pl-5 sm:pl-6">
      {/* ── Status accent bar (left edge) ── */}
      <div className={cn("absolute left-0 inset-y-0 w-1.5 rounded-l-xl", accent)} />

      <div className="flex items-start gap-4 sm:gap-5">
        {/* Company avatar */}
        <div className={cn("db-company-avatar-lg shrink-0", avatar)}>
          {initial}
        </div>

        {/* Main content */}
        <div className="flex-1 min-w-0">

          {/* Top row: title + badge + actions */}
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <Link
                href={`/applications/${application.id}`}
                className="db-headline text-lg sm:text-xl font-semibold text-[#1a1c1b] hover:text-[#99462a] transition-colors leading-tight line-clamp-2 block"
              >
                {application.position}
              </Link>
              <p className="text-[#55433d] text-sm font-medium mt-0.5 truncate">
                {application.company}
              </p>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <span className={cn("db-status-badge hidden sm:inline-block", badge)}>
                {application.status}
              </span>

              {/* Actions — appear on hover */}
              <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
                {application.job_url && (
                  <a
                    href={application.job_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    title="View job posting"
                    className="p-1.5 rounded-lg text-[#55433d]/50 hover:text-[#99462a] hover:bg-[#99462a]/8 transition-colors"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                )}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      className="p-1.5 rounded-lg text-[#55433d]/50 hover:text-[#99462a] hover:bg-[#99462a]/8 transition-colors"
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

          {/* Mobile status badge */}
          <span className={cn("db-status-badge sm:hidden mt-2 inline-block", badge)}>
            {application.status}
          </span>

          {/* Metadata row */}
          <div className="flex flex-wrap gap-3 sm:gap-5 mt-2.5 text-xs sm:text-sm text-[#55433d]/75">
            <span className="flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5 shrink-0" />
              {formattedDate}
            </span>
            {application.location && (
              <span className="flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate max-w-32 sm:max-w-none">{application.location}</span>
              </span>
            )}
            {application.salary_range && (
              <span className="hidden sm:flex items-center gap-1.5">
                <DollarSign className="h-3.5 w-3.5 shrink-0" />
                {application.salary_range}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Notes */}
      {application.notes && (
        <p className="db-card-notes ml-0 sm:ml-21 line-clamp-2 mt-1">
          &ldquo;{application.notes}&rdquo;
        </p>
      )}
    </div>
  );
}
