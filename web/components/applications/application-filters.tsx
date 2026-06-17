"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import {
  Search, X, ChevronDown, Loader2,
  ArrowDownAZ, ArrowUpAZ, CalendarArrowDown, CalendarArrowUp,
  ChevronsUpDown, Stamp, Building2, SlidersHorizontal,
} from "lucide-react";
import { APPLICATION_STATUSES } from "@/config";
import { COMPANY_TIERS } from "@/types/application";
import type { CompanyTier } from "@/types/application";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui";
import { cn } from "@/lib/utils";

const SORT_OPTIONS = [
  { value: "date_desc",    label: "Newest first",  icon: CalendarArrowDown },
  { value: "date_asc",     label: "Oldest first",  icon: CalendarArrowUp },
  { value: "company_asc",  label: "Company A–Z",   icon: ArrowDownAZ },
  { value: "company_desc", label: "Company Z–A",   icon: ArrowUpAZ },
  { value: "position_asc", label: "Position A–Z",  icon: ChevronsUpDown },
];

// All statuses shown as horizontal pills — "All" is the default
const STATUS_PILLS = ["All", ...APPLICATION_STATUSES] as const;

export function ApplicationFilters() {
  const router      = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const [search, setSearch] = useState(searchParams.get("search") || "");

  const currentStatus   = searchParams.get("status") || "all";
  const currentSort     = searchParams.get("sort")   || "date_desc";
  const sponsorshipOnly = searchParams.get("sponsorship") === "true";
  const currentTier     = (searchParams.get("tier") || "all") as CompanyTier | "all";

  // Advanced filter count (sponsorship + tier, not status — status has its own pills)
  const advancedCount = (sponsorshipOnly ? 1 : 0) + (currentTier !== "all" ? 1 : 0);

  const push = useCallback(
    (qs: string) => startTransition(() => router.push(`/applications?${qs}`)),
    [router, startTransition],
  );

  const createQS = useCallback(
    (params: Record<string, string>) => {
      const next = new URLSearchParams(searchParams.toString());
      Object.entries(params).forEach(([k, v]) => {
        if (v && v !== "all") next.set(k, v); else next.delete(k);
      });
      return next.toString();
    },
    [searchParams],
  );

  // Stable refs so effects don't capture stale closures
  const pushRef     = useRef(push);
  const createQSRef = useRef(createQS);
  useEffect(() => { pushRef.current = push; });
  useEffect(() => { createQSRef.current = createQS; });

  // Debounced search sync
  const urlSearch = searchParams.get("search") ?? "";
  useEffect(() => {
    if (search === urlSearch) return;
    const t = setTimeout(() => pushRef.current(createQSRef.current({ search })), 400);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    push(createQS({ search }));
  };

  const clearSearch = () => {
    setSearch("");
    push(createQS({ search: "" }));
  };

  const clearAdvanced = () => push(createQS({ sponsorship: "", tier: "" }));

  const currentSortOption = SORT_OPTIONS.find((o) => o.value === currentSort) ?? SORT_OPTIONS[0];

  return (
    /*
     * Sticky below the navbar on all screen sizes.
     * z-30 sits above card content (z-0) but below the bulk-actions bar (z-20… sticky top-16).
     * The bulk bar stacks ON TOP when it appears, which is the right layering.
     */
    <div className="sticky top-14 sm:top-16 z-20 -mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8 mb-4 bg-[#faf9f7]/95 dark:bg-black/95 backdrop-blur-md border-b border-border/30 dark:border-white/5 pt-2 pb-2.5">

      {/* ── Row 1: Search + Sort + Advanced Filter ── */}
      <div className="flex items-center gap-2">

        {/* Search — full-width, grows to fill space */}
        <form onSubmit={handleSearchSubmit} className="relative flex-1 min-w-0">
          {isPending
            ? <Loader2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#99462a] animate-spin pointer-events-none" />
            : <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#55433d]/40 pointer-events-none dark:text-white/30" />
          }
          <input
            type="text"
            className="db-filter-search w-full"
            placeholder="Search company or role…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Search applications"
          />
          {search && !isPending && (
            <button
              type="button"
              onClick={clearSearch}
              aria-label="Clear search"
              className="absolute right-2.5 top-1/2 -translate-y-1/2 h-6 w-6 flex items-center justify-center rounded-md text-[#55433d]/40 hover:text-[#55433d] hover:bg-[#dbc1b9]/20 transition-colors dark:text-white/30 dark:hover:text-white/70"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </form>

        {/* Sort dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              aria-label={`Sort: ${currentSortOption.label}`}
              title={currentSortOption.label}
              className="h-9 px-2.5 flex items-center gap-1.5 rounded-xl border border-[#dbc1b9]/25 dark:border-white/8 bg-[#f4f3f1] dark:bg-white/6 text-xs font-medium text-[#55433d] dark:text-white/60 hover:bg-[#e9e8e6] dark:hover:bg-white/10 transition-colors shrink-0"
            >
              <currentSortOption.icon className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{currentSortOption.label}</span>
              <ChevronDown className="h-3 w-3 opacity-50" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            <DropdownMenuLabel className="text-[10px] text-[#55433d]/50 dark:text-white/30 uppercase tracking-widest font-semibold">
              Sort by
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            {SORT_OPTIONS.map((opt) => {
              const Icon = opt.icon;
              return (
                <DropdownMenuItem
                  key={opt.value}
                  onClick={() => push(createQS({ sort: opt.value }))}
                  className={cn("flex items-center gap-2.5", currentSort === opt.value && "font-semibold text-[#99462a] dark:text-[#ccff00]")}
                >
                  <Icon className="h-3.5 w-3.5 opacity-60" />
                  {opt.label}
                  {currentSort === opt.value && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-[#99462a] dark:bg-[#ccff00]" />}
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Advanced filter — sponsorship + tier */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              aria-label="Advanced filters"
              title="More filters"
              className={cn(
                "relative h-9 w-9 flex items-center justify-center rounded-xl border transition-colors shrink-0",
                advancedCount > 0
                  ? "border-[#99462a]/40 dark:border-[#ccff00]/30 bg-[#99462a]/8 dark:bg-[#ccff00]/8 text-[#99462a] dark:text-[#ccff00]"
                  : "border-[#dbc1b9]/25 dark:border-white/8 bg-[#f4f3f1] dark:bg-white/6 text-[#55433d] dark:text-white/60 hover:bg-[#e9e8e6] dark:hover:bg-white/10"
              )}
            >
              <SlidersHorizontal className="h-3.5 w-3.5" />
              {advancedCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 h-4 min-w-4 rounded-full bg-[#99462a] dark:bg-[#ccff00] text-white dark:text-black text-[9px] font-bold flex items-center justify-center px-0.5 leading-none">
                  {advancedCount}
                </span>
              )}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel className="text-[10px] text-[#55433d]/50 dark:text-white/30 uppercase tracking-widest font-semibold">
              More filters
            </DropdownMenuLabel>
            <DropdownMenuSeparator />

            {/* Sponsorship toggle */}
            <DropdownMenuItem
              onClick={() => push(createQS({ sponsorship: sponsorshipOnly ? "" : "true" }))}
              className={cn("flex items-center gap-2.5", sponsorshipOnly && "font-semibold text-[#99462a] dark:text-[#ccff00]")}
            >
              <Stamp className="h-3.5 w-3.5 opacity-60" />
              Needs Sponsorship
              {sponsorshipOnly && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-[#99462a] dark:bg-[#ccff00]" />}
            </DropdownMenuItem>

            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-[10px] text-[#55433d]/50 dark:text-white/30 uppercase tracking-widest font-semibold">
              Company tier
            </DropdownMenuLabel>
            <DropdownMenuItem
              onClick={() => push(createQS({ tier: "" }))}
              className={cn("flex items-center gap-2.5", currentTier === "all" && "font-semibold text-[#99462a] dark:text-[#ccff00]")}
            >
              All tiers
              {currentTier === "all" && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-[#99462a] dark:bg-[#ccff00]" />}
            </DropdownMenuItem>
            {COMPANY_TIERS.map((tier) => (
              <DropdownMenuItem
                key={tier}
                onClick={() => push(createQS({ tier }))}
                className={cn("flex items-center gap-2.5", currentTier === tier && "font-semibold text-[#99462a] dark:text-[#ccff00]")}
              >
                <Building2 className="h-3.5 w-3.5 opacity-50" />
                {tier}
                {currentTier === tier && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-[#99462a] dark:bg-[#ccff00]" />}
              </DropdownMenuItem>
            ))}

            {advancedCount > 0 && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={clearAdvanced}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <X className="mr-2 h-3.5 w-3.5" />
                  Clear filters
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* ── Row 2: Status pills — horizontal scroll, no scrollbar ── */}
      {/* no-scrollbar: scrollbar hidden via dashboard.css utility */}
      <div
        className="no-scrollbar flex items-center gap-1.5 mt-2"
        role="group"
        aria-label="Filter by status"
      >
        {STATUS_PILLS.map((s) => {
          const isAll    = s === "All";
          const isActive = isAll ? currentStatus === "all" : currentStatus === s;
          return (
            <button
              key={s}
              type="button"
              onClick={() => push(createQS({ status: isAll ? "" : s }))}
              className={cn(
                "whitespace-nowrap shrink-0 rounded-full text-xs font-semibold px-2.5 py-1 transition-all duration-150",
                isActive
                  ? "bg-[#99462a] text-white dark:bg-[#ccff00] dark:text-black shadow-sm"
                  : "bg-[#f4f3f1] dark:bg-white/7 text-[#55433d] dark:text-white/55 hover:bg-[#e9e8e6] dark:hover:bg-white/12",
              )}
            >
              {s}
            </button>
          );
        })}
      </div>

      {/* ── Row 3: Active advanced-filter chips ── */}
      {advancedCount > 0 && (
        <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
          {sponsorshipOnly && (
            <button
              type="button"
              onClick={() => push(createQS({ sponsorship: "" }))}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-[#99462a]/10 dark:bg-[#ccff00]/10 text-[#99462a] dark:text-[#ccff00] border border-[#99462a]/20 dark:border-[#ccff00]/20 hover:bg-[#99462a]/20 transition-colors"
            >
              <Stamp className="h-2.5 w-2.5" />
              Needs Sponsorship
              <X className="h-2.5 w-2.5" />
            </button>
          )}
          {currentTier !== "all" && (
            <button
              type="button"
              onClick={() => push(createQS({ tier: "" }))}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-[#99462a]/10 dark:bg-[#ccff00]/10 text-[#99462a] dark:text-[#ccff00] border border-[#99462a]/20 dark:border-[#ccff00]/20 hover:bg-[#99462a]/20 transition-colors"
            >
              <Building2 className="h-2.5 w-2.5" />
              {currentTier}
              <X className="h-2.5 w-2.5" />
            </button>
          )}
          {advancedCount > 1 && (
            <button
              type="button"
              onClick={clearAdvanced}
              className="text-[11px] text-muted-foreground hover:text-foreground underline underline-offset-2 transition-colors"
            >
              Clear all
            </button>
          )}
        </div>
      )}
    </div>
  );
}
