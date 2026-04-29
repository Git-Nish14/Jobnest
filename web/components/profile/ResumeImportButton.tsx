"use client";

import { useState } from "react";
import { FileUp, Loader2, Check, ChevronDown, ChevronUp, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui";

interface MasterDoc {
  id: string;
  label: string;
  original_name: string | null;
  mime_type: string;
}

interface ExtractedData {
  name: string | null;
  email: string | null;
  skills: Array<{ name: string; category: string; proficiency: string }>;
  education: Array<{ institution: string; degree: string; field_of_study: string | null; start_date: string | null; end_date: string | null; is_current: boolean; gpa: number | null }>;
  certifications: Array<{ name: string; provider: string | null; issued_at: string | null; expires_at: string | null }>;
  experience: Array<{ company: string; title: string }>;
}

interface ImportState {
  importing: boolean;
  data: ExtractedData | null;
  docName: string | null;
  error: string | null;
}

export function ResumeImportButton({ onImported }: { onImported?: () => void }) {
  const [docs, setDocs]         = useState<MasterDoc[] | null>(null);
  const [loadingDocs, setLoadingDocs] = useState(false);
  const [open, setOpen]         = useState(false);
  const [state, setState]       = useState<ImportState>({ importing: false, data: null, docName: null, error: null });
  const [importing, setImporting] = useState<string | null>(null);

  const loadDocs = async () => {
    if (docs !== null) { setOpen(!open); return; }
    setLoadingDocs(true);
    try {
      const res  = await fetch("/api/documents/list?is_master=true&include_versions=false");
      const json = await res.json();
      const items: MasterDoc[] = (json.documents ?? []).filter(
        (d: MasterDoc) => ["application/pdf", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "application/msword", "text/plain", "text/markdown"].includes(d.mime_type)
      );
      setDocs(items);
      setOpen(true);
    } catch {
      toast.error("Failed to load document library");
    } finally {
      setLoadingDocs(false);
    }
  };

  const handleImport = async (doc: MasterDoc) => {
    setImporting(doc.id);
    setState({ importing: true, data: null, docName: doc.label, error: null });
    setOpen(false);
    try {
      const res  = await fetch("/api/documents/parse-resume", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ document_id: doc.id }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Parse failed");
      setState({ importing: false, data: json.extracted, docName: doc.label, error: null });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Import failed";
      setState({ importing: false, data: null, docName: null, error: msg });
      toast.error(msg);
    } finally {
      setImporting(null);
    }
  };

  const confirmImport = async (data: ExtractedData) => {
    let imported = 0;
    try {
      // Import skills
      for (const skill of data.skills) {
        const res = await fetch("/api/profile/skills", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: skill.name, category: skill.category, proficiency: skill.proficiency }),
        });
        if (res.ok) imported++;
      }
      // Import certifications
      for (const cert of data.certifications) {
        if (!cert.name || !cert.issued_at) continue;
        const res = await fetch("/api/profile/certifications", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: cert.name, provider: cert.provider, issued_at: cert.issued_at, expires_at: cert.expires_at }),
        });
        if (res.ok) imported++;
      }
      // Import education
      for (const edu of data.education) {
        if (!edu.institution || !edu.start_date) continue;
        const res = await fetch("/api/profile/education", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ institution: edu.institution, degree: edu.degree ?? "Other", field_of_study: edu.field_of_study, start_date: edu.start_date, end_date: edu.end_date, is_current: edu.is_current, gpa: edu.gpa }),
        });
        if (res.ok) imported++;
      }

      toast.success(`Imported ${imported} items from your resume`);
      setState({ importing: false, data: null, docName: null, error: null });
      onImported?.();
      // Reload page to reflect changes
      window.location.reload();
    } catch {
      toast.error("Some items failed to import");
    }
  };

  return (
    <div className="space-y-3">
      <div className="relative">
        <Button
          variant="outline"
          size="sm"
          onClick={loadDocs}
          disabled={loadingDocs || state.importing}
          className="gap-2"
        >
          {loadingDocs || state.importing
            ? <Loader2 className="h-4 w-4 animate-spin" />
            : <FileUp className="h-4 w-4" />
          }
          {state.importing ? "Parsing resume…" : "Import from Resume"}
          {!loadingDocs && !state.importing && (open
            ? <ChevronUp className="h-3.5 w-3.5 opacity-50" />
            : <ChevronDown className="h-3.5 w-3.5 opacity-50" />
          )}
        </Button>

        {open && docs && docs.length > 0 && (
          <div className="absolute top-full left-0 mt-1 w-72 bg-background border border-border rounded-xl shadow-lg z-50 overflow-hidden">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest px-3 py-2 border-b border-border">
              Select a resume to parse
            </p>
            {docs.map((doc) => (
              <button
                key={doc.id}
                type="button"
                onClick={() => handleImport(doc)}
                disabled={importing === doc.id}
                className="w-full text-left px-3 py-2.5 hover:bg-muted/60 transition-colors flex items-center gap-2.5 border-b border-border last:border-0"
              >
                {importing === doc.id
                  ? <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground shrink-0" />
                  : <FileUp className="h-3.5 w-3.5 text-[#99462a] shrink-0" />
                }
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{doc.label}</p>
                  <p className="text-[10px] text-muted-foreground truncate">{doc.original_name}</p>
                </div>
              </button>
            ))}
          </div>
        )}

        {open && docs && docs.length === 0 && (
          <div className="absolute top-full left-0 mt-1 w-72 bg-background border border-border rounded-xl shadow-lg z-50 p-4 text-center">
            <p className="text-sm text-muted-foreground">
              No master documents found.{" "}
              <a href="/documents" className="text-[#99462a] hover:underline font-medium">Upload a resume →</a>
            </p>
          </div>
        )}
      </div>

      {/* Preview / confirm dialog */}
      {state.data && state.docName && (
        <div className="rounded-xl border border-[#dbc1b9]/50 bg-[#f4f3f1] dark:bg-[#1a1a1a] p-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-foreground">Review extracted data</p>
            <p className="text-xs text-muted-foreground">from &ldquo;{state.docName}&rdquo;</p>
          </div>

          {state.data.name && (
            <p className="text-xs text-muted-foreground">Name: <span className="font-medium text-foreground">{state.data.name}</span></p>
          )}

          {[
            { label: "Skills",         items: state.data.skills },
            { label: "Certifications", items: state.data.certifications },
            { label: "Education",      items: state.data.education },
          ].map(({ label, items }) => items.length > 0 && (
            <div key={label}>
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1">{label} ({items.length})</p>
              <ul className="space-y-0.5">
                {items.slice(0, 5).map((item, i) => {
                  const rec = item as Record<string, string>;
                  const text = rec.name
                    ? (rec.proficiency ? `${rec.name} (${rec.proficiency})` : rec.name)
                    : (rec.institution ? `${rec.institution} — ${rec.degree}` : String(item));
                  return (
                    <li key={i} className="flex items-center gap-1.5 text-xs text-foreground">
                      <Check className="h-3 w-3 text-emerald-600 shrink-0" />
                      {text}
                    </li>
                  );
                })}
                {items.length > 5 && <li className="text-[10px] text-muted-foreground pl-4.5">+{items.length - 5} more</li>}
              </ul>
            </div>
          ))}

          <div className="flex gap-2 pt-1">
            <Button size="sm" onClick={() => confirmImport(state.data!)}>
              Import all
            </Button>
            <Button size="sm" variant="outline" onClick={() => setState({ importing: false, data: null, docName: null, error: null })}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      {state.error && (
        <div className="flex items-center gap-2 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {state.error}
        </div>
      )}
    </div>
  );
}
