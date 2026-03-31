"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ExternalLink, MapPin, Calendar } from "lucide-react";
import type { JobApplication } from "@/types";
import type { ApplicationStatus } from "@/config/constants";

const COLUMNS: { status: ApplicationStatus; label: string; accent: string; bg: string; darkBg: string }[] = [
  { status: "Applied",      label: "Applied",      accent: "#f59e0b", bg: "bg-amber-50",             darkBg: "dark:bg-amber-950/20" },
  { status: "Phone Screen", label: "Phone Screen", accent: "#ccff00", bg: "bg-[#fdf6f3]",            darkBg: "dark:bg-[#ccff00]/5" },
  { status: "Interview",    label: "Interview",    accent: "#4ade80", bg: "bg-emerald-50",            darkBg: "dark:bg-emerald-950/20" },
  { status: "Offer",        label: "Offer",        accent: "#60a5fa", bg: "bg-blue-50",              darkBg: "dark:bg-blue-950/20" },
  { status: "Rejected",     label: "Rejected",     accent: "#ff5f5f", bg: "bg-red-50",               darkBg: "dark:bg-red-950/20" },
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

  const isDragging = draggingId !== null;

  return (
    /* Mobile: horizontal-scroll flex  |  Desktop (lg+): full-width 5-column grid */
    <div className="flex gap-3 overflow-x-auto pb-4 -mx-1 px-1 lg:grid lg:grid-cols-5 lg:gap-4 lg:overflow-x-visible">
      {COLUMNS.map(({ status, label, accent, bg, darkBg }) => {
        const cards = byStatus(status);
        const isOver = dragOverCol === status;
        return (
          <div key={status} className="flex flex-col shrink-0 w-64 sm:w-72 lg:w-auto lg:shrink lg:min-w-0">
            {/* Column header */}
            <div className="flex items-center justify-between mb-2 px-1">
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: accent }} />
                <span className="text-sm font-semibold text-foreground">{label}</span>
              </div>
              <span className="text-xs text-muted-foreground bg-muted rounded-full px-2 py-0.5">
                {cards.length}
              </span>
            </div>

            {/* Drop zone */}
            <div
              className={`flex flex-col gap-2 flex-1 min-h-50 rounded-xl p-2 transition-colors ${bg} ${darkBg} ${
                isOver ? "ring-2 ring-[#ccff00]/40 dark:ring-[#ccff00]/30" : ""
              }`}
              onDragOver={(e) => onDragOver(e, status)}
              onDragEnter={(e) => { e.preventDefault(); setDragOverCol(status); }}
              onDragLeave={(e) => {
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
                  neutralised={isDragging && draggingId !== app.id}
                  onDragStart={(e) => onDragStart(e, app.id)}
                  onDragEnd={onDragEnd}
                />
              ))}

              {cards.length === 0 && (
                <div className="flex-1 flex items-center justify-center">
                  <p className="text-xs text-muted-foreground/60 text-center px-2">Drop a card here</p>
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
      className={`group bg-white dark:bg-[#111111] rounded-xl p-3.5 border border-border/30 dark:border-white/6 shadow-sm transition-all select-none ${
        neutralised
          ? "pointer-events-none"
          : "cursor-grab active:cursor-grabbing hover:shadow-md hover:-translate-y-0.5"
      } ${isDragging ? "opacity-40 scale-95" : ""}`}
    >
      {/* Company + avatar */}
      <div className="flex items-start gap-2.5 mb-2">
        <div className="h-8 w-8 rounded-lg bg-muted dark:bg-[#ccff00]/10 flex items-center justify-center text-xs font-bold text-primary dark:text-[#ccff00] shrink-0">
          {initial}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground truncate leading-tight">
            {app.company}
          </p>
          <p className="text-xs text-muted-foreground truncate">{app.position}</p>
        </div>
      </div>

      {/* Meta */}
      <div className="flex flex-col gap-1">
        {app.location && (
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <MapPin className="h-3 w-3 shrink-0" />
            {app.location}
          </span>
        )}
        <span className="flex items-center gap-1 text-xs text-muted-foreground">
          <Calendar className="h-3 w-3 shrink-0" />
          {new Date(app.applied_date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
        </span>
      </div>

      {/* Action link */}
      <div className="mt-2.5 pt-2.5 border-t border-border/20 dark:border-white/6 flex justify-end opacity-0 group-hover:opacity-100 transition-opacity">
        <Link
          href={`/applications/${app.id}`}
          className="flex items-center gap-1 text-xs text-primary dark:text-[#ccff00] hover:underline"
          onClick={(e) => e.stopPropagation()}
        >
          <ExternalLink className="h-3 w-3" />
          View
        </Link>
      </div>
    </div>
  );
}
