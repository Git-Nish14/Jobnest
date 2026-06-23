"use client";

import { useState, useRef } from "react";
import { Download, Loader2, FileText, FileJson, BarChart3 } from "lucide-react";
import { toast } from "sonner";
import { fetchWithRetry } from "@/lib/utils/fetch-retry";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui";

export function ExportButton() {
  const [loading, setLoading] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const exportingRef = useRef(false);

  const handleExport = async (format: "csv" | "json", includeNotes = false) => {
    if (exportingRef.current) return;
    exportingRef.current = true;
    setLoading(true);

    try {
      const params = new URLSearchParams();
      params.set("format", format);
      if (includeNotes) params.set("includeNotes", "true");

      const response = await fetchWithRetry(`/api/export?${params.toString()}`, {}, { retries: 1, timeoutMs: 30_000 });

      if (!response.ok) {
        throw new Error("Export failed");
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `applications.${format}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success(`Exported applications as ${format.toUpperCase()}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to export applications");
    } finally {
      setLoading(false);
      exportingRef.current = false;
    }
  };

  const handleFullReport = async () => {
    if (pdfLoading) return;
    setPdfLoading(true);
    try {
      const response = await fetch("/api/export/pdf-report");
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error((data as { error?: string }).error || "Report generation failed");
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `job-search-report-${new Date().toISOString().slice(0, 10)}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success("Full report downloaded");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to generate report");
    } finally {
      setPdfLoading(false);
    }
  };

  const anyLoading = loading || pdfLoading;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button type="button" disabled={anyLoading} className="db-btn-page-secondary">
          {anyLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Download className="h-4 w-4" />
          )}
          Export
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>Export Format</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => handleExport("csv")}>
          <FileText className="h-4 w-4 mr-2" />
          CSV (Basic)
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleExport("csv", true)}>
          <FileText className="h-4 w-4 mr-2" />
          CSV (With Notes)
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => handleExport("json")}>
          <FileJson className="h-4 w-4 mr-2" />
          JSON
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleFullReport} disabled={pdfLoading}>
          {pdfLoading
            ? <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            : <BarChart3 className="h-4 w-4 mr-2" />
          }
          Full Report (PDF)
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
