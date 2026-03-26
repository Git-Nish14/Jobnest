import Link from "next/link";
import { Calendar, Video, MapPin, Clock, User } from "lucide-react";
import { getUpcomingInterviews, getInterviews } from "@/services";

type InterviewWithApp = {
  id: string;
  application_id: string;
  type: string;
  status: string;
  round: number;
  scheduled_at: string;
  duration_minutes: number | null;
  location: string | null;
  meeting_url: string | null;
  interviewer_names: string[] | null;
  job_applications?: { company?: string; position?: string } | null;
};

export const dynamic = "force-dynamic";

export default async function InterviewsPage() {
  const [{ data: upcomingInterviews }, { data: allInterviews }] = await Promise.all([
    getUpcomingInterviews(10),
    getInterviews(),
  ]);

  const upcoming = upcomingInterviews || [];
  const past = (allInterviews || []).filter(
    (i) => new Date(i.scheduled_at) < new Date() || i.status !== "Scheduled"
  );

  const formatDate = (dateString: string) =>
    new Date(dateString).toLocaleDateString("en-US", {
      weekday: "long", month: "long", day: "numeric", year: "numeric",
    });

  const formatTime = (dateString: string) =>
    new Date(dateString).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });

  // Atelier-toned type badge
  function typeBadge(type: string) {
    const map: Record<string, string> = {
      "Phone Screen": "bg-[#99462a]/10 text-[#99462a]",
      "Technical":    "bg-[#006d34]/10 text-[#006d34]",
      "Behavioral":   "bg-[#d97757]/15 text-[#7a2f15]",
      "On-site":      "bg-[#55433d]/10 text-[#55433d]",
      "Final":        "bg-[#006d34]/18 text-[#003d1b]",
    };
    return map[type] ?? "bg-[#55433d]/8 text-[#55433d]";
  }

  function statusBadge(status: string) {
    const map: Record<string, string> = {
      "Scheduled":   "bg-[#006d34]/10 text-[#006d34]",
      "Completed":   "bg-[#55433d]/10 text-[#55433d]",
      "Cancelled":   "bg-[#ba1a1a]/10 text-[#ba1a1a]",
      "Rescheduled": "bg-amber-500/10 text-amber-700",
    };
    return map[status] ?? "bg-[#55433d]/8 text-[#55433d]";
  }

  return (
    <div>
      {/* ── Header ── */}
      <header className="db-page-header">
        <div>
          <h1 className="db-page-title">Interviews</h1>
          <p className="db-page-subtitle">
            Manage your upcoming and past interviews with clarity.
          </p>
        </div>
      </header>

      {/* ── Upcoming ── */}
      <section className="mb-10">
        <div className="flex items-center gap-3 mb-5">
          <Calendar className="h-5 w-5 text-[#99462a]" />
          <h2 className="db-headline text-2xl font-semibold text-[#1a1c1b]">
            Upcoming Interviews
          </h2>
          {upcoming.length > 0 && (
            <span className="text-sm text-[#55433d] font-medium">({upcoming.length})</span>
          )}
        </div>

        {upcoming.length === 0 ? (
          <div className="db-content-card flex flex-col items-center py-16 text-center">
            <Calendar className="h-10 w-10 text-[#55433d]/30 mb-3" />
            <p className="text-[#55433d] font-medium">No upcoming interviews scheduled</p>
            <p className="text-sm text-[#55433d]/60 mt-1">
              Add interviews from your application details page
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {(upcoming as InterviewWithApp[]).map((interview) => (
              <div key={interview.id} className="db-app-card flex flex-col sm:flex-row sm:items-start gap-4">
                <Link href={`/applications/${interview.application_id}`} className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="db-headline text-xl font-semibold text-[#1a1c1b]">
                      {interview.job_applications?.position || "Interview"}
                    </span>
                    <span className={`db-status-badge ${typeBadge(interview.type)}`}>
                      {interview.type}
                    </span>
                    <span className="text-xs text-[#55433d]/60 font-medium">
                      Round {interview.round}
                    </span>
                  </div>
                  <p className="text-[#55433d] font-medium text-sm mb-3">
                    {interview.job_applications?.company}
                  </p>
                  <div className="flex flex-wrap gap-4 text-sm text-[#55433d]/80">
                    <span className="flex items-center gap-1.5">
                      <Clock className="h-3.5 w-3.5 shrink-0" />
                      {formatDate(interview.scheduled_at)} at {formatTime(interview.scheduled_at)}
                    </span>
                    {interview.duration_minutes && (
                      <span>{interview.duration_minutes} min</span>
                    )}
                    {interview.meeting_url && (
                      <span className="flex items-center gap-1.5">
                        <Video className="h-3.5 w-3.5 shrink-0" />
                        Video Call
                      </span>
                    )}
                    {interview.location && (
                      <span className="flex items-center gap-1.5">
                        <MapPin className="h-3.5 w-3.5 shrink-0" />
                        {interview.location}
                      </span>
                    )}
                    {interview.interviewer_names && interview.interviewer_names.length > 0 && (
                      <span className="flex items-center gap-1.5">
                        <User className="h-3.5 w-3.5 shrink-0" />
                        {interview.interviewer_names.join(", ")}
                      </span>
                    )}
                  </div>
                </Link>

                {interview.meeting_url && (
                  <a
                    href={interview.meeting_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="db-btn-page-primary shrink-0 self-start"
                  >
                    <Video className="h-4 w-4" />
                    Join
                  </a>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ── Past ── */}
      {past.length > 0 && (
        <section>
          <div className="flex items-center gap-3 mb-5">
            <h2 className="db-headline text-2xl font-semibold text-[#1a1c1b]">
              Past Interviews
            </h2>
            <span className="text-sm text-[#55433d] font-medium">({past.length})</span>
          </div>
          <div className="space-y-2">
            {(past as InterviewWithApp[]).slice(0, 10).map((interview) => (
              <Link
                key={interview.id}
                href={`/applications/${interview.application_id}`}
                className="db-app-row block"
              >
                <div className="flex items-center justify-between gap-4 w-full">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-[#1a1c1b] text-sm">
                        {interview.job_applications?.company || "Company"}
                      </span>
                      <span className={`db-status-badge ${statusBadge(interview.status)}`}>
                        {interview.status}
                      </span>
                    </div>
                    <p className="text-xs text-[#55433d]/70 mt-0.5">
                      {interview.type} · Round {interview.round} · {formatDate(interview.scheduled_at)}
                    </p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
