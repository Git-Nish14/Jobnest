"use client";

import { useState, useMemo } from "react";
import { Plus, Pencil, Trash2, Coffee, Calendar, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui";
import type { CoffeeChat, ChatStatus, Contact } from "@/types";
import { CoffeeChatForm } from "./coffee-chat-form";
import { formatDateTime, formatRelativeDate } from "@/lib/utils/date";

const STATUS_STYLE: Record<ChatStatus, string> = {
  Scheduled:  "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  Completed:  "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  Cancelled:  "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400",
  "No-show":  "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300",
};

const MEDIUM_EMOJI: Record<string, string> = {
  Zoom: "💻", Phone: "📞", "In-person": "🤝", "Google Meet": "💻", Teams: "💻",
};

// Defined at module scope so React sees a stable component reference and never
// unnecessarily unmounts/remounts card instances when parent state changes.
interface ChatCardProps {
  chat: CoffeeChat;
  confirmDel: string | null;
  deleting: string | null;
  onEdit: (chat: CoffeeChat) => void;
  onConfirmDel: (id: string) => void;
  onCancelDel: () => void;
  onDelete: (id: string) => void;
}

function ChatCard({ chat, confirmDel, deleting, onEdit, onConfirmDel, onCancelDel, onDelete }: ChatCardProps) {
  const contactName = chat.contact?.name ?? "Unknown contact";
  const emoji       = MEDIUM_EMOJI[chat.medium] ?? "💬";

  return (
    <div className="flex items-start gap-3 py-4 first:pt-0 last:pb-0">
      <div className="h-10 w-10 rounded-xl bg-[#99462a]/10 dark:bg-[#99462a]/20 flex items-center justify-center shrink-0 text-lg">
        {emoji}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="font-semibold text-sm text-[#3d2b23] dark:text-[#e8d5cc]">{contactName}</p>
          <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_STYLE[chat.status]}`}>
            {chat.status}
          </span>
          {chat.follow_up_sent && (
            <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">✓ Follow-up sent</span>
          )}
        </div>
        <div className="flex items-center gap-2 mt-0.5 text-xs text-[#7a5c52] dark:text-[#b08070] flex-wrap">
          <span className="flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            {chat.status === "Scheduled" ? formatRelativeDate(chat.scheduled_at) : formatDateTime(chat.scheduled_at)}
          </span>
          <span>{chat.medium}</span>
          {chat.contact?.company && <span>· {chat.contact.company}</span>}
        </div>
        {chat.agenda && (
          <p className="mt-1 text-xs text-[#55433d] dark:text-[#c9a99a] line-clamp-1">{chat.agenda}</p>
        )}
        {chat.referral_outcome && (
          <p className="mt-1 text-xs font-medium text-[#99462a] dark:text-[#d97757]">
            Outcome: {chat.referral_outcome}
          </p>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 shrink-0">
        {confirmDel === chat.id ? (
          <div className="flex items-center gap-1">
            <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
            <button
              onClick={() => onDelete(chat.id)}
              disabled={deleting === chat.id}
              className="text-xs text-red-600 dark:text-red-400 font-semibold hover:underline disabled:opacity-60"
            >
              {deleting === chat.id ? "Deleting…" : "Confirm"}
            </button>
            <button
              onClick={onCancelDel}
              className="text-xs text-[#7a5c52] dark:text-[#b08070] hover:underline"
            >
              Cancel
            </button>
          </div>
        ) : (
          <>
            <button
              onClick={() => onEdit(chat)}
              className="h-8 w-8 flex items-center justify-center rounded text-[#7a5c52] dark:text-[#b08070] hover:text-[#99462a] dark:hover:text-[#d97757] transition-colors"
              title="Edit"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => onConfirmDel(chat.id)}
              className="h-8 w-8 flex items-center justify-center rounded text-[#7a5c52] dark:text-[#b08070] hover:text-red-500 dark:hover:text-red-400 transition-colors"
              title="Delete"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </>
        )}
      </div>
    </div>
  );
}

interface CoffeeChatsTabProps {
  initialChats: CoffeeChat[];
  contacts: Contact[];
}

export function CoffeeChatsTab({ initialChats, contacts }: CoffeeChatsTabProps) {
  const [chats,      setChats]      = useState<CoffeeChat[]>(initialChats);
  const [formOpen,   setFormOpen]   = useState(false);
  const [editing,    setEditing]    = useState<CoffeeChat | undefined>();
  const [deleting,   setDeleting]   = useState<string | null>(null);
  const [confirmDel, setConfirmDel] = useState<string | null>(null);

  // Computed at render time — simple and correct; no stale useMemo capture
  const now      = new Date();
  const upcoming = useMemo(() => chats.filter((c) => c.status === "Scheduled" && new Date(c.scheduled_at) >= now), [chats]); // eslint-disable-line react-hooks/exhaustive-deps
  const past     = useMemo(() => chats.filter((c) => c.status !== "Scheduled" || new Date(c.scheduled_at) < now), [chats]); // eslint-disable-line react-hooks/exhaustive-deps

  function handleSaved(chat: CoffeeChat) {
    setChats((prev) => {
      const idx = prev.findIndex((x) => x.id === chat.id);
      if (idx >= 0) { const next = [...prev]; next[idx] = chat; return next; }
      return [chat, ...prev];
    });
  }

  async function handleDelete(id: string) {
    setDeleting(id);
    try {
      const res = await fetch(`/api/networking/coffee-chats/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      setChats((prev) => prev.filter((c) => c.id !== id));
      toast.success("Coffee chat deleted.");
    } catch {
      toast.error("Failed to delete.");
    } finally {
      setDeleting(null);
      setConfirmDel(null);
    }
  }

  function openEdit(chat: CoffeeChat) {
    setEditing(chat);
    setFormOpen(true);
  }

  const cardProps = { confirmDel, deleting, onEdit: openEdit, onConfirmDel: setConfirmDel, onCancelDel: () => setConfirmDel(null), onDelete: handleDelete };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="db-headline text-lg">Coffee Chats</h2>
          <p className="text-sm text-[#7a5c52] dark:text-[#b08070]">
            Schedule and log informational interviews and networking calls.
          </p>
        </div>
        <Button onClick={() => { setEditing(undefined); setFormOpen(true); }} className="shrink-0">
          <Plus className="h-4 w-4 mr-1.5" />
          Schedule Chat
        </Button>
      </div>

      {chats.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center gap-4">
          <div className="h-14 w-14 rounded-2xl bg-[#99462a]/10 dark:bg-[#99462a]/20 flex items-center justify-center">
            <Coffee className="h-7 w-7 text-[#99462a]" />
          </div>
          <div>
            <p className="font-semibold text-[#3d2b23] dark:text-[#e8d5cc]">No coffee chats yet</p>
            <p className="text-sm text-[#7a5c52] dark:text-[#b08070] mt-1 max-w-xs">
              Schedule informational interviews to build relationships and learn about companies.
            </p>
          </div>
          <Button onClick={() => { setEditing(undefined); setFormOpen(true); }}>
            <Plus className="h-4 w-4 mr-1.5" />
            Schedule First Chat
          </Button>
        </div>
      ) : (
        <>
          {upcoming.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-[#55433d] dark:text-[#c9a99a] uppercase tracking-wider mb-3">
                Upcoming ({upcoming.length})
              </h3>
              <div className="db-content-card divide-y divide-[#e8ddd8] dark:divide-[#2a1a10]">
                {upcoming.map((c) => <ChatCard key={c.id} chat={c} {...cardProps} />)}
              </div>
            </div>
          )}

          {past.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-[#55433d] dark:text-[#c9a99a] uppercase tracking-wider mb-3">
                Past ({past.length})
              </h3>
              <div className="db-content-card divide-y divide-[#e8ddd8] dark:divide-[#2a1a10]">
                {past.map((c) => <ChatCard key={c.id} chat={c} {...cardProps} />)}
              </div>
            </div>
          )}
        </>
      )}

      {/* key forces remount when switching between records so useState resets */}
      <CoffeeChatForm
        key={editing?.id ?? "new-chat"}
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onSaved={handleSaved}
        contacts={contacts}
        existing={editing}
      />
    </div>
  );
}
