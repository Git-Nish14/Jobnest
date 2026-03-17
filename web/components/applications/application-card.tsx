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

  return (
    <Card className="group transition-all hover:shadow-md">
      <CardContent className="p-3 sm:p-4">
        <div className="flex items-start justify-between gap-2 sm:gap-4">
          <div className="flex-1 min-w-0 space-y-1">
            <div className="flex items-start sm:items-center gap-1.5 sm:gap-2 flex-wrap">
              <Link
                href={`/applications/${application.id}`}
                className="font-semibold text-sm sm:text-base text-foreground hover:underline line-clamp-1"
              >
                {application.position}
              </Link>
              <StatusBadge status={application.status} />
            </div>

            <p className="text-xs sm:text-sm text-muted-foreground font-medium truncate">
              {application.company}
            </p>

            <div className="flex flex-wrap items-center gap-2 sm:gap-3 pt-0.5 sm:pt-1 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <Calendar className="h-3 w-3 shrink-0" />
                {formattedDate}
              </span>
              {application.location && (
                <span className="flex items-center gap-1">
                  <MapPin className="h-3 w-3 shrink-0" />
                  <span className="truncate max-w-24 sm:max-w-none">{application.location}</span>
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
              <p className="pt-1.5 sm:pt-2 text-xs sm:text-sm text-muted-foreground line-clamp-2">
                {application.notes}
              </p>
            )}
          </div>

          <div className="flex items-center gap-0.5 sm:gap-1 shrink-0">
            {application.job_url && (
              <Button variant="ghost" size="icon" asChild>
                <a
                  href={application.job_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  title="View job posting"
                >
                  <ExternalLink className="h-4 w-4" />
                </a>
              </Button>
            )}

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem asChild>
                  <Link
                    href={`/applications/${application.id}/edit`}
                    className="flex items-center"
                  >
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
      </CardContent>
    </Card>
  );
}
