import Link from "next/link";
import { Plus } from "lucide-react";
import { ExportButton } from "./export-button";
import { ImportButton } from "./import-button";
import { ViewToggle } from "./view-toggle";
import styles from "./mobile-workspace.module.css";

export function ApplicationsHeader() {
  return (
    <header className={`mb-4 flex items-end justify-between gap-3 sm:mb-6 ${styles.pageHeader}`}>
      <div className="min-w-0">
        <p className="mb-1 hidden text-[10px] font-bold uppercase tracking-[0.2em] text-[#99462a] dark:text-[#ccff00] md:block">
          Job search workspace
        </p>
        <h1 className="db-page-title app-page-title">Applications</h1>
        <p className="db-page-subtitle mt-1 hidden md:block">
          Track every opportunity and keep your next move clear.
        </p>
      </div>
      <div className="flex shrink-0 flex-wrap items-center gap-2">
        <div className="hidden md:block"><ViewToggle /></div>
        <div className="hidden md:flex items-center gap-2">
          <ImportButton />
          <ExportButton />
        </div>
        <div className="hidden md:block">
          <Link href="/applications/new" className="db-btn-page-primary">
            <Plus className="h-4 w-4" />New Application
          </Link>
        </div>
        <Link href="/applications/new" className={`${styles.add} md:hidden`} aria-label="Add application">
          <Plus className="h-4 w-4" />Add
        </Link>
      </div>
    </header>
  );
}
