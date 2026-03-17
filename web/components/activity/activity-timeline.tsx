import {
  Activity,
  PlusCircle,
  RefreshCw,
  Calendar,
  CheckCircle,
  FileText,
  Upload,
  Bell,
  UserPlus,
  Edit,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui";
import type { ActivityLog } from "@/types";

interface ActivityTimelineProps {
  activities: ActivityLog[];
}

const activityIcons: Record<string, React.ReactNode> = {
  Created: <PlusCircle className="h-4 w-4" />,
  "Status Changed": <RefreshCw className="h-4 w-4" />,
  "Interview Scheduled": <Calendar className="h-4 w-4" />,
  "Interview Completed": <CheckCircle className="h-4 w-4" />,
  "Note Added": <FileText className="h-4 w-4" />,
  "Document Uploaded": <Upload className="h-4 w-4" />,
  "Reminder Set": <Bell className="h-4 w-4" />,
  "Contact Added": <UserPlus className="h-4 w-4" />,
  Updated: <Edit className="h-4 w-4" />,
};

const activityColors: Record<string, string> = {
  Created: "bg-green-100 text-green-600",
  "Status Changed": "bg-blue-100 text-blue-600",
  "Interview Scheduled": "bg-purple-100 text-purple-600",
  "Interview Completed": "bg-emerald-100 text-emerald-600",
  "Note Added": "bg-yellow-100 text-yellow-600",
  "Document Uploaded": "bg-orange-100 text-orange-600",
  "Reminder Set": "bg-pink-100 text-pink-600",
  "Contact Added": "bg-cyan-100 text-cyan-600",
  Updated: "bg-gray-100 text-gray-600",
};

export function ActivityTimeline({ activities }: ActivityTimelineProps) {
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor(diff / (1000 * 60));

    if (minutes < 1) return "Just now";
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;

    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Activity className="h-5 w-5" />
          Activity
        </CardTitle>
      </CardHeader>
      <CardContent>
        {activities.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            No activity recorded yet
          </p>
        ) : (
          <div className="relative space-y-4">
            {/* Timeline line */}
            <div className="absolute left-[17px] top-2 bottom-2 w-px bg-border" />

            {activities.slice(0, 10).map((activity) => (
              <div key={activity.id} className="relative flex gap-3">
                <div
                  className={`flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center z-10 ${
                    activityColors[activity.activity_type] || activityColors.Updated
                  }`}
                >
                  {activityIcons[activity.activity_type] || <Activity className="h-4 w-4" />}
                </div>
                <div className="flex-1 min-w-0 pt-1">
                  <p className="text-sm">{activity.description}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {formatDate(activity.created_at)}
                  </p>
                </div>
              </div>
            ))}

            {activities.length > 10 && (
              <p className="text-xs text-muted-foreground text-center pt-2">
                +{activities.length - 10} more activities
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
