"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Mail, Phone, Star, Trash2, MoreVertical, Building } from "lucide-react";
import { LinkedinIcon } from "@/components/ui/brand-icons";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui";
import type { Contact } from "@/types";

interface ContactListProps {
  contacts: (Contact & { job_applications?: { company: string; position: string } | null })[];
}

export function ContactList({ contacts }: ContactListProps) {
  const router = useRouter();
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  const handleDeleteClick = (id: string) => {
    setConfirmingId(id);
    setTimeout(() => setConfirmingId((cur) => (cur === id ? null : cur)), 4000);
  };

  const handleDeleteConfirm = async (id: string) => {
    setConfirmingId(null);
    setDeletingId(id);
    const supabase = createClient();

    const { error } = await supabase.from("contacts").delete().eq("id", id);

    if (error) {
      toast.error("Failed to delete contact");
    } else {
      toast.success("Contact deleted");
      router.refresh();
    }

    setDeletingId(null);
  };

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {contacts.map((contact) => (
        <div
          key={contact.id}
          className="p-4 rounded-xl border border-[#dbc1b9]/15 bg-[#f4f3f1] hover:bg-[#e9e8e6] transition-colors"
        >
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-[#1a1c1b] truncate">{contact.name}</h3>
                {contact.is_primary && (
                  <Star className="h-3.5 w-3.5 text-[#99462a] fill-[#99462a] flex-shrink-0" />
                )}
              </div>
              {contact.title && (
                <p className="text-sm text-[#55433d]/70 truncate mt-0.5">{contact.title}</p>
              )}
            </div>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  aria-label="Contact options"
                  className="h-8 w-8 flex items-center justify-center rounded-lg text-[#55433d]/50 hover:text-[#99462a] hover:bg-[#99462a]/8 transition-colors shrink-0"
                >
                  <MoreVertical className="h-4 w-4" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {confirmingId === contact.id ? (
                  <DropdownMenuItem
                    onClick={() => handleDeleteConfirm(contact.id)}
                    className="text-[#ba1a1a] font-semibold"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Confirm delete
                  </DropdownMenuItem>
                ) : (
                  <DropdownMenuItem
                    onClick={() => handleDeleteClick(contact.id)}
                    disabled={deletingId === contact.id}
                    className="text-[#ba1a1a]"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    {deletingId === contact.id ? "Deleting..." : "Delete"}
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <div className="mt-3 space-y-2">
            {contact.email && (
              <a
                href={`mailto:${contact.email}`}
                className="flex items-center gap-2 text-sm text-[#55433d]/70 hover:text-[#99462a] transition-colors"
              >
                <Mail className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{contact.email}</span>
              </a>
            )}

            {contact.phone && (
              <a
                href={`tel:${contact.phone}`}
                className="flex items-center gap-2 text-sm text-[#55433d]/70 hover:text-[#99462a] transition-colors"
              >
                <Phone className="h-3.5 w-3.5 shrink-0" />
                <span>{contact.phone}</span>
              </a>
            )}

            {contact.linkedin_url && (
              <a
                href={contact.linkedin_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-sm text-[#55433d]/70 hover:text-[#99462a] transition-colors"
              >
                <LinkedinIcon className="h-3.5 w-3.5 shrink-0" />
                <span>LinkedIn Profile</span>
              </a>
            )}

            {contact.application_id && contact.job_applications && (
              <Link
                href={`/applications/${contact.application_id}`}
                className="flex items-center gap-2 text-sm text-[#99462a] hover:underline underline-offset-2"
              >
                <Building className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{contact.job_applications.company}</span>
              </Link>
            )}
          </div>

          {contact.notes && (
            <p className="mt-3 text-sm text-[#55433d]/60 italic line-clamp-2 leading-relaxed">
              {contact.notes}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}
