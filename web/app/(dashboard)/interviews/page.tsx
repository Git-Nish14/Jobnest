import Link from "next/link";

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
import { Calendar, Video, MapPin, Clock, User } from "lucide-react";
import { getUpcomingInterviews, getInterviews } from "@/services";
import { Button, Card, CardContent, CardHeader, CardTitle } from "@/components/ui";

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

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "Scheduled":
        return "bg-blue-100 text-blue-700";
      case "Completed":
        return "bg-green-100 text-green-700";
      case "Cancelled":
        return "bg-red-100 text-red-700";
      case "Rescheduled":
        return "bg-yellow-100 text-yellow-700";
      default:
        return "bg-gray-100 text-gray-700";
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case "Phone Screen":
        return "bg-purple-100 text-purple-700";
      case "Technical":
        return "bg-orange-100 text-orange-700";
      case "Behavioral":
        return "bg-cyan-100 text-cyan-700";
      case "On-site":
        return "bg-indigo-100 text-indigo-700";
      case "Final":
        return "bg-pink-100 text-pink-700";
      default:
        return "bg-gray-100 text-gray-700";
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Interviews</h1>
          <p className="text-muted-foreground">
            Manage your upcoming and past interviews
          </p>
        </div>
      </div>

      {/* Upcoming Interviews */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-primary" />
            Upcoming Interviews
          </CardTitle>
        </CardHeader>
        <CardContent>
          {upcoming.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No upcoming interviews scheduled</p>
              <p className="text-sm mt-1">
                Add interviews from your application details page
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {(upcoming as InterviewWithApp[]).map((interview) => (
                <div
                  key={interview.id}
                  className="flex flex-col sm:flex-row sm:items-center gap-4 p-4 rounded-lg border hover:bg-muted/50 transition-colors"
                >
                  {/* Clickable content area navigates to the application */}
                  <Link
                    href={`/applications/${interview.application_id}`}
                    className="flex-1 min-w-0"
                  >
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold">
                        {interview.job_applications?.position || "Interview"}
                      </h3>
                      <span className={`text-xs px-2 py-0.5 rounded ${getTypeColor(interview.type)}`}>
                        {interview.type}
                      </span>
                      <span className={`text-xs px-2 py-0.5 rounded ${getStatusColor(interview.status)}`}>
                        Round {interview.round}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      {interview.job_applications?.company}
                    </p>
                    <div className="flex flex-wrap items-center gap-4 mt-2 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Clock className="h-4 w-4" />
                        {formatDate(interview.scheduled_at)} at {formatTime(interview.scheduled_at)}
                      </span>
                      {interview.duration_minutes && (
                        <span>{interview.duration_minutes} min</span>
                      )}
                      {interview.meeting_url && (
                        <span className="flex items-center gap-1">
                          <Video className="h-4 w-4" />
                          Video Call
                        </span>
                      )}
                      {interview.location && (
                        <span className="flex items-center gap-1">
                          <MapPin className="h-4 w-4" />
                          {interview.location}
                        </span>
                      )}
                      {interview.interviewer_names?.length > 0 && (
                        <span className="flex items-center gap-1">
                          <User className="h-4 w-4" />
                          {interview.interviewer_names.join(", ")}
                        </span>
                      )}
                    </div>
                  </Link>

                  {/* Join button is a sibling to the Link — no stopPropagation needed */}
                  {interview.meeting_url && (
                    <a
                      href={interview.meeting_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="shrink-0"
                    >
                      <Button size="sm" className="gap-2">
                        <Video className="h-4 w-4" />
                        Join
                      </Button>
                    </a>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Past Interviews */}
      {past.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Past Interviews</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {(past as InterviewWithApp[]).slice(0, 10).map((interview) => (
                <Link
                  key={interview.id}
                  href={`/applications/${interview.application_id}`}
                  className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">
                        {interview.job_applications?.company || "Company"}
                      </span>
                      <span className={`text-xs px-2 py-0.5 rounded ${getStatusColor(interview.status)}`}>
                        {interview.status}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {interview.type} - Round {interview.round} •{" "}
                      {formatDate(interview.scheduled_at)}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
