import {
  Activity, PlusCircle, RefreshCw, Calendar, CheckCircle,
  FileText, Upload, Bell, UserPlus, Edit,
} from "lucide-react";
import type { ActivityLog } from "@/types";

interface ActivityTimelineProps {
  activities: ActivityLog[];
}

// Atelier-toned activity icon containers
const activityTokens: Record<string, { icon: React.ReactNode; token: string }> = {
  "Created":              { icon: <PlusCircle className="h-3.5 w-3.5" />,  token: "bg-[#006d34]/10 text-[#006d34]" },
  "Status Changed":       { icon: <RefreshCw className="h-3.5 w-3.5" />,   token: "bg-[#99462a]/10 text-[#99462a]" },
  "Interview Scheduled":  { icon: <Calendar className="h-3.5 w-3.5" />,    token: "bg-[#55433d]/10 text-[#55433d]" },
  "Interview Completed":  { icon: <CheckCircle className="h-3.5 w-3.5" />, token: "bg-[#006d34]/14 text-[#005225]" },
  "Note Added":           { icon: <FileText className="h-3.5 w-3.5" />,    token: "bg-amber-500/10 text-amber-700" },
  "Document Uploaded":    { icon: <Upload className="h-3.5 w-3.5" />,      token: "bg-[#99462a]/10 text-[#99462a]" },
  "Reminder Set":         { icon: <Bell className="h-3.5 w-3.5" />,        token: "bg-[#006d34]/10 text-[#006d34]" },
  "Contact Added":        { icon: <UserPlus className="h-3.5 w-3.5" />,    token: "bg-[#55433d]/10 text-[#55433d]" },
  "Updated":              { icon: <Edit className="h-3.5 w-3.5" />,         token: "bg-[#dbc1b9]/40 text-[#55433d]" },
};

const fallbackToken = { icon: <Activity className="h-3.5 w-3.5" />, token: "bg-[#dbc1b9]/40 text-[#55433d]" };

export function ActivityTimeline({ activities }: ActivityTimelineProps) {
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60_000);
    const hours = Math.floor(diff / 3_600_000);
    const days = Math.floor(diff / 86_400_000);

    if (minutes < 1) return "Just now";
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;

    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  return (
    <section className="db-content-card">
      <h2 className="db-headline text-xl font-semibold text-[#1a1c1b] flex items-center gap-2 mb-5">
        <Activity className="h-5 w-5 text-[#99462a]" />
        Activity
      </h2>

      {activities.length === 0 ? (
        <p className="text-sm text-[#55433d]/60 text-center py-6 italic">
          No activity recorded yet
        </p>
      ) : (
        <div className="relative space-y-4">
          {/* Vertical timeline line */}
          <div className="absolute left-[17px] top-2 bottom-2 w-px bg-[#dbc1b9]/30" />

          {activities.slice(0, 10).map((activity) => {
            const { icon, token } = activityTokens[activity.activity_type] ?? fallbackToken;
            return (
              <div key={activity.id} className="relative flex gap-3">
                <div className={`shrink-0 w-9 h-9 rounded-full flex items-center justify-center z-10 ${token}`}>
                  {icon}
                </div>
                <div className="flex-1 min-w-0 pt-1.5">
                  <p className="text-sm text-[#1a1c1b] leading-snug">{activity.description}</p>
                  <p className="text-xs text-[#55433d]/50 mt-0.5">{formatDate(activity.created_at)}</p>
                </div>
              </div>
            );
          })}

          {activities.length > 10 && (
            <p className="text-xs text-[#55433d]/50 text-center pt-1">
              +{activities.length - 10} more activities
            </p>
          )}
        </div>
      )}
    </section>
  );
}
