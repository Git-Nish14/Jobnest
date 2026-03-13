import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Pencil,
  ExternalLink,
  Calendar,
  MapPin,
  DollarSign,
  FileText,
  Download,
} from "lucide-react";
import { StatusBadge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/Card";
import { getSignedUrl } from "@/lib/utils/storage";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function ApplicationDetailPage({ params }: PageProps) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: application, error } = await supabase
    .from("job_applications")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !application) {
    notFound();
  }

  const resumeUrl = application.resume_path
    ? await getSignedUrl(supabase, application.resume_path)
    : null;

  const coverLetterUrl = application.cover_letter_path
    ? await getSignedUrl(supabase, application.cover_letter_path)
    : null;

  const formattedDate = new Date(application.applied_date).toLocaleDateString(
    "en-US",
    {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    }
  );

  return (
    <div className="space-y-6">
      {/* Back button and actions */}
      <div className="flex items-center justify-between">
        <Link
          href="/applications"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Applications
        </Link>
        <Link href={`/applications/${id}/edit`}>
          <Button className="gap-2">
            <Pencil className="h-4 w-4" />
            Edit
          </Button>
        </Link>
      </div>

      {/* Header */}
      <div className="space-y-2">
        <div className="flex items-center gap-3">
          <h1 className="text-3xl font-bold tracking-tight">
            {application.position}
          </h1>
          <StatusBadge status={application.status} />
        </div>
        <p className="text-xl text-muted-foreground">{application.company}</p>
      </div>

      {/* Content Grid */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main Details */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Application Details</CardTitle>
              <CardDescription>
                Information about this job application
              </CardDescription>
            </CardHeader>
            <CardContent>
              <dl className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1">
                  <dt className="text-sm text-muted-foreground flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    Applied Date
                  </dt>
                  <dd className="font-medium">{formattedDate}</dd>
                </div>

                {application.location && (
                  <div className="space-y-1">
                    <dt className="text-sm text-muted-foreground flex items-center gap-2">
                      <MapPin className="h-4 w-4" />
                      Location
                    </dt>
                    <dd className="font-medium">{application.location}</dd>
                  </div>
                )}

                {application.salary_range && (
                  <div className="space-y-1">
                    <dt className="text-sm text-muted-foreground flex items-center gap-2">
                      <DollarSign className="h-4 w-4" />
                      Salary Range
                    </dt>
                    <dd className="font-medium">{application.salary_range}</dd>
                  </div>
                )}

                {application.job_id && (
                  <div className="space-y-1">
                    <dt className="text-sm text-muted-foreground">Job ID</dt>
                    <dd className="font-medium font-mono text-sm">
                      {application.job_id}
                    </dd>
                  </div>
                )}

                {application.job_url && (
                  <div className="space-y-1 sm:col-span-2">
                    <dt className="text-sm text-muted-foreground">
                      Job Posting
                    </dt>
                    <dd>
                      <a
                        href={application.job_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-primary hover:underline"
                      >
                        View original posting
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </dd>
                  </div>
                )}
              </dl>
            </CardContent>
          </Card>

          {application.notes && (
            <Card>
              <CardHeader>
                <CardTitle>Notes</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="whitespace-pre-wrap text-muted-foreground">
                  {application.notes}
                </p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Documents Sidebar */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Documents</CardTitle>
              <CardDescription>Attached files for this application</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {resumeUrl ? (
                <a
                  href={resumeUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 p-3 rounded-lg bg-muted hover:bg-muted/80 transition-colors"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-100 dark:bg-red-500/20">
                    <FileText className="h-5 w-5 text-red-600 dark:text-red-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">Resume</p>
                    <p className="text-xs text-muted-foreground">PDF Document</p>
                  </div>
                  <Download className="h-4 w-4 text-muted-foreground" />
                </a>
              ) : (
                <p className="text-sm text-muted-foreground">No resume uploaded</p>
              )}

              {coverLetterUrl ? (
                <a
                  href={coverLetterUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 p-3 rounded-lg bg-muted hover:bg-muted/80 transition-colors"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-500/20">
                    <FileText className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">Cover Letter</p>
                    <p className="text-xs text-muted-foreground">PDF Document</p>
                  </div>
                  <Download className="h-4 w-4 text-muted-foreground" />
                </a>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No cover letter uploaded
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
