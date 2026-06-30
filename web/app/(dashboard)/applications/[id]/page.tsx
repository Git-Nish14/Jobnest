import { notFound } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft, Pencil, ExternalLink,
  Calendar, MapPin, DollarSign, Hash,
} from "lucide-react";
import { AtsProviderBadge } from "@/components/ui/brand-icons";
import { getApplicationById, getInterviews, getActivityLogs } from "@/services";
import { createClient } from "@/lib/supabase/server";
import { getSignedUrl, getSignedUrls } from "@/lib/utils/storage";
import { InterviewList } from "@/components/interviews";
import { ActivityTimeline } from "@/components/activity";
import { DocumentManager } from "@/components/documents";
import type { LegacyDoc } from "@/components/documents/DocumentManager";
import { cn } from "@/lib/utils";
import { CompletenessCard } from "@/components/applications/completeness-card";
import { TailoringChecklist } from "@/components/applications/tailoring-checklist";
import { StatusTimeline } from "@/components/applications/status-timeline";
import { DocumentPurgeBanner } from "@/components/applications/document-purge-banner";
import { DeleteApplicationButton } from "@/components/applications/delete-application-button";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
}

// Status colour tokens
function statusTokens(status: string) {
  const map: Record<string, { avatar: string; badge: string; accent: string }> = {
    "Interview":    { avatar: "db-status-interview", badge: "db-status-interview", accent: "bg-[#006d34]" },
    "Phone Screen": { avatar: "db-status-phone",     badge: "db-status-phone",     accent: "bg-[#99462a]" },
    "Applied":      { avatar: "db-status-applied",   badge: "db-status-applied",   accent: "bg-amber-500" },
    "Offer":        { avatar: "db-status-offer",     badge: "db-status-offer",     accent: "bg-[#006d34]" },
    "Accepted":     { avatar: "db-status-accepted",  badge: "db-status-accepted",  accent: "bg-[#006d34]" },
    "Rejected":     { avatar: "db-status-rejected",  badge: "db-status-rejected",  accent: "bg-[#ba1a1a]" },
    "Withdrawn":    { avatar: "db-status-withdrawn", badge: "db-status-withdrawn", accent: "bg-[#88726c]" },
  };
  return map[status] ?? { avatar: "db-status-default", badge: "db-status-default", accent: "bg-[#dbc1b9]" };
}

export default async function ApplicationDetailPage({ params }: PageProps) {
  const { id } = await params;

  const [
    { data: application, error },
    { data: interviews },
    { data: activityLogs },
  ] = await Promise.all([
    getApplicationById(id),
    getInterviews(id),
    getActivityLogs(id),
  ]);

  if (error || !application) notFound();

  // Bridge legacy resume_path / cover_letter_path into LegacyDoc shape so
  // DocumentManager can display them alongside new application_documents rows.
  const supabase = await createClient();

  // Pre-fetch application_documents server-side to skip the client-side loading
  // spinner in DocumentManager and show documents immediately on first paint.
  const { data: initialDocs } = await supabase
    .from("application_documents")
    .select("*")
    .eq("application_id", id)
    .eq("user_id", (await supabase.auth.getUser()).data.user?.id ?? "")
    .order("uploaded_at", { ascending: false });

  // Applications created on/after 2026-06-12 always write docs to
  // application_documents — legacy path fields are unused and showing them
  // as "Legacy" cards creates duplicates.
  const isNewApp = new Date(application.created_at) >= new Date("2026-06-12");

  // Attach signed URLs for the pre-fetched documents
  const preFetchedPaths = (initialDocs ?? []).map((d) => d.storage_path);
  const preFetchedUrlMap = preFetchedPaths.length > 0
    ? await getSignedUrls(supabase, preFetchedPaths)
    : {};

  // For old apps: exclude application_documents rows whose storage_path matches
  // a legacy field so the same file doesn't appear twice (once as Legacy card,
  // once as a regular DocumentCard).
  const legacyStoragePathSet = isNewApp
    ? new Set<string>()
    : new Set<string>([application.resume_path, application.cover_letter_path].filter(Boolean) as string[]);

  const preloadedDocs = (initialDocs ?? [])
    .filter((d) => !legacyStoragePathSet.has(d.storage_path))
    .map((d) => ({
      ...d,
      signed_url: preFetchedUrlMap[d.storage_path] ?? null,
    }));

  // Fetch pending document purge entry (only for Rejected apps)
  let purgeEntry: { purge_at: string } | null = null;
  if (application.status === "Rejected") {
    const { data: pq } = await supabase
      .from("document_purge_queue")
      .select("purge_at")
      .eq("application_id", id)
      .eq("status", "pending")
      .maybeSingle();
    purgeEntry = pq ?? null;
  }
  // Legacy docs: only for applications predating 2026-06-12
  let legacyDocs: LegacyDoc[] = [];
  if (!isNewApp) {
    const legacyPaths = [
      application.resume_path ? { label: "Resume", path: application.resume_path } : null,
      application.cover_letter_path ? { label: "Cover Letter", path: application.cover_letter_path } : null,
    ].filter(Boolean) as { label: string; path: string }[];

    const legacyUrls = await Promise.all(
      legacyPaths.map(({ path }) => getSignedUrl(supabase, path))
    );

    legacyDocs = legacyPaths
      .map(({ label, path }, i) =>
        legacyUrls[i]
          ? { label, path, signedUrl: legacyUrls[i]!, mimeType: "application/pdf" }
          : null
      )
      .filter(Boolean) as LegacyDoc[];
  }

  const formattedDate = new Date(application.applied_date).toLocaleDateString("en-US", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });

  const initial = application.company.charAt(0).toUpperCase();
  const { avatar, badge, accent } = statusTokens(application.status);

  // Compute purge countdown server-side before the render return.
  // This is a server component — Date.now() runs exactly once on the server
  // and is never called during a client re-render.
  // eslint-disable-next-line react-hooks/purity
  const _serverNow    = Date.now();
  const purgeDaysLeft = purgeEntry
    ? Math.max(0, Math.ceil((new Date(purgeEntry.purge_at).getTime() - _serverNow) / 86_400_000))
    : null;

  return (
    <div>

      {/* ── Navigation ── */}
      <div className="flex items-center justify-between mb-6 sm:mb-8">
        <Link
          href="/applications"
          className="inline-flex items-center gap-2 text-sm text-[#55433d] hover:text-[#99462a] transition-colors font-medium"
        >
          <ArrowLeft className="h-4 w-4" />
          <span className="hidden sm:inline">Back to Applications</span>
          <span className="sm:hidden">Back</span>
        </Link>
        <div className="flex items-center gap-2">
          <DeleteApplicationButton applicationId={id} />
          <Link href={`/applications/${id}/edit`} className="inline-flex db-btn-page-primary">
            <Pencil className="h-4 w-4" />
            <span className="hidden sm:inline">Edit Application</span>
            <span className="sm:hidden">Edit</span>
          </Link>
        </div>
      </div>

      {/* ── Document purge countdown banner ── */}
      {purgeEntry && purgeDaysLeft !== null && (
        <div className="mb-4">
          <DocumentPurgeBanner
            applicationId={id}
            daysLeft={purgeDaysLeft}
            purgeAt={purgeEntry.purge_at}
          />
        </div>
      )}

      {/* ── Hero Header ── */}
      {/* overflow-clip instead of overflow-hidden: clips the glow blob but
          does NOT create a new scroll container, so the status badge pill
          never gets clipped by the section boundary. */}
      <section className="relative bg-[#f4f3f1] rounded-2xl p-6 sm:p-8 mb-6 sm:mb-8 overflow-clip">
        {/* Subtle gradient glow in the corner */}
        <div className={cn("absolute top-0 right-0 w-64 h-64 rounded-full opacity-10 blur-3xl -mr-16 -mt-16", accent)} />

        <div className="flex flex-col sm:flex-row sm:items-start gap-5 sm:gap-6 relative">
          {/* Large company avatar */}
          <div className={cn(
            "w-16 h-16 sm:w-20 sm:h-20 rounded-2xl flex items-center justify-center db-headline text-3xl sm:text-4xl font-bold shrink-0",
            avatar
          )}>
            {initial}
          </div>

          {/* Position + company + status */}
          <div className="flex-1 min-w-0">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
              <div>
                <h1 className="db-headline text-2xl sm:text-4xl font-semibold text-[#1a1c1b] leading-tight">
                  {application.position}
                </h1>
                <p className="text-lg sm:text-xl text-[#55433d] mt-1 font-medium">
                  {application.company}
                </p>
              </div>
              <span className={cn("db-status-badge self-start sm:self-auto shrink-0", badge)}>
                {application.status}
              </span>
            </div>

            {/* Quick metadata */}
            <div className="flex flex-wrap gap-4 mt-4 text-sm text-[#55433d]/80">
              <span className="flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5 shrink-0" />
                {formattedDate}
              </span>
              {application.location && (
                <span className="flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5 shrink-0" />
                  {application.location}
                </span>
              )}
              {application.salary_range && (
                <span className="flex items-center gap-1.5">
                  <DollarSign className="h-3.5 w-3.5 shrink-0" />
                  {application.salary_range}
                </span>
              )}
              {application.job_url && (
                <a
                  href={application.job_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-[#99462a] font-medium hover:underline underline-offset-2 transition-colors"
                >
                  <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                  View posting
                </a>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ── Content Grid ── */}
      <div className="grid gap-6 lg:grid-cols-3 pb-6">

        {/* ── Main column ── */}
        <div className="lg:col-span-2 space-y-6">

          {/* Application details */}
          <section className="db-content-card">
            <h2 className="db-headline text-xl font-semibold text-[#1a1c1b] mb-5">
              Application Details
            </h2>
            <dl className="grid gap-5 sm:grid-cols-2">
              <div>
                <dt className="text-xs font-bold uppercase tracking-widest text-[#55433d]/60 mb-1.5 flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5" /> Applied Date
                </dt>
                <dd className="text-[#1a1c1b] font-medium">{formattedDate}</dd>
              </div>

              {application.location && (
                <div>
                  <dt className="text-xs font-bold uppercase tracking-widest text-[#55433d]/60 mb-1.5 flex items-center gap-1.5">
                    <MapPin className="h-3.5 w-3.5" /> Location
                  </dt>
                  <dd className="text-[#1a1c1b] font-medium">{application.location}</dd>
                </div>
              )}

              {application.salary_range && (
                <div>
                  <dt className="text-xs font-bold uppercase tracking-widest text-[#55433d]/60 mb-1.5 flex items-center gap-1.5">
                    <DollarSign className="h-3.5 w-3.5" /> Salary Range
                  </dt>
                  <dd className="text-[#1a1c1b] font-medium">{application.salary_range}</dd>
                </div>
              )}

              {application.job_id && (
                <div>
                  <dt className="text-xs font-bold uppercase tracking-widest text-[#55433d]/60 mb-1.5 flex items-center gap-1.5">
                    <Hash className="h-3.5 w-3.5" /> Job ID
                  </dt>
                  <dd className="text-[#1a1c1b] font-mono text-sm">{application.job_id}</dd>
                </div>
              )}

              {application.ats_provider && (
                <div>
                  <dt className="text-xs font-bold uppercase tracking-widest text-[#55433d]/60 mb-1.5">
                    Applied Via
                  </dt>
                  <dd>
                    <AtsProviderBadge provider={application.ats_provider} />
                  </dd>
                </div>
              )}

              {application.job_url && (
                <div className="sm:col-span-2">
                  <dt className="text-xs font-bold uppercase tracking-widest text-[#55433d]/60 mb-1.5 flex items-center gap-1.5">
                    <ExternalLink className="h-3.5 w-3.5" /> Job Posting
                  </dt>
                  <dd>
                    <a
                      href={application.job_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-[#99462a] font-medium hover:underline underline-offset-2"
                    >
                      View original posting
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </dd>
                </div>
              )}
            </dl>
          </section>

          {/* ── Status Journey — visible once any status change has occurred ── */}
          <StatusTimeline
            activities={activityLogs || []}
            appliedDate={application.applied_date}
            currentStatus={application.status}
          />

          {/* Notes */}
          {application.notes && (
            <section className="db-content-card">
              <h2 className="db-headline text-xl font-semibold text-[#1a1c1b] mb-4">Notes</h2>
              <p className="text-[#55433d] leading-relaxed whitespace-pre-wrap italic">
                &ldquo;{application.notes}&rdquo;
              </p>
            </section>
          )}

          {/* Interviews */}
          <InterviewList
            applicationId={id}
            interviews={interviews || []}
          />
        </div>

        {/* ── Sidebar ── */}
        <div className="space-y-6">

          {/* Documents — pre-fetched server-side to avoid loading flash */}
          <DocumentManager
            applicationId={id}
            initialDocuments={preloadedDocs}
            legacyDocs={legacyDocs}
            excludeStoragePaths={legacyStoragePathSet.size > 0 ? Array.from(legacyStoragePathSet) : undefined}
            applicationCompany={application.company}
            applicationPosition={application.position}
          />

          {/* ── Application completeness — client component, live-updates on focus ── */}
          <CompletenessCard applicationId={id} />

          {/* ── Resume tailoring checklist — AI-generated from stored JD ── */}
          <TailoringChecklist
            applicationId={id}
            hasJobDescription={!!application.job_description}
          />

          {/* Activity Timeline */}
          <ActivityTimeline activities={activityLogs || []} />
        </div>
      </div>

    </div>
  );
}
