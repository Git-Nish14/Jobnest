"use client";

import { useState } from "react";
import { GraduationCap, Mail, Phone, Building2, ChevronDown } from "lucide-react";
import { LinkedinIcon } from "@/components/ui/brand-icons";
import { toast } from "sonner";
import type { Contact } from "@/types";
import { OUTREACH_STATUSES, type OutreachStatus } from "@/types/networking";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui";

const STATUS_STYLE: Record<OutreachStatus, string> = {
  "Not Contacted":            "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400",
  "Connection Request Sent":  "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
  "Connected":                "bg-sky-50 text-sky-700 dark:bg-sky-950 dark:text-sky-300",
  "Message Sent":             "bg-violet-50 text-violet-700 dark:bg-violet-950 dark:text-violet-300",
  "Replied":                  "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  "Coffee Chat Scheduled":    "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  "Referral Requested":       "bg-[#99462a]/10 text-[#99462a] dark:bg-[#99462a]/20 dark:text-[#d97757]",
};

interface ContactOutreachCardProps {
  contact: Contact;
  isAlumni: boolean;
  onChange: (updated: Contact) => void;
}

export function ContactOutreachCard({ contact, isAlumni, onChange }: ContactOutreachCardProps) {
  const [status, setStatus] = useState<OutreachStatus>(
    (OUTREACH_STATUSES as readonly string[]).includes(contact.outreach_status ?? "")
      ? (contact.outreach_status as OutreachStatus)
      : "Not Contacted"
  );
  const [saving, setSaving] = useState(false);

  const initial   = contact.name.charAt(0).toUpperCase();
  const styleClass = STATUS_STYLE[status] ?? STATUS_STYLE["Not Contacted"];

  async function updateStatus(next: OutreachStatus) {
    if (next === status || saving) return;
    setSaving(true);
    const prev = status;
    setStatus(next); // optimistic
    try {
      const res = await fetch(`/api/networking/contacts/${contact.id}/outreach`, {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ outreach_status: next }),
      });
      if (!res.ok) throw new Error("Failed");
      const { contact: updated } = await res.json();
      onChange(updated);
      toast.success("Outreach status updated.");
    } catch {
      setStatus(prev); // rollback
      toast.error("Failed to update status.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="db-content-card flex flex-col gap-3 min-w-50 max-w-65 shrink-0">
      {/* Avatar + name */}
      <div className="flex items-start gap-3">
        <div className="h-10 w-10 rounded-full bg-[#99462a]/10 dark:bg-[#99462a]/20 flex items-center justify-center shrink-0 text-[#99462a] font-semibold text-sm">
          {initial}
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-sm text-[#3d2b23] dark:text-[#e8d5cc] truncate">{contact.name}</p>
          {contact.title && (
            <p className="text-xs text-[#7a5c52] dark:text-[#b08070] truncate">{contact.title}</p>
          )}
          {contact.company && (
            <div className="flex items-center gap-1 mt-0.5">
              <Building2 className="h-3 w-3 text-[#7a5c52] dark:text-[#b08070] shrink-0" />
              <p className="text-xs text-[#7a5c52] dark:text-[#b08070] truncate">{contact.company}</p>
            </div>
          )}
        </div>
      </div>

      {/* Alumni badge */}
      {isAlumni && (
        <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-violet-50 dark:bg-violet-950 w-fit">
          <GraduationCap className="h-3 w-3 text-violet-600 dark:text-violet-300" />
          <span className="text-[10px] font-semibold text-violet-700 dark:text-violet-300 uppercase tracking-wider">
            Alumni
          </span>
        </div>
      )}

      {/* Quick links */}
      <div className="flex gap-2">
        {contact.linkedin_url && (
          <a href={contact.linkedin_url} target="_blank" rel="noopener noreferrer"
            className="h-7 w-7 rounded flex items-center justify-center text-[#7a5c52] hover:text-[#0A66C2] dark:text-[#b08070] dark:hover:text-[#0A66C2] transition-colors"
            title="LinkedIn">
            <LinkedinIcon className="h-3.5 w-3.5" />
          </a>
        )}
        {contact.email && (
          <a href={`mailto:${contact.email}`}
            className="h-7 w-7 rounded flex items-center justify-center text-[#7a5c52] hover:text-[#99462a] dark:text-[#b08070] dark:hover:text-[#d97757] transition-colors"
            title="Email">
            <Mail className="h-3.5 w-3.5" />
          </a>
        )}
        {contact.phone && (
          <a href={`tel:${contact.phone}`}
            className="h-7 w-7 rounded flex items-center justify-center text-[#7a5c52] hover:text-[#99462a] dark:text-[#b08070] dark:hover:text-[#d97757] transition-colors"
            title="Call">
            <Phone className="h-3.5 w-3.5" />
          </a>
        )}
      </div>

      {/* Outreach status inline dropdown */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            disabled={saving}
            className={`flex items-center justify-between gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold w-full transition-opacity ${styleClass} ${saving ? "opacity-60" : ""}`}
          >
            <span className="truncate">{status}</span>
            <ChevronDown className="h-3 w-3 shrink-0" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-56">
          {OUTREACH_STATUSES.map((s) => (
            <DropdownMenuItem
              key={s}
              onSelect={() => updateStatus(s)}
              className={s === status ? "font-semibold" : ""}
            >
              {s}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
