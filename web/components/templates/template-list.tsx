"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Copy, Trash2, MoreVertical, Check } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui";
import type { EmailTemplate } from "@/types";

interface TemplateListProps {
  templates: EmailTemplate[];
}

export function TemplateList({ templates }: TemplateListProps) {
  const router = useRouter();
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  const handleCopy = async (template: EmailTemplate) => {
    const text = `Subject: ${template.subject}\n\n${template.body}`;
    await navigator.clipboard.writeText(text);
    setCopiedId(template.id);
    toast.success("Template copied to clipboard");
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleDeleteClick = (id: string) => {
    setConfirmingId(id);
    setTimeout(() => setConfirmingId((cur) => (cur === id ? null : cur)), 4000);
  };

  const handleDeleteConfirm = async (id: string) => {
    setConfirmingId(null);
    setDeletingId(id);
    const supabase = createClient();
    const { error } = await supabase.from("email_templates").delete().eq("id", id);
    if (error) toast.error("Failed to delete template");
    else { toast.success("Template deleted"); router.refresh(); }
    setDeletingId(null);
  };

  return (
    <div className="space-y-3">
      {templates.map((template) => (
        <div
          key={template.id}
          className="p-4 sm:p-5 rounded-xl bg-[#f4f3f1] hover:bg-[#e9e8e6] transition-colors"
        >
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-[#1a1c1b]">{template.name}</h3>
              <p className="text-sm text-[#55433d]/70 mt-1">
                <span className="font-medium text-[#55433d]">Subject:</span>{" "}
                {template.subject}
              </p>
              <p className="text-sm text-[#55433d]/60 mt-2 line-clamp-3 whitespace-pre-wrap leading-relaxed italic">
                {template.body}
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => handleCopy(template)}
                className="db-btn-page-secondary text-xs px-3 py-1.5 flex items-center gap-1.5"
              >
                {copiedId === template.id ? (
                  <><Check className="h-3.5 w-3.5" /> Copied</>
                ) : (
                  <><Copy className="h-3.5 w-3.5" /> Copy</>
                )}
              </button>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    aria-label="Template options"
                    className="h-8 w-8 flex items-center justify-center rounded-lg text-[#55433d]/50 hover:text-[#99462a] hover:bg-[#99462a]/8 transition-colors"
                  >
                    <MoreVertical className="h-4 w-4" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {confirmingId === template.id ? (
                    <DropdownMenuItem
                      onClick={() => handleDeleteConfirm(template.id)}
                      className="text-[#ba1a1a] font-semibold"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Confirm delete
                    </DropdownMenuItem>
                  ) : (
                    <DropdownMenuItem
                      onClick={() => handleDeleteClick(template.id)}
                      disabled={deletingId === template.id}
                      className="text-[#ba1a1a]"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      {deletingId === template.id ? "Deleting..." : "Delete"}
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
