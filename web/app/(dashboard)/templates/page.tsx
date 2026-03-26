import { Mail, FileText } from "lucide-react";
import { getEmailTemplates } from "@/services";
import { TemplateForm, TemplateList, TemplateGallery } from "@/components/templates";

export const dynamic = "force-dynamic";

export default async function TemplatesPage() {
  const { data: templates } = await getEmailTemplates();
  const allTemplates = templates || [];

  const groupedTemplates = allTemplates.reduce((acc, template) => {
    const category = template.category || "General";
    if (!acc[category]) acc[category] = [];
    acc[category].push(template);
    return acc;
  }, {} as Record<string, typeof allTemplates>);

  return (
    <div>
      {/* ── Header ── */}
      <header className="db-page-header">
        <div>
          <h1 className="db-page-title">Email Templates</h1>
          <p className="db-page-subtitle">
            Save and reuse email templates for your job search communications.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <TemplateGallery />
          <TemplateForm />
        </div>
      </header>

      <div className="space-y-8">
        {/* ── Variable reference ── */}
        <section className="db-content-card">
          <p className="text-xs font-bold uppercase tracking-widest text-[#55433d]/60 mb-3">Available Variables</p>
          <div className="flex flex-wrap gap-2">
            {["{{company}}", "{{position}}", "{{contact_name}}", "{{date}}", "{{your_name}}",
              "{{your_email}}", "{{your_phone}}", "{{your_linkedin}}", "{{interview_date}}",
              "{{start_date}}", "{{salary}}"].map((v) => (
              <code key={v} className="px-2.5 py-1 bg-[#f4f3f1] text-[#99462a] text-xs rounded-lg font-mono">
                {v}
              </code>
            ))}
          </div>
          <p className="text-xs text-[#55433d]/50 mt-3">
            Replace these placeholders with actual values before sending your email.
          </p>
        </section>

        {/* ── Templates by category ── */}
        {Object.entries(groupedTemplates).length === 0 ? (
          <div className="db-content-card flex flex-col items-center py-16 text-center">
            <Mail className="h-10 w-10 text-[#55433d]/30 mb-3" />
            <p className="text-[#55433d] font-medium">No templates yet</p>
            <p className="text-sm text-[#55433d]/60 mt-1 mb-6">
              Create your own templates or browse our pre-built collection
            </p>
            <div className="flex gap-3">
              <TemplateGallery />
              <TemplateForm />
            </div>
          </div>
        ) : (
          Object.entries(groupedTemplates).map(([category, categoryTemplates]) => (
            <section key={category}>
              <div className="flex items-center gap-3 mb-4">
                <FileText className="h-5 w-5 text-[#99462a]" />
                <h2 className="db-headline text-xl font-semibold text-[#1a1c1b]">{category}</h2>
                <span className="text-sm text-[#55433d]">({categoryTemplates.length})</span>
              </div>
              <div className="db-content-card">
                <TemplateList templates={categoryTemplates} />
              </div>
            </section>
          ))
        )}
      </div>
    </div>
  );
}
