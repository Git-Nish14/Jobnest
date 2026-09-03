"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCheck, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";

interface ReminderBulkActionsProps {
  pendingIds: string[];
  completedIds: string[];
}

export function ReminderBulkActions({ pendingIds, completedIds }: ReminderBulkActionsProps) {
  const router = useRouter();
  const [loading, setLoading] = useState<"complete" | "delete-completed" | "delete-all" | null>(null);

  const markAllComplete = async () => {
    if (pendingIds.length === 0) return;
    setLoading("complete");
    const supabase = createClient();
    const { error } = await supabase
      .from("reminders")
      .update({ is_completed: true, completed_at: new Date().toISOString() })
      .in("id", pendingIds);
    if (error) toast.error("Failed to mark all complete");
    else { toast.success(`${pendingIds.length} reminder${pendingIds.length !== 1 ? "s" : ""} marked complete`); router.refresh(); }
    setLoading(null);
  };

  const deleteCompleted = async () => {
    if (completedIds.length === 0) return;
    if (!confirm(`Delete all ${completedIds.length} completed reminder${completedIds.length !== 1 ? "s" : ""}? This cannot be undone.`)) return;
    setLoading("delete-completed");
    const supabase = createClient();
    const { error } = await supabase.from("reminders").delete().in("id", completedIds);
    if (error) toast.error("Failed to delete completed reminders");
    else { toast.success("Completed reminders cleared"); router.refresh(); }
    setLoading(null);
  };

  const deleteAll = async () => {
    const allIds = [...pendingIds, ...completedIds];
    if (allIds.length === 0) return;
    if (!confirm(`Delete all ${allIds.length} reminder${allIds.length !== 1 ? "s" : ""}? This cannot be undone.`)) return;
    setLoading("delete-all");
    const supabase = createClient();
    const { error } = await supabase.from("reminders").delete().in("id", allIds);
    if (error) toast.error("Failed to delete all reminders");
    else { toast.success("All reminders deleted"); router.refresh(); }
    setLoading(null);
  };

  const isWorking = loading !== null;

  return (
    <div className="flex items-center gap-3 shrink-0 flex-wrap">
      {pendingIds.length > 0 && (
        <button
          type="button"
          onClick={markAllComplete}
          disabled={isWorking}
          className="flex items-center gap-1.5 text-sm text-[#55433d]/70 hover:text-[#006d34] transition-colors disabled:opacity-40"
          title="Mark all pending reminders as complete"
        >
          {loading === "complete"
            ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
            : <CheckCheck className="h-3.5 w-3.5" />}
          Mark all complete
        </button>
      )}
      {completedIds.length > 0 && (
        <button
          type="button"
          onClick={deleteCompleted}
          disabled={isWorking}
          className="flex items-center gap-1.5 text-sm text-[#ba1a1a]/60 hover:text-[#ba1a1a] transition-colors disabled:opacity-40"
          title="Delete all completed reminders"
        >
          {loading === "delete-completed"
            ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
            : <Trash2 className="h-3.5 w-3.5" />}
          Clear completed
        </button>
      )}
      {(pendingIds.length > 0 || completedIds.length > 0) && (
        <button
          type="button"
          onClick={deleteAll}
          disabled={isWorking}
          className="flex items-center gap-1.5 text-sm text-[#ba1a1a]/40 hover:text-[#ba1a1a] transition-colors disabled:opacity-40"
          title="Delete all reminders"
        >
          {loading === "delete-all"
            ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
            : <Trash2 className="h-3.5 w-3.5" />}
          Delete all
        </button>
      )}
    </div>
  );
}
