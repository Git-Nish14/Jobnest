"use client";

import { useState } from "react";
import { FileDown, Loader2 } from "lucide-react";
import { Button } from "@/components/ui";
import { toast } from "sonner";

interface SalaryPageClientProps {
  offerIds: string[];
}

export function SalaryPageClient({ offerIds }: SalaryPageClientProps) {
  const [exporting, setExporting] = useState(false);

  const handleExportPDF = async () => {
    setExporting(true);
    try {
      const ids = offerIds.slice(0, 3);
      const res = await fetch("/api/salary/export-pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ application_ids: ids }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Export failed");
      }

      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement("a");
      a.href     = url;
      a.download = `offer-comparison-${Date.now()}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Offer comparison PDF downloaded");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "PDF export failed");
    } finally {
      setExporting(false);
    }
  };

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleExportPDF}
      disabled={exporting || offerIds.length === 0}
    >
      {exporting
        ? <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        : <FileDown className="mr-2 h-4 w-4" />
      }
      Export PDF
    </Button>
  );
}
