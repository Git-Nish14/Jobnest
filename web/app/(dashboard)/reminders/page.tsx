import { Bell, Clock, CheckCircle2 } from "lucide-react";
import { getReminders, getDueReminders } from "@/services";
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
    <div>
      {/* ── Header ── */}
      <header className="db-page-header">
        <div>
          <h1 className="db-page-title">Reminders</h1>
          <p className="db-page-subtitle">
            Stay on top of your follow-ups and deadlines with thoughtful precision.
          </p>
        </div>
        <ReminderForm />
      </header>

      <div className="space-y-8">
        {/* Overdue */}
        {overdue.length > 0 && (
          <section>
            <div className="flex items-center gap-3 mb-4">
              <Clock className="h-5 w-5 text-[#ba1a1a]" />
              <h2 className="db-headline text-xl font-semibold text-[#ba1a1a]">
                Overdue ({overdue.length})
              </h2>
            </div>
            <div className="db-content-card border border-[#ba1a1a]/15">
              <ReminderList reminders={overdue} />
            </div>
          </section>
        )}

        {/* Pending */}
        <section>
          <div className="flex items-center gap-3 mb-4">
            <Bell className="h-5 w-5 text-[#99462a]" />
            <h2 className="db-headline text-xl font-semibold text-[#1a1c1b]">
              Upcoming Reminders
            </h2>
          </div>
          <div className="db-content-card">
            {pending.length === 0 ? (
              <div className="flex flex-col items-center py-12 text-center">
                <Bell className="h-10 w-10 text-[#55433d]/30 mb-3" />
                <p className="text-[#55433d] font-medium">No pending reminders</p>
                <p className="text-sm text-[#55433d]/60 mt-1">
                  Create reminders to stay on top of follow-ups
                </p>
              </div>
            ) : (
              <ReminderList reminders={pending} />
            )}
          </div>
        </section>

        {/* Completed */}
        {completed.length > 0 && (
          <section>
            <div className="flex items-center gap-3 mb-4">
              <CheckCircle2 className="h-5 w-5 text-[#55433d]/50" />
              <h2 className="db-headline text-xl font-semibold text-[#55433d]">
                Completed ({completed.length})
              </h2>
            </div>
            <div className="db-content-card">
              <ReminderList reminders={completed.slice(0, 10)} showCompleted />
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
