"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Copy, Trash2, MoreVertical, Check, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui";
import type { EmailTemplate } from "@/types";

// All variables supported in templates
const TEMPLATE_VARIABLES = [
  { key: "company",        label: "Company" },
  { key: "position",       label: "Position" },
  { key: "contact_name",   label: "Contact Name" },
  { key: "your_name",      label: "Your Name" },
  { key: "your_email",     label: "Your Email" },
  { key: "date",           label: "Date" },
  { key: "interview_date", label: "Interview Date" },
  { key: "start_date",     label: "Start Date" },
  { key: "salary",         label: "Salary" },
];

type TemplateVars = Record<string, string>;

/** Replace {{variable}} tokens in text. Unresolved variables get amber highlighting via a marker. */
function substituteVariables(text: string, vars: TemplateVars): string {
  return text.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    return vars[key] || match;
  });
}

function PreviewPanel({ template }: { template: EmailTemplate }) {
  const [vars, setVars] = useState<TemplateVars>({
    date: new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }),
  });

  const subject = substituteVariables(template.subject ?? "", vars);
  const body    = substituteVariables(template.body, vars);

  // Find unresolved variables remaining in the output
  const unresolvedKeys = new Set<string>();
  [template.subject ?? "", template.body].forEach((text) => {
    [...text.matchAll(/\{\{(\w+)\}\}/g)].forEach(([, k]) => {
      if (!vars[k]) unresolvedKeys.add(k);
    });
  });

  return (
    <div className="mt-3 pt-3 border-t border-[#dbc1b9]/30 space-y-3">
      {/* Variable input fields */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {TEMPLATE_VARIABLES.filter((v) => {
          const combined = (template.subject ?? "") + template.body;
          return combined.includes(`{{${v.key}}}`);
        }).map(({ key, label }) => (
          <div key={key} className="space-y-0.5">
            <label className="text-[10px] font-semibold text-[#55433d] uppercase tracking-wide">{label}</label>
            <input
              type="text"
              value={vars[key] ?? ""}
              onChange={(e) => setVars((prev) => ({ ...prev, [key]: e.target.value }))}
              placeholder={`{{${key}}}`}
              className="w-full h-7 px-2 text-xs rounded-lg bg-white border border-[#dbc1b9]/50 focus:outline-none focus:ring-1 focus:ring-[#99462a]/40"
            />
          </div>
        ))}
      </div>

      {unresolvedKeys.size > 0 && (
        <p className="text-[10px] text-amber-600 dark:text-amber-400">
          {unresolvedKeys.size} variable{unresolvedKeys.size > 1 ? "s" : ""} unfilled:{" "}
          {[...unresolvedKeys].map((k) => `{{${k}}}`).join(", ")}
        </p>
      )}

      {/* Rendered preview */}
      <div className="rounded-xl border border-[#dbc1b9]/40 bg-white dark:bg-[#1a1c1b] overflow-hidden">
        <div className="px-4 py-2.5 border-b border-[#dbc1b9]/20 bg-[#f4f3f1] dark:bg-[#0f0f0f]">
          <span className="text-[10px] font-semibold uppercase tracking-widest text-[#55433d]/50 mr-2">Subject</span>
          <span className="text-sm font-medium text-[#1a1c1b] dark:text-white">{subject || "—"}</span>
        </div>
        <div className="px-4 py-3">
          <pre className="text-sm text-[#1a1c1b] dark:text-[#e0ddd8] whitespace-pre-wrap leading-relaxed font-sans">
            {body || "—"}
          </pre>
        </div>
      </div>
    </div>
  );
}

interface TemplateListProps {
  templates: EmailTemplate[];
}

export function TemplateList({ templates }: TemplateListProps) {
  const router = useRouter();
  const [copiedId,    setCopiedId]    = useState<string | null>(null);
  const [deletingId,  setDeletingId]  = useState<string | null>(null);
  const [confirmingId,setConfirmingId]= useState<string | null>(null);
  const [previewId,   setPreviewId]   = useState<string | null>(null);

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
          className="p-4 sm:p-5 rounded-xl bg-[#f4f3f1] dark:bg-[#1a1a1a] transition-colors"
        >
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-[#1a1c1b] dark:text-white">{template.name}</h3>
              <p className="text-sm text-[#55433d]/70 dark:text-[#a09890] mt-1">
                <span className="font-medium text-[#55433d] dark:text-[#c0b0a8]">Subject:</span>{" "}
                {template.subject}
              </p>
              {previewId !== template.id && (
                <p className="text-sm text-[#55433d]/60 mt-2 line-clamp-3 whitespace-pre-wrap leading-relaxed italic">
                  {template.body}
                </p>
              )}
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setPreviewId(previewId === template.id ? null : template.id)}
                className="db-btn-page-secondary text-xs px-3 py-1.5 flex items-center gap-1.5"
                aria-label={previewId === template.id ? "Hide preview" : "Preview with variables"}
              >
                {previewId === template.id
                  ? <><EyeOff className="h-3.5 w-3.5" /> Hide</>
                  : <><Eye className="h-3.5 w-3.5" /> Preview</>
                }
              </button>

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

          {/* Variable substitution preview panel */}
          {previewId === template.id && <PreviewPanel template={template} />}
        </div>
      ))}
    </div>
  );
}
