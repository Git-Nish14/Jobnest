"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { ArrowUpRight, Check, Clock } from "lucide-react";
import type { SearchAction } from "@/lib/job-search/planner";
import { dateLabel } from "@/lib/job-search/calendar";

export function NextActions({ actions, today, totalReminders, overdueCount }: {
  actions: SearchAction[]; today: string; totalReminders: number; overdueCount: number;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  async function update(id: string, action: "complete" | "reopen" | "snooze") {
    setBusy(id); setError(null);
    try {
      const res = await fetch(`/api/reminders/${id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(action === "snooze" ? { action, remindAt: new Date(Date.now() + 86_400_000).toISOString() } : { action }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Could not update reminder");
      if (action === "complete") toast.success("Reminder completed", { action: { label: "Undo", onClick: () => void update(id, "reopen") } });
      router.refresh();
    } catch (err) { setError(err instanceof Error ? err.message : "Could not update reminder"); }
    finally { setBusy(null); }
  }
  return <section className="db-content-card min-w-0" aria-labelledby="next-actions-title">
    <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
      <div><h2 id="next-actions-title" className="db-headline text-2xl">Next actions</h2>
        <p className="text-sm text-muted-foreground mt-1">{overdueCount > 0 ? `${overdueCount} overdue reminder${overdueCount === 1 ? "" : "s"} to review.` : "Start with commitments that need your attention."}</p></div>
      <Link href="/reminders" className="db-link-primary text-sm">All reminders ({totalReminders})</Link>
    </div>
    {error && <p role="alert" className="text-sm text-red-600 mb-3">{error}</p>}
    {actions.length === 0 ? <div className="rounded-xl bg-muted/50 p-4"><p className="text-sm">No recorded commitments are due. Your weekly plan can help choose your next move.</p><Link href="/reminders" className="db-link-primary text-sm mt-2 inline-block">Add a reminder</Link></div>
      : <ul className="space-y-3">{actions.slice(0, 6).map((action) => <li key={action.key} className="rounded-xl border border-border p-3 sm:p-4">
        <div className="flex flex-wrap items-center gap-2 text-xs mb-2">
          <span className={action.dueDate < today ? "font-semibold text-red-600 dark:text-red-400" : "text-muted-foreground"}>{action.dueDate < today ? "Overdue" : action.dueDate === today ? "Today" : dateLabel(action.dueDate)}</span>
          <span className="text-muted-foreground inline-flex items-center gap-1"><Clock className="w-3 h-3" />{action.minutes} min estimate</span>
        </div>
        <Link href={action.href} className="font-semibold text-sm inline-flex items-center gap-1">{action.title}<ArrowUpRight className="w-4 h-4 shrink-0" /></Link>
        <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{action.reason}</p>
        {action.reminderId && <div className="flex gap-2 mt-3"><button type="button" disabled={busy !== null} onClick={() => void update(action.reminderId!, "complete")} className="db-btn-page-secondary text-xs min-h-10 inline-flex items-center gap-1"><Check className="w-3 h-3" />Complete</button>
          <button type="button" disabled={busy !== null} onClick={() => void update(action.reminderId!, "snooze")} className="text-xs db-link-primary min-h-10 px-2">Snooze 24 hours</button></div>}
      </li>)}</ul>}
    {actions.length > 6 && <p className="text-xs text-muted-foreground mt-3">Showing the next 6 commitments. Open reminders or interview preparation for the full lists.</p>}
  </section>;
}
