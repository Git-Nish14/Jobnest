"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Copy, Plus, Mail, UserPlus, MessageSquare,
  Gift, Briefcase, ChevronDown, Check, Loader2,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { EMAIL_TEMPLATES, type EmailTemplateData } from "@/lib/data/email-templates";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui";

const categoryIcons = {
  "Follow Up": MessageSquare,
  "Thank You": Gift,
  Offer: Briefcase,
  General: Mail,
  Networking: UserPlus,
};

// Atelier-toned category tokens
const categoryTokens: Record<string, string> = {
  "Follow Up":  "bg-[#99462a]/10 text-[#99462a]",
  "Thank You":  "bg-[#006d34]/10 text-[#006d34]",
  "Offer":      "bg-[#55433d]/10 text-[#55433d]",
  "General":    "bg-[#dbc1b9]/40 text-[#55433d]",
  "Networking": "bg-amber-500/10 text-amber-700",
};

interface TemplateGalleryProps {
  onTemplateAdded?: () => void;
}

export function TemplateGallery({ onTemplateAdded }: TemplateGalleryProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [expandedTemplate, setExpandedTemplate] = useState<string | null>(null);
  const [savingTemplate, setSavingTemplate] = useState<string | null>(null);
  const [copiedTemplate, setCopiedTemplate] = useState<string | null>(null);

  const categories = ["all", "Follow Up", "Thank You", "Offer", "Networking", "General"];

  const filteredTemplates =
    selectedCategory === "all"
      ? EMAIL_TEMPLATES
      : EMAIL_TEMPLATES.filter((t) => t.category === selectedCategory);

  const handleSaveTemplate = async (template: EmailTemplateData) => {
    setSavingTemplate(template.name);
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { toast.error("Please sign in to save templates"); return; }

      const { error } = await supabase.from("email_templates").insert({
        user_id: user.id,
        name: template.name,
        subject: template.subject,
        body: template.body,
        category: template.category,
      });

      if (error) {
        if (error.code === "23505") toast.error("You already have a template with this name");
        else throw error;
        return;
      }

      toast.success("Template saved to your collection!");
      router.refresh();
      onTemplateAdded?.();
    } catch {
      toast.error("Failed to save template");
    } finally {
      setSavingTemplate(null);
    }
  };

  const handleCopyToClipboard = async (template: EmailTemplateData) => {
    try {
      await navigator.clipboard.writeText(`Subject: ${template.subject}\n\n${template.body}`);
      setCopiedTemplate(template.name);
      toast.success("Template copied to clipboard!");
      setTimeout(() => setCopiedTemplate(null), 2000);
    } catch {
      toast.error("Failed to copy template");
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button type="button" className="db-btn-page-secondary">
          <Mail className="h-4 w-4" />
          Browse Templates
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="db-headline flex items-center gap-2 text-[#1a1c1b]">
            <Mail className="h-5 w-5 text-[#99462a]" />
            Email Template Gallery
          </DialogTitle>
        </DialogHeader>

        {/* Category filter pills */}
        <div className="flex flex-wrap gap-2 pb-4 border-b border-[#dbc1b9]/20">
          {categories.map((category) => (
            <button
              key={category}
              type="button"
              onClick={() => setSelectedCategory(category)}
              className={`db-filter-pill text-xs ${
                selectedCategory === category ? "db-filter-pill-active" : "db-filter-pill-inactive"
              }`}
            >
              {category === "all" ? "All Templates" : category}
            </button>
          ))}
        </div>

        {/* Templates list */}
        <div className="flex-1 overflow-y-auto space-y-2 pr-1">
          {filteredTemplates.map((template) => {
            const Icon = categoryIcons[template.category as keyof typeof categoryIcons] ?? Mail;
            const isExpanded = expandedTemplate === template.name;
            const isSaving = savingTemplate === template.name;
            const isCopied = copiedTemplate === template.name;
            const token = categoryTokens[template.category] ?? categoryTokens["General"];

            return (
              <div key={template.name} className="rounded-xl border border-[#dbc1b9]/12 bg-[#f4f3f1] overflow-hidden">
                {/* Header row */}
                <button
                  type="button"
                  className="w-full flex items-center justify-between gap-4 px-4 py-3.5 text-left hover:bg-[#e9e8e6] transition-colors"
                  onClick={() => setExpandedTemplate(isExpanded ? null : template.name)}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`p-2 rounded-lg shrink-0 ${token}`}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-[#1a1c1b] text-sm">{template.name}</p>
                      <p className="text-xs text-[#55433d]/60 mt-0.5 truncate">{template.subject}</p>
                    </div>
                  </div>
                  <ChevronDown
                    className={`h-4 w-4 text-[#55433d]/50 transition-transform shrink-0 ${isExpanded ? "rotate-180" : ""}`}
                  />
                </button>

                {/* Expanded body */}
                {isExpanded && (
                  <div className="px-4 pb-4 border-t border-[#dbc1b9]/15 bg-white dark:bg-[#0f0f0f]">
                    <div className="mt-4 mb-3">
                      <p className="text-xs font-bold uppercase tracking-widest text-[#55433d]/50 mb-1.5">Subject</p>
                      <p className="text-sm text-[#1a1c1b] font-mono bg-[#f4f3f1] px-3 py-2 rounded-lg">
                        {template.subject}
                      </p>
                    </div>
                    <div className="mb-4">
                      <p className="text-xs font-bold uppercase tracking-widest text-[#55433d]/50 mb-1.5">Body</p>
                      <pre className="text-sm whitespace-pre-wrap font-sans text-[#55433d] bg-[#f4f3f1] px-3 py-3 rounded-lg max-h-52 overflow-y-auto leading-relaxed">
                        {template.body}
                      </pre>
                    </div>

                    <div className="flex items-center gap-2 text-xs text-[#55433d]/60 mb-4 flex-wrap">
                      <span className="font-semibold">Placeholders:</span>
                      {["{{company}}", "{{position}}", "{{contact_name}}"].map((p) => (
                        <code key={p} className="bg-[#f4f3f1] text-[#99462a] px-1.5 py-0.5 rounded font-mono">{p}</code>
                      ))}
                      <span>etc.</span>
                    </div>

                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => handleSaveTemplate(template)}
                        disabled={isSaving}
                        className="db-btn-page-primary text-xs px-4 py-2"
                      >
                        {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                        Save to My Templates
                      </button>
                      <button
                        type="button"
                        onClick={() => handleCopyToClipboard(template)}
                        className="db-btn-page-secondary text-xs px-4 py-2"
                      >
                        {isCopied ? <Check className="h-3.5 w-3.5 text-[#006d34]" /> : <Copy className="h-3.5 w-3.5" />}
                        {isCopied ? "Copied!" : "Copy"}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="pt-3 border-t border-[#dbc1b9]/20 text-xs text-[#55433d]/60">
          Replace placeholders like{" "}
          <code className="bg-[#f4f3f1] text-[#99462a] px-1.5 py-0.5 rounded font-mono">{"{{company}}"}</code>
          {" "}with actual values before sending.
        </div>
      </DialogContent>
    </Dialog>
  );
}
