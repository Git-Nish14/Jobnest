"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Copy,
  Plus,
  Mail,
  UserPlus,
  MessageSquare,
  Gift,
  Briefcase,
  ChevronDown,
  Check,
  Loader2,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  EMAIL_TEMPLATES,
  type EmailTemplateData,
} from "@/lib/data/email-templates";
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui";

const categoryIcons = {
  "Follow Up": MessageSquare,
  "Thank You": Gift,
  Offer: Briefcase,
  General: Mail,
  Networking: UserPlus,
};

const categoryColors = {
  "Follow Up": "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  "Thank You": "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  Offer: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
  General: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400",
  Networking: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
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
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        toast.error("Please sign in to save templates");
        return;
      }

      const { error } = await supabase.from("email_templates").insert({
        user_id: user.id,
        name: template.name,
        subject: template.subject,
        body: template.body,
        category: template.category,
      });

      if (error) {
        if (error.code === "23505") {
          toast.error("You already have a template with this name");
        } else {
          throw error;
        }
        return;
      }

      toast.success("Template saved to your collection!");
      router.refresh();
      onTemplateAdded?.();
    } catch (err) {
      toast.error("Failed to save template");
    } finally {
      setSavingTemplate(null);
    }
  };

  const handleCopyToClipboard = async (template: EmailTemplateData) => {
    const content = `Subject: ${template.subject}\n\n${template.body}`;

    try {
      await navigator.clipboard.writeText(content);
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
        <Button variant="outline" className="gap-2">
          <Mail className="h-4 w-4" />
          Browse Templates
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Email Template Gallery
          </DialogTitle>
        </DialogHeader>

        {/* Category Filter */}
        <div className="flex flex-wrap gap-2 pb-4 border-b">
          {categories.map((category) => (
            <Button
              key={category}
              variant={selectedCategory === category ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedCategory(category)}
              className="capitalize"
            >
              {category === "all" ? "All Templates" : category}
            </Button>
          ))}
        </div>

        {/* Templates List */}
        <div className="flex-1 overflow-y-auto space-y-3 pr-2">
          {filteredTemplates.map((template) => {
            const Icon = categoryIcons[template.category];
            const isExpanded = expandedTemplate === template.name;
            const isSaving = savingTemplate === template.name;
            const isCopied = copiedTemplate === template.name;

            return (
              <Card key={template.name} className="overflow-hidden">
                <CardHeader
                  className="cursor-pointer py-3"
                  onClick={() =>
                    setExpandedTemplate(isExpanded ? null : template.name)
                  }
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3">
                      <div
                        className={`p-2 rounded-lg ${categoryColors[template.category]}`}
                      >
                        <Icon className="h-4 w-4" />
                      </div>
                      <div>
                        <CardTitle className="text-base">{template.name}</CardTitle>
                        <CardDescription className="text-sm mt-1 line-clamp-1">
                          {template.subject}
                        </CardDescription>
                      </div>
                    </div>
                    <ChevronDown
                      className={`h-5 w-5 text-muted-foreground transition-transform ${
                        isExpanded ? "rotate-180" : ""
                      }`}
                    />
                  </div>
                </CardHeader>

                {isExpanded && (
                  <CardContent className="pt-0 pb-4">
                    <div className="bg-muted/50 rounded-lg p-4 mb-4">
                      <p className="text-sm font-medium text-muted-foreground mb-2">
                        Subject:
                      </p>
                      <p className="text-sm mb-4 font-mono bg-background p-2 rounded">
                        {template.subject}
                      </p>
                      <p className="text-sm font-medium text-muted-foreground mb-2">
                        Body:
                      </p>
                      <pre className="text-sm whitespace-pre-wrap font-sans bg-background p-3 rounded max-h-64 overflow-y-auto">
                        {template.body}
                      </pre>
                    </div>

                    <div className="flex items-center gap-2 text-xs text-muted-foreground mb-3">
                      <span className="font-medium">Placeholders:</span>
                      <code className="bg-muted px-1.5 py-0.5 rounded">
                        {"{{company}}"}
                      </code>
                      <code className="bg-muted px-1.5 py-0.5 rounded">
                        {"{{position}}"}
                      </code>
                      <code className="bg-muted px-1.5 py-0.5 rounded">
                        {"{{contact_name}}"}
                      </code>
                      <span>etc.</span>
                    </div>

                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={() => handleSaveTemplate(template)}
                        disabled={isSaving}
                        className="gap-2"
                      >
                        {isSaving ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Plus className="h-4 w-4" />
                        )}
                        Save to My Templates
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleCopyToClipboard(template)}
                        className="gap-2"
                      >
                        {isCopied ? (
                          <Check className="h-4 w-4 text-green-600" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                        {isCopied ? "Copied!" : "Copy"}
                      </Button>
                    </div>
                  </CardContent>
                )}
              </Card>
            );
          })}
        </div>

        <div className="pt-4 border-t text-sm text-muted-foreground">
          <p>
            <strong>Tip:</strong> Replace placeholders like{" "}
            <code className="bg-muted px-1 py-0.5 rounded">{"{{company}}"}</code> with
            actual values before sending.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
