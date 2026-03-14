"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Copy, Trash2, MoreVertical, Check } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import {
  Button,
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

  const handleCopy = async (template: EmailTemplate) => {
    const text = `Subject: ${template.subject}\n\n${template.body}`;
    await navigator.clipboard.writeText(text);
    setCopiedId(template.id);
    toast.success("Template copied to clipboard");
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this template?")) return;

    setDeletingId(id);
    const supabase = createClient();

    const { error } = await supabase.from("email_templates").delete().eq("id", id);

    if (error) {
      toast.error("Failed to delete template");
    } else {
      toast.success("Template deleted");
      router.refresh();
    }

    setDeletingId(null);
  };

  return (
    <div className="space-y-4">
      {templates.map((template) => (
        <div
          key={template.id}
          className="p-4 rounded-lg border hover:bg-muted/50 transition-colors"
        >
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <h3 className="font-medium">{template.name}</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Subject: {template.subject}
              </p>
              <p className="text-sm text-muted-foreground mt-2 line-clamp-3 whitespace-pre-wrap">
                {template.body}
              </p>
            </div>

            <div className="flex items-center gap-2 flex-shrink-0">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleCopy(template)}
                className="gap-2"
              >
                {copiedId === template.id ? (
                  <>
                    <Check className="h-4 w-4" />
                    Copied
                  </>
                ) : (
                  <>
                    <Copy className="h-4 w-4" />
                    Copy
                  </>
                )}
              </Button>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    onClick={() => handleDelete(template.id)}
                    disabled={deletingId === template.id}
                    className="text-destructive"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
