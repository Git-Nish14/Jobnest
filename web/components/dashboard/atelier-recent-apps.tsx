import Link from "next/link";
import type { JobApplication } from "@/types";

interface AtelierRecentAppsProps {
  applications: JobApplication[];
}

function statusBadgeClass(status: string): string {
  switch (status) {
    case "Interview":
    case "In Review":
      return "db-badge db-badge-interview";
    case "Phone Screen":
      return "db-badge db-badge-screen";
    case "Offer":
    case "Accepted":
      return "db-badge db-badge-offer";
    case "Rejected":
      return "db-badge db-badge-rejected";
    default:
      return "db-badge db-badge-neutral";
  }
}

function formatAppliedDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function AtelierRecentApps({ applications }: AtelierRecentAppsProps) {
  return (
    <div>
      {/* Section header */}
      <div className="flex justify-between items-end mb-5">
        <div>
          <h2 className="db-headline text-3xl text-[#1a1c1b]">Recent Applications</h2>
          <p className="text-sm text-[#55433d] mt-1">Manage and track your active progress</p>
        </div>
        <Link href="/applications" className="db-link-primary">
          View All History
        </Link>
      </div>

      {applications.length === 0 ? (
        <div className="db-panel text-center py-10">
          <p className="text-[#55433d] text-sm mb-3">No applications tracked yet.</p>
          <Link href="/applications/new" className="db-btn-primary">
            Add your first application
          </Link>
        </div>
      ) : (
        <div className="space-y-2">
          {applications.map((app) => (
            <Link key={app.id} href={`/applications/${app.id}`} className="db-app-row block">
              <div className="flex items-center justify-between gap-4 w-full">
                {/* Left: avatar + info */}
                <div className="flex items-center gap-4 min-w-0">
                  <div className="db-company-avatar">
                    {app.company.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-[#1a1c1b] text-sm truncate">{app.position}</p>
                    <p className="text-sm text-[#55433d] truncate">
                      {app.company}
                      {app.location ? ` · ${app.location}` : ""}
                    </p>
                  </div>
                </div>

                {/* Right: date + badge */}
                <div className="flex items-center gap-6 flex-shrink-0 mt-3 md:mt-0">
                  <div className="text-right hidden md:block">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-[#55433d]">Applied</p>
                    <p className="text-sm font-medium text-[#1a1c1b]">
                      {formatAppliedDate(app.applied_date)}
                    </p>
                  </div>
                  <span className={statusBadgeClass(app.status)}>{app.status}</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
