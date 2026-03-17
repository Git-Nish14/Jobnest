"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  MoreHorizontal,
  Pencil,
  Trash2,
  ExternalLink,
  MapPin,
  DollarSign,
  Calendar,
} from "lucide-react";
import { toast } from "sonner";
import {
  StatusBadge,
  Button,
  Card,
  CardContent,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui";
import type { JobApplication } from "@/types";
import { createClient } from "@/lib/supabase/client";

interface ApplicationCardProps {
  application: JobApplication;
}

export function ApplicationCard({ application }: ApplicationCardProps) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    if (!confirm("Are you sure you want to delete this application?")) return;

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

  const formattedDate = new Date(application.applied_date).toLocaleDateString(
    "en-US",
    {
      month: "short",
      day: "numeric",
      year: "numeric",
    }
  );

  const companyInitial = application.company.charAt(0).toUpperCase();

  return (
    <Card className="group transition-all duration-150 hover:shadow-md hover:border-border/80">
      <CardContent className="p-4 sm:p-5">
        <div className="flex items-start gap-3 sm:gap-4">
          {/* Company Initial Avatar */}
          <div className="h-9 w-9 sm:h-10 sm:w-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary font-bold text-sm sm:text-base shrink-0 select-none">
            {companyInitial}
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <Link
                    href={`/applications/${application.id}`}
                    className="font-semibold text-sm sm:text-base text-foreground hover:text-primary transition-colors line-clamp-1"
                  >
                    {application.position}
                  </Link>
                  <StatusBadge status={application.status} />
                </div>
                <p className="text-sm text-muted-foreground font-medium mt-0.5 truncate">
                  {application.company}
                </p>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                {application.job_url && (
                  <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
                    <a href={application.job_url} target="_blank" rel="noopener noreferrer" title="View job posting">
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  </Button>
                )}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <MoreHorizontal className="h-3.5 w-3.5" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem asChild>
                      <Link href={`/applications/${application.id}/edit`} className="flex items-center">
                        <Pencil className="mr-2 h-4 w-4" />
                        Edit
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={handleDelete}
                      disabled={deleting}
                      className="text-destructive focus:text-destructive"
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      {deleting ? "Deleting..." : "Delete"}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 sm:gap-4 mt-2 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <Calendar className="h-3 w-3 shrink-0" />
                {formattedDate}
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
            </div>

            {application.notes && (
              <p className="mt-2 text-xs sm:text-sm text-muted-foreground line-clamp-1 border-t pt-2">
                {application.notes}
              </p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
