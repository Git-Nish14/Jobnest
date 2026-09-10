import { getReminders, getDueReminders } from "@/services";
import { RemindersRealtimeProvider, ReminderForm, ReminderBulkActions } from "@/components/reminders";

export const dynamic = "force-dynamic";

export default async function RemindersPage() {
  const [{ data: reminders }, { data: dueReminders }] = await Promise.all([
    getReminders(undefined, true),
    getDueReminders(),
  ]);

  const allReminders = reminders ?? [];
  const allDue = dueReminders ?? [];

  const completedIds = allReminders
    .filter((r) => r.is_completed)
    .map((r) => r.id);

  // Union of overdue + pending for bulk actions (dedup by id)
  const bulkPendingIds = Array.from(
    new Set([...allDue, ...allReminders.filter((r) => !r.is_completed)].map((r) => r.id))
  );

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
        <div className="flex items-center gap-3 flex-wrap">
          <ReminderBulkActions
            pendingIds={bulkPendingIds}
            completedIds={completedIds}
          />
          <ReminderForm />
        </div>
      </header>

      {/* ── Live-updating reminder lists via Supabase Realtime ── */}
      <RemindersRealtimeProvider
        initialReminders={allReminders}
        initialDueReminders={allDue}
      />
    </div>
  );
}
