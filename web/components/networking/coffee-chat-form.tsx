"use client";

import { useState } from "react";
import { toast } from "sonner";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
  Button, Input, Label, Textarea,
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui";
import type { CoffeeChat, ChatMedium, ChatStatus, Contact } from "@/types";

const MEDIUMS: ChatMedium[] = ["Zoom", "Phone", "In-person", "Google Meet", "Teams"];
const STATUSES: ChatStatus[] = ["Scheduled", "Completed", "Cancelled", "No-show"];

interface CoffeeChatFormProps {
  open: boolean;
  onClose: () => void;
  onSaved: (chat: CoffeeChat) => void;
  contacts: Contact[];
  existing?: CoffeeChat;
}

function toLocalDatetimeValue(iso: string) {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function toISOFromLocal(localDt: string) {
  return new Date(localDt).toISOString();
}

export function CoffeeChatForm({ open, onClose, onSaved, contacts, existing }: CoffeeChatFormProps) {
  const [contactId,      setContactId]      = useState(existing?.contact_id ?? "");
  const [scheduledAt,    setScheduledAt]    = useState(existing ? toLocalDatetimeValue(existing.scheduled_at) : "");
  const [medium,         setMedium]         = useState<ChatMedium>(existing?.medium ?? "Zoom");
  const [status,         setStatus]         = useState<ChatStatus>(existing?.status ?? "Scheduled");
  const [agenda,         setAgenda]         = useState(existing?.agenda ?? "");
  const [notes,          setNotes]          = useState(existing?.notes ?? "");
  const [followUpSent,   setFollowUpSent]   = useState(existing?.follow_up_sent ?? false);
  const [referralOutcome, setReferralOutcome] = useState(existing?.referral_outcome ?? "");
  const [saving,         setSaving]         = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!scheduledAt) { toast.error("Please set a date and time."); return; }
    setSaving(true);
    try {
      const isEdit = !!existing?.id;
      const url    = isEdit ? `/api/networking/coffee-chats/${existing.id}` : "/api/networking/coffee-chats";
      const res    = await fetch(url, {
        method:  isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contact_id:      contactId      || null,
          scheduled_at:    toISOFromLocal(scheduledAt),
          medium,
          status,
          agenda:          agenda         || null,
          notes:           notes          || null,
          follow_up_sent:  followUpSent,
          referral_outcome: referralOutcome || null,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "Failed to save.");
      onSaved(json.chat);
      toast.success(isEdit ? "Coffee chat updated." : "Coffee chat scheduled.");
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="db-headline">{existing ? "Edit Coffee Chat" : "Schedule Coffee Chat"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          {/* Contact */}
          <div className="space-y-1.5">
            <Label htmlFor="cc-contact">Contact</Label>
            <Select value={contactId} onValueChange={setContactId}>
              <SelectTrigger id="cc-contact">
                <SelectValue placeholder="Select a contact…" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">None</SelectItem>
                {contacts.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}{c.company ? ` · ${c.company}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Date/time */}
          <div className="space-y-1.5">
            <Label htmlFor="cc-dt">Date & Time</Label>
            <Input
              id="cc-dt"
              type="datetime-local"
              value={scheduledAt}
              onChange={(e) => setScheduledAt(e.target.value)}
              required
              className="text-[16px] sm:text-sm"
            />
          </div>

          {/* Medium + Status in a row */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="cc-medium">Medium</Label>
              <Select value={medium} onValueChange={(v) => setMedium(v as ChatMedium)}>
                <SelectTrigger id="cc-medium"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {MEDIUMS.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cc-status">Status</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as ChatStatus)}>
                <SelectTrigger id="cc-status"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Agenda */}
          <div className="space-y-1.5">
            <Label htmlFor="cc-agenda">Agenda <span className="text-[#7a5c52] font-normal">(optional)</span></Label>
            <Textarea
              id="cc-agenda"
              placeholder="Topics to discuss…"
              value={agenda}
              onChange={(e) => setAgenda(e.target.value)}
              rows={2}
              maxLength={2000}
              className="text-[16px] sm:text-sm"
            />
          </div>

          {/* Post-chat notes (only shown when editing) */}
          {existing && (
            <div className="space-y-1.5">
              <Label htmlFor="cc-notes">Notes / Takeaways</Label>
              <Textarea
                id="cc-notes"
                placeholder="Key takeaways, referral outcome…"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                maxLength={5000}
                className="text-[16px] sm:text-sm"
              />
            </div>
          )}

          {/* Referral outcome + follow-up when editing */}
          {existing && (
            <div className="grid grid-cols-2 gap-3 items-end">
              <div className="space-y-1.5">
                <Label htmlFor="cc-outcome">Referral Outcome</Label>
                <Input
                  id="cc-outcome"
                  placeholder="e.g. Agreed to refer"
                  value={referralOutcome}
                  onChange={(e) => setReferralOutcome(e.target.value)}
                  maxLength={500}
                  className="text-[16px] sm:text-sm"
                />
              </div>
              <label className="flex items-center gap-2 text-sm text-[#55433d] dark:text-[#c9a99a] cursor-pointer pb-1">
                <input
                  type="checkbox"
                  checked={followUpSent}
                  onChange={(e) => setFollowUpSent(e.target.checked)}
                  className="accent-[#99462a]"
                />
                Follow-up sent
              </label>
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Saving…" : existing ? "Save Changes" : "Schedule"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
