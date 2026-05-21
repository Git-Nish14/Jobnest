"use client";

import { useState } from "react";
import { Upload } from "lucide-react";
import { CSVImportWizard } from "./csv-import-wizard";

export function ImportButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="db-btn-page-secondary"
        title="Import applications from a CSV file"
      >
        <Upload className="h-4 w-4" />
        Import CSV
      </button>
      <CSVImportWizard open={open} onOpenChange={setOpen} />
    </>
  );
}
