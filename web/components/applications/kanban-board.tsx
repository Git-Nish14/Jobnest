"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ExternalLink, MapPin, Calendar } from "lucide-react";
import type { JobApplication } from "@/types";
import type { ApplicationStatus } from "@/config/constants";

const COLUMNS: { status: ApplicationStatus; label: string; accent: string; bg: string }[] = [
  { status: "Applied",      label: "Applied",      accent: "#f59e0b", bg: "bg-amber-50 dark:bg-amber-950/20" },
  { status: "Phone Screen", label: "Phone Screen", accent: "#99462a", bg: "bg-[#fdf6f3] dark:bg-[#99462a]/10" },
  { status: "Interview",    label: "Interview",    accent: "#006d34", bg: "bg-emerald-50 dark:bg-emerald-950/20" },
  { status: "Offer",        label: "Offer",        accent: "#1d4ed8", bg: "bg-blue-50 dark:bg-blue-950/20" },
  { status: "Rejected",     label: "Rejected",     accent: "#ba1a1a", bg: "bg-red-50 dark:bg-red-950/20" },
];

interface KanbanBoardProps {
  applications: JobApplication[];
}

export function KanbanBoard({ applications }: KanbanBoardProps) {
  const router = useRouter();
  const [items, setItems] = useState(applications);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverCol, setDragOverCol] = useState<ApplicationStatus | null>(null);

  const byStatus = (status: ApplicationStatus) =>
    items.filter((a) => a.status === status);

  async function moveCard(id: string, newStatus: ApplicationStatus) {
    const prev = items;
    // Optimistic update
    setItems((cur) =>
      cur.map((a) => (a.id === id ? { ...a, status: newStatus } : a))
    );

    try {
      const res = await fetch(`/api/applications/${id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });

      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error((json as { error?: string }).error ?? `HTTP ${res.status}`);
      }

      router.refresh();
    } catch (err) {
      setItems(prev);
      const msg = err instanceof Error ? err.message : "Failed to update status";
      toast.error(msg);
    }
  }

  function onDragStart(e: React.DragEvent, id: string) {
    setDraggingId(id);
    e.dataTransfer.effectAllowed = "move";
    // Use two formats so it works across browsers
    e.dataTransfer.setData("text/plain", id);
    e.dataTransfer.setData("application/x-kanban-id", id);
  }

  function onDragOver(e: React.DragEvent, status: ApplicationStatus) {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = "move";
    setDragOverCol(status);
  }

  function onDrop(e: React.DragEvent, status: ApplicationStatus) {
    e.preventDefault();
    e.stopPropagation();

    // Try both formats
    const id =
      e.dataTransfer.getData("application/x-kanban-id") ||
      e.dataTransfer.getData("text/plain");

    if (!id) return;

    const card = items.find((a) => a.id === id);
    if (card && card.status !== status) moveCard(id, status);

    setDraggingId(null);
    setDragOverCol(null);
  }

  function onDragEnd() {
    setDraggingId(null);
    setDragOverCol(null);
  }

  // While a card is being dragged, neutralise pointer-events on all other
  // cards so they don't intercept dragover/drop as competing drag sources.
  const isDragging = draggingId !== null;

  return (
    <div className="flex gap-3 overflow-x-auto pb-4 -mx-1 px-1">
      {COLUMNS.map(({ status, label, accent, bg }) => {
        const cards = byStatus(status);
        const isOver = dragOverCol === status;
        return (
          <div key={status} className="flex flex-col shrink-0 w-64 sm:w-72">
            {/* Column header */}
            <div className="flex items-center justify-between mb-2 px-1">
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: accent }} />
                <span className="text-sm font-semibold text-[#1a1c1b] dark:text-[#e8ddd9]">{label}</span>
              </div>
              <span className="text-xs text-[#88726c] bg-[#f4f3f1] dark:bg-white/10 rounded-full px-2 py-0.5">
                {cards.length}
              </span>
            </div>

            {/* Drop zone — this is the drop target, not the outer column div */}
            <div
              className={`flex flex-col gap-2 flex-1 min-h-[200px] rounded-xl p-2 transition-colors ${bg} ${
                isOver ? "ring-2 ring-[#99462a]/30" : ""
              }`}
              onDragOver={(e) => onDragOver(e, status)}
              onDragEnter={(e) => { e.preventDefault(); setDragOverCol(status); }}
              onDragLeave={(e) => {
                // Only clear when the cursor leaves the drop zone entirely,
                // not when it enters a child element.
                if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                  setDragOverCol(null);
                }
              }}
              onDrop={(e) => onDrop(e, status)}
            >
              {cards.map((app) => (
                <KanbanCard
                  key={app.id}
                  app={app}
                  isDragging={draggingId === app.id}
                  // While board is in drag mode, neutralise other cards so they
                  // don't swallow dragover/drop events as competing drag sources.
                  neutralised={isDragging && draggingId !== app.id}
                  onDragStart={(e) => onDragStart(e, app.id)}
                  onDragEnd={onDragEnd}
                />
              ))}

              {cards.length === 0 && (
                <div className="flex-1 flex items-center justify-center">
                  <p className="text-xs text-[#88726c]/60 text-center px-2">Drop a card here</p>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

interface KanbanCardProps {
  app: JobApplication;
  isDragging: boolean;
  neutralised: boolean;
  onDragStart: (e: React.DragEvent) => void;
  onDragEnd: () => void;
}

function KanbanCard({ app, isDragging, neutralised, onDragStart, onDragEnd }: KanbanCardProps) {
  const initial = app.company.charAt(0).toUpperCase();

  return (
    <div
      draggable={!neutralised}
      onDragStart={neutralised ? undefined : onDragStart}
      onDragEnd={onDragEnd}
      // pointer-events-none on neutralised cards so dragover bubbles to the column
      className={`group bg-white dark:bg-[#1e1a18] rounded-xl p-3.5 border border-[#dbc1b9]/20 shadow-sm transition-all select-none ${
        neutralised
          ? "pointer-events-none"
          : "cursor-grab active:cursor-grabbing hover:shadow-md hover:-translate-y-0.5"
      } ${isDragging ? "opacity-40 scale-95" : ""}`}
    >
      {/* Company + avatar */}
      <div className="flex items-start gap-2.5 mb-2">
        <div className="h-8 w-8 rounded-lg bg-[#f4f3f1] dark:bg-white/10 flex items-center justify-center text-xs font-bold text-[#99462a] shrink-0">
          {initial}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-[#1a1c1b] dark:text-[#e8ddd9] truncate leading-tight">
            {app.company}
          </p>
          <p className="text-xs text-[#55433d] dark:text-[#a08880] truncate">{app.position}</p>
        </div>
      </div>

      {/* Meta */}
      <div className="flex flex-col gap-1">
        {app.location && (
          <span className="flex items-center gap-1 text-xs text-[#88726c]">
            <MapPin className="h-3 w-3 shrink-0" />
            {app.location}
          </span>
        )}
        <span className="flex items-center gap-1 text-xs text-[#88726c]">
          <Calendar className="h-3 w-3 shrink-0" />
          {new Date(app.applied_date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
        </span>
      </div>

      {/* Action link */}
      <div className="mt-2.5 pt-2.5 border-t border-[#dbc1b9]/15 flex justify-end opacity-0 group-hover:opacity-100 transition-opacity">
        <Link
          href={`/applications/${app.id}`}
          className="flex items-center gap-1 text-xs text-[#99462a] hover:underline"
          onClick={(e) => e.stopPropagation()}
        >
          <ExternalLink className="h-3 w-3" />
          View
        </Link>
      </div>
    </div>
  );
}
