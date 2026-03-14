import { Bell, Clock, CheckCircle2 } from "lucide-react";
import { getReminders, getDueReminders } from "@/services";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui";
import { ReminderList, ReminderForm } from "@/components/reminders";

export const dynamic = "force-dynamic";

export default async function RemindersPage() {
  const [{ data: reminders }, { data: dueReminders }] = await Promise.all([
    getReminders(undefined, true),
    getDueReminders(),
  ]);

  const pending = (reminders || []).filter((r) => !r.is_completed);
  const completed = (reminders || []).filter((r) => r.is_completed);
  const overdue = dueReminders || [];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Reminders</h1>
          <p className="text-muted-foreground">
            Stay on top of your follow-ups and deadlines
          </p>
        </div>
        <ReminderForm />
      </div>

      {/* Overdue Reminders */}
      {overdue.length > 0 && (
        <Card className="border-red-200 dark:border-red-900">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-600 dark:text-red-400">
              <Clock className="h-5 w-5" />
              Overdue ({overdue.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ReminderList reminders={overdue} />
          </CardContent>
        </Card>
      )}

      {/* Pending Reminders */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5 text-primary" />
            Upcoming Reminders
          </CardTitle>
        </CardHeader>
        <CardContent>
          {pending.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Bell className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No pending reminders</p>
              <p className="text-sm mt-1">
                Create reminders to stay on top of follow-ups
              </p>
            </div>
          ) : (
            <ReminderList reminders={pending} />
          )}
        </CardContent>
      </Card>

      {/* Completed Reminders */}
      {completed.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-muted-foreground">
              <CheckCircle2 className="h-5 w-5" />
              Completed ({completed.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ReminderList reminders={completed.slice(0, 10)} showCompleted />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
