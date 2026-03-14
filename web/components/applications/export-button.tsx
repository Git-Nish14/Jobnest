"use client";

import { useState } from "react";
import { Download, Loader2, FileText, FileJson } from "lucide-react";
import { toast } from "sonner";
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui";

export function ExportButton() {
  const [loading, setLoading] = useState(false);

  const handleExport = async (format: "csv" | "json", includeNotes = false) => {
    setLoading(true);

    try {
      const params = new URLSearchParams();
      params.set("format", format);
      if (includeNotes) params.set("includeNotes", "true");

      const response = await fetch(`/api/export?${params.toString()}`);

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
      toast.error("Failed to export applications");
    } finally {
      setLoading(false);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" disabled={loading} className="gap-2">
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Download className="h-4 w-4" />
          )}
          Export
        </Button>
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
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
