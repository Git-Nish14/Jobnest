"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Papa from "papaparse";
import { toast } from "sonner";
import { Upload, X, Check, AlertCircle, FileText, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { APPLICATION_STATUSES } from "@/config/constants";

// Canonical columns we accept from CSV
const EXPECTED_COLS = ["company", "position", "status", "applied_date", "location", "salary_range", "notes", "job_url", "source"] as const;
type ColName = (typeof EXPECTED_COLS)[number];

// Human-readable label for each column
const COL_LABELS: Record<ColName, string> = {
  company: "Company *",
  position: "Position *",
  status: "Status",
  applied_date: "Applied Date (YYYY-MM-DD)",
  location: "Location",
  salary_range: "Salary Range",
  notes: "Notes",
  job_url: "Job URL",
  source: "Source",
};

type Row = Record<string, string>;

type Step = "upload" | "map" | "preview" | "done";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CSVImportWizard({ open, onOpenChange }: Props) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<Step>("upload");
  const [rawHeaders, setRawHeaders] = useState<string[]>([]);
  const [rawRows, setRawRows] = useState<Row[]>([]);
  // mapping: canonical column → CSV header (or "" to skip)
  const [mapping, setMapping] = useState<Record<ColName, string>>({} as Record<ColName, string>);
  const [previewRows, setPreviewRows] = useState<Row[]>([]);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ imported: number; errors: { row: number; message: string }[] } | null>(null);

  function reset() {
    setStep("upload");
    setRawHeaders([]);
    setRawRows([]);
    setMapping({} as Record<ColName, string>);
    setPreviewRows([]);
    setImportResult(null);
    setImporting(false);
  }

  function handleClose() {
    reset();
    onOpenChange(false);
  }

  function handleFile(file: File) {
    if (!file.name.endsWith(".csv")) {
      toast.error("Please upload a .csv file.");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error("File exceeds the 2 MB limit. Split into smaller files and import them separately.");
      return;
    }
    Papa.parse<Row>(file, {
      header: true,
      skipEmptyLines: true,
      complete: ({ data, meta }) => {
        const headers = meta.fields ?? [];
        setRawHeaders(headers);
        setRawRows(data.slice(0, 500));

        // Auto-map: if CSV header matches canonical name (case-insensitive) use it
        const autoMap: Record<string, string> = {};
        for (const col of EXPECTED_COLS) {
          const match = headers.find((h) => h.toLowerCase().replace(/[\s_-]/g, "") === col.replace(/_/g, ""));
          autoMap[col] = match ?? "";
        }
        setMapping(autoMap as Record<ColName, string>);
        setStep("map");
      },
      error: () => toast.error("Could not parse CSV. Please check the file format."),
    });
  }

  function buildMappedRows(): Row[] {
    return rawRows.map((row) => {
      const mapped: Row = {};
      for (const col of EXPECTED_COLS) {
        const csvKey = mapping[col];
        mapped[col] = csvKey ? (row[csvKey] ?? "") : "";
      }
      return mapped;
    });
  }

  function handlePreview() {
    if (!mapping.company || !mapping.position) {
      toast.error("You must map at least Company and Position.");
      return;
    }
    setPreviewRows(buildMappedRows().slice(0, 5));
    setStep("preview");
  }

  async function handleImport() {
    setImporting(true);
    const rows = buildMappedRows().map((r) => ({
      ...r,
      status: APPLICATION_STATUSES.includes(r.status as (typeof APPLICATION_STATUSES)[number])
        ? r.status
        : "Applied",
    }));

    try {
      const res = await fetch("/api/applications/bulk-import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Import failed.");
        return;
      }
      setImportResult(data);
      setStep("done");
      router.refresh();
    } catch {
      toast.error("Network error — please try again.");
    } finally {
      setImporting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); }}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle>Import Applications from CSV</DialogTitle>
          <DialogDescription>
            {step === "upload" && "Upload a CSV file with your job application data."}
            {step === "map" && "Map your CSV columns to Jobnest fields."}
            {step === "preview" && "Preview the first 5 rows before importing."}
            {step === "done" && "Import complete."}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto min-h-0 py-2">
          {/* ── Step 1: Upload ── */}
          {step === "upload" && (
            <div
              className="border-2 border-dashed border-border rounded-xl p-12 flex flex-col items-center gap-4 cursor-pointer hover:border-primary/50 hover:bg-primary/2 transition-colors"
              onClick={() => fileRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
            >
              <Upload className="h-10 w-10 text-muted-foreground/50" />
              <div className="text-center">
                <p className="font-semibold text-sm">Drop a CSV here or click to browse</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Supports up to 500 rows · Required columns: company, position
                </p>
              </div>
              <input ref={fileRef} type="file" accept=".csv" className="hidden" aria-label="Upload CSV file" title="Upload CSV file" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
            </div>
          )}

          {/* ── Step 2: Column mapping ── */}
          {step === "map" && (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground mb-3">
                {rawRows.length} rows detected · {rawHeaders.length} CSV columns · Map each Jobnest field to a CSV column (or leave blank to skip)
              </p>
              <div className="grid grid-cols-[1fr_1fr] gap-2">
                {EXPECTED_COLS.map((col) => (
                  <label key={col} className="flex items-center gap-2 p-2 rounded-lg border bg-card w-full">
                    <span className="text-xs font-medium text-foreground min-w-35">{COL_LABELS[col]}</span>
                    <select
                      aria-label={`Map ${COL_LABELS[col]} to CSV column`}
                      title={`Map ${COL_LABELS[col]} to CSV column`}
                      className="flex-1 text-xs rounded-md border border-border bg-background px-2 py-1 focus:outline-none focus:ring-1 focus:ring-primary"
                      value={mapping[col] ?? ""}
                      onChange={(e) => setMapping((prev) => ({ ...prev, [col]: e.target.value }))}
                    >
                      <option value="">— skip —</option>
                      {rawHeaders.map((h) => (
                        <option key={h} value={h}>{h}</option>
                      ))}
                    </select>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* ── Step 3: Preview ── */}
          {step === "preview" && (
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground">
                Showing first 5 of {rawRows.length} rows. Rows without Company or Position will be skipped.
              </p>
              <div className="overflow-x-auto rounded-lg border">
                <table className="text-xs w-full">
                  <thead className="bg-muted/50">
                    <tr>
                      {EXPECTED_COLS.filter((c) => mapping[c]).map((col) => (
                        <th key={col} className="px-3 py-2 text-left font-semibold text-muted-foreground">{COL_LABELS[col]}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {previewRows.map((row, i) => (
                      <tr key={i} className={cn("border-t", i % 2 === 0 ? "bg-background" : "bg-muted/20")}>
                        {EXPECTED_COLS.filter((c) => mapping[c]).map((col) => (
                          <td key={col} className="px-3 py-2 max-w-40 truncate">{row[col] || <span className="text-muted-foreground/40">—</span>}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── Step 4: Done ── */}
          {step === "done" && importResult && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 p-4 rounded-xl bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800">
                <Check className="h-5 w-5 text-green-600 shrink-0" />
                <div>
                  <p className="font-semibold text-sm text-green-800 dark:text-green-200">
                    {importResult.imported} application{importResult.imported !== 1 ? "s" : ""} imported successfully
                  </p>
                  {importResult.errors.length > 0 && (
                    <p className="text-xs text-green-700 dark:text-green-300 mt-0.5">
                      {importResult.errors.length} row{importResult.errors.length !== 1 ? "s" : ""} skipped due to validation errors
                    </p>
                  )}
                </div>
              </div>
              {importResult.errors.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                    <AlertCircle className="h-3.5 w-3.5" /> Skipped rows
                  </p>
                  <div className="max-h-40 overflow-y-auto space-y-1">
                    {importResult.errors.map((e) => (
                      <p key={e.row} className="text-xs text-destructive bg-destructive/5 px-3 py-1.5 rounded-lg">
                        Row {e.row}: {e.message}
                      </p>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 pt-2 border-t mt-2">
          {step === "upload" && (
            <Button variant="ghost" onClick={handleClose}>Cancel</Button>
          )}
          {step === "map" && (
            <>
              <Button variant="ghost" onClick={() => setStep("upload")}>Back</Button>
              <Button onClick={handlePreview}>
                <FileText className="h-4 w-4 mr-1.5" /> Preview
              </Button>
            </>
          )}
          {step === "preview" && (
            <>
              <Button variant="ghost" onClick={() => setStep("map")}>Back</Button>
              <Button onClick={handleImport} disabled={importing}>
                {importing ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Upload className="h-4 w-4 mr-1.5" />}
                Import {rawRows.length} rows
              </Button>
            </>
          )}
          {step === "done" && (
            <>
              <Button variant="ghost" onClick={reset}>Import another</Button>
              <Button onClick={handleClose}>
                <X className="h-4 w-4 mr-1.5" /> Close
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
