import { Mail, FileText } from "lucide-react";
import { getEmailTemplates } from "@/services";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui";
import { TemplateForm, TemplateList, TemplateGallery } from "@/components/templates";

export const dynamic = "force-dynamic";

export default async function TemplatesPage() {
  const { data: templates } = await getEmailTemplates();

  const allTemplates = templates || [];

  // Group templates by category
  const groupedTemplates = allTemplates.reduce((acc, template) => {
    const category = template.category || "General";
    if (!acc[category]) acc[category] = [];
    acc[category].push(template);
    return acc;
  }, {} as Record<string, typeof allTemplates>);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Email Templates</h1>
          <p className="text-muted-foreground">
            Save and reuse email templates for your job search
          </p>
        </div>
        <div className="flex gap-2">
          <TemplateGallery />
          <TemplateForm />
        </div>
      </div>

      {/* Template Variables Info */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Available Variables</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2 text-sm">
            <code className="px-2 py-1 bg-muted rounded">{"{{company}}"}</code>
            <code className="px-2 py-1 bg-muted rounded">{"{{position}}"}</code>
            <code className="px-2 py-1 bg-muted rounded">{"{{contact_name}}"}</code>
            <code className="px-2 py-1 bg-muted rounded">{"{{date}}"}</code>
            <code className="px-2 py-1 bg-muted rounded">{"{{your_name}}"}</code>
            <code className="px-2 py-1 bg-muted rounded">{"{{your_email}}"}</code>
            <code className="px-2 py-1 bg-muted rounded">{"{{your_phone}}"}</code>
            <code className="px-2 py-1 bg-muted rounded">{"{{your_linkedin}}"}</code>
            <code className="px-2 py-1 bg-muted rounded">{"{{interview_date}}"}</code>
            <code className="px-2 py-1 bg-muted rounded">{"{{start_date}}"}</code>
            <code className="px-2 py-1 bg-muted rounded">{"{{salary}}"}</code>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Replace these placeholders with actual values before sending your email
          </p>
        </CardContent>
      </Card>

      {/* Templates by Category */}
      {Object.entries(groupedTemplates).length === 0 ? (
        <Card>
          <CardContent className="py-8">
            <div className="text-center text-muted-foreground">
              <Mail className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="font-medium">No templates yet</p>
              <p className="text-sm mt-1 mb-4">
                Create your own templates or browse our pre-built collection
              </p>
              <div className="flex justify-center gap-2">
                <TemplateGallery />
                <TemplateForm />
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        Object.entries(groupedTemplates).map(([category, categoryTemplates]) => (
          <Card key={category}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-primary" />
                {category}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <TemplateList templates={categoryTemplates} />
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}
