"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Mail, Phone, Linkedin, Star, Trash2, MoreVertical, Building } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import {
  Button,
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

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this contact?")) return;

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
          className="p-4 rounded-lg border hover:bg-muted/50 transition-colors"
        >
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="font-medium truncate">{contact.name}</h3>
                {contact.is_primary && (
                  <Star className="h-4 w-4 text-yellow-500 fill-yellow-500 flex-shrink-0" />
                )}
              </div>
              {contact.title && (
                <p className="text-sm text-muted-foreground truncate">{contact.title}</p>
              )}
            </div>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8 flex-shrink-0">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onClick={() => handleDelete(contact.id)}
                  disabled={deletingId === contact.id}
                  className="text-destructive"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <div className="mt-3 space-y-2">
            {contact.email && (
              <a
                href={`mailto:${contact.email}`}
                className="flex items-center gap-2 text-sm text-muted-foreground hover:text-primary"
              >
                <Mail className="h-4 w-4" />
                <span className="truncate">{contact.email}</span>
              </a>
            )}

            {contact.phone && (
              <a
                href={`tel:${contact.phone}`}
                className="flex items-center gap-2 text-sm text-muted-foreground hover:text-primary"
              >
                <Phone className="h-4 w-4" />
                <span>{contact.phone}</span>
              </a>
            )}

            {contact.linkedin_url && (
              <a
                href={contact.linkedin_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-sm text-muted-foreground hover:text-primary"
              >
                <Linkedin className="h-4 w-4" />
                <span>LinkedIn Profile</span>
              </a>
            )}

            {contact.application_id && contact.job_applications && (
              <Link
                href={`/applications/${contact.application_id}`}
                className="flex items-center gap-2 text-sm text-primary hover:underline"
              >
                <Building className="h-4 w-4" />
                <span className="truncate">
                  {contact.job_applications.company}
                </span>
              </Link>
            )}
          </div>

          {contact.notes && (
            <p className="mt-3 text-sm text-muted-foreground line-clamp-2">
              {contact.notes}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}
