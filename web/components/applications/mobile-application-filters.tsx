"use client";

import { useEffect, useId, useRef, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Search, SlidersHorizontal, X, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui";
import { APPLICATION_STATUSES } from "@/config/constants";
import { COMPANY_TIERS } from "@/types/application";
import styles from "./mobile-workspace.module.css";

const DATES = [
  ["all", "Any time"], ["today", "Today"], ["yesterday", "Yesterday"],
  ["week", "This week"], ["month", "This month"], ["quarter", "Last 3 months"], ["year", "This year"],
] as const;
const SORTS = [
  ["date_desc", "Newest first"], ["date_asc", "Oldest first"],
  ["company_asc", "Company A–Z"], ["company_desc", "Company Z–A"], ["position_asc", "Role A–Z"],
] as const;
const DEFAULTS = { status: "all", dateRange: "all", sort: "date_desc", location: "", tier: "all", sponsorship: false, view: "list" };

interface Props {
  search: string;
  onSearchChange: (value: string) => void;
  onSearchSubmit: (event: React.FormEvent) => void;
  onClearSearch: () => void;
  pending: boolean;
}

export function MobileApplicationFilters({ search, onSearchChange, onSearchSubmit, onClearSearch, pending }: Props) {
  const router = useRouter();
  const params = useSearchParams();
  const [applying, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const id = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const desktop = window.matchMedia("(min-width: 768px)");
    const closeOnDesktop = () => { if (desktop.matches) setOpen(false); };
    desktop.addEventListener("change", closeOnDesktop);
    return () => desktop.removeEventListener("change", closeOnDesktop);
  }, [open]);
  const readFilters = () => ({
    status: params.get("status") || "all",
    dateRange: params.get("dateRange") || "all",
    sort: params.get("sort") || "date_desc",
    location: params.get("location") || "",
    tier: params.get("tier") || "all",
    sponsorship: params.get("sponsorship") === "true",
    view: params.get("view") === "kanban" ? "kanban" : "list",
  });
  const current = readFilters();
  const [draft, setDraft] = useState(current);
  const count = Number(current.status !== "all") + Number(current.dateRange !== "all") + Number(current.tier !== "all") + Number(!!current.location) + Number(current.sponsorship);
  const summary = [
    current.status !== "all" && current.status,
    current.dateRange !== "all" && DATES.find(([value]) => value === current.dateRange)?.[1],
    current.location,
    current.tier !== "all" && current.tier,
    current.sponsorship && "Sponsorship",
    current.sort !== "date_desc" && SORTS.find(([value]) => value === current.sort)?.[1],
    current.view === "kanban" && "Board view",
  ].filter(Boolean).join(" · ");

  function apply(filters: typeof DEFAULTS) {
    const next = new URLSearchParams(params.toString());
    next.delete("page");
    for (const [key, raw] of Object.entries(filters)) {
      const value = typeof raw === "boolean" ? (raw ? "true" : "") : raw.trim();
      if (!value || value === "all" || (key === "sort" && value === "date_desc") || (key === "view" && value === "list")) next.delete(key);
      else next.set(key, value);
    }
    if (search.trim()) next.set("search", search.trim()); else next.delete("search");
    startTransition(() => router.push(`/applications${next.size ? `?${next}` : ""}`, { scroll: false }));
    setOpen(false);
  }

  return (
    <div className={`${styles.mobileOnly} ${styles.filters}`}>
      <div className={styles.searchRow}>
        <form className={styles.searchForm} role="search" onSubmit={onSearchSubmit}>
          {pending ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Search aria-hidden="true" />}
          <input className={styles.searchInput} aria-label="Search applications" placeholder="Company or role" type="text" enterKeyHint="search" value={search} onChange={(event) => onSearchChange(event.target.value)} />
          {search && <button type="button" className={styles.clearSearch} aria-label="Clear search" onClick={onClearSearch}><X size={16} /></button>}
        </form>
        <button ref={triggerRef} type="button" className={styles.filterButton} aria-label={count ? `Filters, ${count} active` : "Filters"} onClick={() => { setDraft(readFilters()); setOpen(true); }}>
          <SlidersHorizontal size={16} aria-hidden="true" />Filters{count > 0 && <span className={styles.filterCount}>{count}</span>}
        </button>
      </div>
      {summary && <div className={styles.filterSummary}><p>{summary}</p>{(count > 0 || current.sort !== "date_desc") && <button type="button" className={styles.resetLink} onClick={() => apply({ ...DEFAULTS, view: current.view })}>Clear</button>}</div>}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent placement="bottom" className={styles.sheet} showClose={false} data-mobile-sheet="application-filters"
          onOpenAutoFocus={(event) => { event.preventDefault(); closeRef.current?.focus({ preventScroll: true }); }}
          onCloseAutoFocus={(event) => { event.preventDefault(); triggerRef.current?.focus({ preventScroll: true }); }}>
          <div className={styles.sheetHeader}>
            <div><DialogTitle className={styles.sheetTitle}>Filter applications</DialogTitle><DialogDescription className={styles.sheetDescription}>Find the opportunities you want to focus on.</DialogDescription></div>
            <button ref={closeRef} type="button" className={styles.close} onClick={() => setOpen(false)} aria-label="Close filters"><X size={20} /></button>
          </div>
          <form onSubmit={(event) => { event.preventDefault(); apply(draft); }}>
            <div className={styles.fields}>
              <label className={styles.field} htmlFor={`${id}-status`}>Status<select id={`${id}-status`} value={draft.status} onChange={(event) => setDraft({ ...draft, status: event.target.value })}><option value="all">All statuses</option>{APPLICATION_STATUSES.map((status) => <option key={status}>{status}</option>)}</select></label>
              <label className={styles.field} htmlFor={`${id}-date`}>Applied date<select id={`${id}-date`} value={draft.dateRange} onChange={(event) => setDraft({ ...draft, dateRange: event.target.value })}>{DATES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
              <label className={styles.field} htmlFor={`${id}-sort`}>Sort by<select id={`${id}-sort`} value={draft.sort} onChange={(event) => setDraft({ ...draft, sort: event.target.value })}>{SORTS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
              <label className={styles.field} htmlFor={`${id}-location`}>Location<input id={`${id}-location`} placeholder="City or remote" value={draft.location} onChange={(event) => setDraft({ ...draft, location: event.target.value })} /></label>
              <label className={styles.field} htmlFor={`${id}-tier`}>Company tier<select id={`${id}-tier`} value={draft.tier} onChange={(event) => setDraft({ ...draft, tier: event.target.value })}><option value="all">All companies</option>{COMPANY_TIERS.map((tier) => <option key={tier}>{tier}</option>)}</select></label>
              <label className={styles.checkboxField}><input type="checkbox" checked={draft.sponsorship} onChange={(event) => setDraft({ ...draft, sponsorship: event.target.checked })} />Show roles marked as needing sponsorship</label>
              <label className={styles.field} htmlFor={`${id}-view`}>Display<select id={`${id}-view`} value={draft.view} onChange={(event) => setDraft({ ...draft, view: event.target.value })}><option value="list">List</option><option value="kanban">Board</option></select></label>
            </div>
            <div className={styles.sheetActions}>
              <button type="button" className={styles.secondary} onClick={() => setDraft({ ...DEFAULTS, view: draft.view })}>Reset</button>
              <button type="submit" className={styles.primary} disabled={applying}>Apply filters</button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
