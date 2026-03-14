"use client";

import Link from "next/link";
import { Bell, Clock, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Button,
} from "@/components/ui";
import { createClient } from "@/lib/supabase/client";
import type { Reminder } from "@/types";

interface PendingRemindersProps {
  reminders: (Reminder & { job_applications?: { company: string; position: string } | null })[];
}

export function PendingReminders({ reminders }: PendingRemindersProps) {
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = date.getTime() - now.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days < 0) return "Overdue";
    if (days === 0) return "Today";
    if (days === 1) return "Tomorrow";
    if (days < 7) return `In ${days} days`;

    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
  };

  const handleComplete = async (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const supabase = createClient();

    const { error } = await supabase
      .from("reminders")
      .update({
        is_completed: true,
        completed_at: new Date().toISOString(),
      })
      .eq("id", id);

    if (error) {
      toast.error("Failed to complete reminder");
    } else {
      toast.success("Reminder completed");
      window.location.reload();
    }
  };

  const getReminderTypeColor = (type: string) => {
    switch (type) {
      case "Follow Up":
        return "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300";
      case "Interview":
        return "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300";
      case "Deadline":
        return "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300";
      default:
        return "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300";
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bell className="h-5 w-5 text-primary" />
          Reminders
        </CardTitle>
        <CardDescription>Upcoming tasks and follow-ups</CardDescription>
      </CardHeader>
      <CardContent>
        {reminders.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            No pending reminders
          </p>
        ) : (
          <div className="space-y-3">
            {reminders.map((reminder) => (
              <div
                key={reminder.id}
                className="flex items-start gap-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors"
              >
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 flex-shrink-0 mt-0.5"
                  onClick={(e) => handleComplete(reminder.id, e)}
                  title="Mark as complete"
                >
                  <CheckCircle2 className="h-4 w-4 text-muted-foreground hover:text-primary" />
                </Button>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm">{reminder.title}</p>
                  {reminder.job_applications && (
                    <Link
                      href={`/applications/${reminder.application_id}`}
                      className="text-xs text-primary hover:underline"
                    >
                      {reminder.job_applications.company} - {reminder.job_applications.position}
                    </Link>
                  )}
                  <div className="flex items-center gap-2 mt-1">
                    <span className={`text-xs px-2 py-0.5 rounded ${getReminderTypeColor(reminder.type)}`}>
                      {reminder.type}
                    </span>
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {formatDate(reminder.remind_at)}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
