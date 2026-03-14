import Link from "next/link";
import { Calendar, Video, MapPin, Clock } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui";
import type { Interview } from "@/types";

interface UpcomingInterviewsProps {
  interviews: (Interview & { job_applications?: { company: string; position: string } })[];
}

export function UpcomingInterviews({ interviews }: UpcomingInterviewsProps) {
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="h-5 w-5 text-primary" />
          Upcoming Interviews
        </CardTitle>
        <CardDescription>Your scheduled interviews</CardDescription>
      </CardHeader>
      <CardContent>
        {interviews.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            No upcoming interviews scheduled
          </p>
        ) : (
          <div className="space-y-4">
            {interviews.map((interview) => (
              <Link
                key={interview.id}
                href={`/applications/${interview.application_id}`}
                className="block p-3 rounded-lg border hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">
                      {interview.job_applications?.position || "Interview"}
                    </p>
                    <p className="text-sm text-muted-foreground truncate">
                      {interview.job_applications?.company}
                    </p>
                    <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {formatDate(interview.scheduled_at)} at {formatTime(interview.scheduled_at)}
                      </span>
                      {interview.meeting_url && (
                        <span className="flex items-center gap-1">
                          <Video className="h-3 w-3" />
                          Video
                        </span>
                      )}
                      {interview.location && (
                        <span className="flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          On-site
                        </span>
                      )}
                    </div>
                  </div>
                  <span className="text-xs font-medium px-2 py-1 rounded bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300">
                    {interview.type}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
