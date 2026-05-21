"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import {
  Search, X, ChevronDown,
  ArrowDownAZ, ArrowUpAZ, CalendarArrowDown, CalendarArrowUp, ChevronsUpDown,
  Stamp, Filter, Building2,
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
  { value: "date_desc",    label: "Newest First",  shortLabel: "Newest",   icon: CalendarArrowDown },
  { value: "date_asc",     label: "Oldest First",  shortLabel: "Oldest",   icon: CalendarArrowUp },
  { value: "company_asc",  label: "Company A–Z",   shortLabel: "A–Z",      icon: ArrowDownAZ },
  { value: "company_desc", label: "Company Z–A",   shortLabel: "Z–A",      icon: ArrowUpAZ },
  { value: "position_asc", label: "Position A–Z",  shortLabel: "Position", icon: ChevronsUpDown },
];

export function ApplicationFilters() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

  const [search, setSearch]   = useState(searchParams.get("search") || "");
  const currentStatus           = searchParams.get("status") || "all";
  const currentSort             = searchParams.get("sort")   || "date_desc";
  const sponsorshipOnly         = searchParams.get("sponsorship") === "true";
  const currentTier             = (searchParams.get("tier") || "all") as CompanyTier | "all";

  // Count active non-sort filters for the badge
  const activeFilterCount = (currentStatus !== "all" ? 1 : 0) + (sponsorshipOnly ? 1 : 0) + (currentTier !== "all" ? 1 : 0);

  const push = useCallback(
    (qs: string) => startTransition(() => router.push(`/applications?${qs}`)),
    [router, startTransition]
  );

  const createQS = useCallback(
    (params: Record<string, string>) => {
      const next = new URLSearchParams(searchParams.toString());
      Object.entries(params).forEach(([k, v]) => {
        if (v && v !== "all") next.set(k, v); else next.delete(k);
      });
      return next.toString();
    },
    [searchParams]
  );

  const pushRef      = useRef(push);
  const createQSRef  = useRef(createQS);
  useEffect(() => { pushRef.current = push; });
  useEffect(() => { createQSRef.current = createQS; });

  const urlSearch = searchParams.get("search") ?? "";
  useEffect(() => {
    if (search === urlSearch) return;
    const t = setTimeout(() => pushRef.current(createQSRef.current({ search })), 400);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const handleSearchSubmit = (e: React.FormEvent) => { e.preventDefault(); push(createQS({ search })); };
  const clearSearch = () => { setSearch(""); push(createQS({ search: "" })); };
  const clearAllFilters = () => push(createQS({ status: "", sponsorship: "", tier: "" }));

  const currentSortOption = SORT_OPTIONS.find((o) => o.value === currentSort) ?? SORT_OPTIONS[0];

  return (
    <div className="db-filter-bar">

      {/* ── Row 1: search + filter dropdown + sort ── */}
      <div className="flex items-center gap-2 w-full">

        {/* Search */}
        <form onSubmit={handleSearchSubmit} className="relative flex-1 min-w-0">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#55433d]/50 pointer-events-none" />
          <input
            type="text"
            className="db-filter-search w-full"
            placeholder="Search company, role…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Search applications"
          />
          {search && (
            <button
              type="button"
              onClick={clearSearch}
              aria-label="Clear search"
              className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded-md text-[#55433d]/40 hover:text-[#55433d] hover:bg-[#dbc1b9]/20 transition-colors"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </form>

        {/* Filter dropdown — all screen sizes */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className={cn(
                "db-filter-sort relative",
                activeFilterCount > 0 && "text-[#99462a] dark:text-[#ccff00] font-semibold border-[#99462a]/40 dark:border-[#ccff00]/30"
              )}
              aria-label="Filter applications"
            >
              <Filter className="h-3.5 w-3.5 shrink-0 opacity-70" />
              <span className="hidden sm:inline">Filter</span>
              {activeFilterCount > 0 && (
                <span className="flex items-center justify-center h-4 w-4 rounded-full bg-[#99462a] dark:bg-[#ccff00] text-white dark:text-black text-[10px] font-bold leading-none">
                  {activeFilterCount}
                </span>
              )}
              <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-50" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-52">
            <DropdownMenuLabel className="text-[10px] text-[#55433d]/50 uppercase tracking-widest font-semibold">
              Filter by status
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => push(createQS({ status: "" }))}
              className={cn("flex items-center gap-2.5", currentStatus === "all" && "font-semibold text-[#99462a]")}
            >
              All statuses
              {currentStatus === "all" && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-[#99462a]" />}
            </DropdownMenuItem>
            {APPLICATION_STATUSES.map((status) => (
              <DropdownMenuItem
                key={status}
                onClick={() => push(createQS({ status }))}
                className={cn("flex items-center gap-2.5", currentStatus === status && "font-semibold text-[#99462a]")}
              >
                {status}
                {currentStatus === status && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-[#99462a]" />}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => push(createQS({ sponsorship: sponsorshipOnly ? "" : "true" }))}
              className={cn("flex items-center gap-2.5", sponsorshipOnly && "font-semibold text-[#99462a]")}
            >
              <Stamp className="h-3.5 w-3.5 opacity-60" />
              Needs Sponsorship
              {sponsorshipOnly && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-[#99462a]" />}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-[10px] text-[#55433d]/50 uppercase tracking-widest font-semibold">
              Company tier
            </DropdownMenuLabel>
            <DropdownMenuItem
              onClick={() => push(createQS({ tier: "" }))}
              className={cn("flex items-center gap-2.5", currentTier === "all" && "font-semibold text-[#99462a]")}
            >
              All tiers
              {currentTier === "all" && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-[#99462a]" />}
            </DropdownMenuItem>
            {COMPANY_TIERS.map((tier) => (
              <DropdownMenuItem
                key={tier}
                onClick={() => push(createQS({ tier }))}
                className={cn("flex items-center gap-2.5", currentTier === tier && "font-semibold text-[#99462a]")}
              >
                <Building2 className="h-3.5 w-3.5 opacity-50" />
                {tier}
                {currentTier === tier && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-[#99462a]" />}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Sort dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button type="button" className="db-filter-sort" aria-label={`Sort: ${currentSortOption.label}`}>
              <currentSortOption.icon className="h-3.5 w-3.5 shrink-0 opacity-60" />
              <span className="hidden sm:inline">{currentSortOption.label}</span>
              <span className="sm:hidden">{currentSortOption.shortLabel}</span>
              <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-50" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuLabel className="text-[10px] text-[#55433d]/50 uppercase tracking-widest font-semibold">
              Sort by
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            {SORT_OPTIONS.map((opt) => {
              const Icon = opt.icon;
              return (
                <DropdownMenuItem
                  key={opt.value}
                  onClick={() => push(createQS({ sort: opt.value }))}
                  className={cn("flex items-center gap-2.5", currentSort === opt.value && "font-semibold text-[#99462a]")}
                >
                  <Icon className="h-3.5 w-3.5 opacity-60" />
                  {opt.label}
                  {currentSort === opt.value && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-[#99462a]" />}
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* ── Row 2: active filter chips (only shown when filters are on) ── */}
      {activeFilterCount > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          {currentStatus !== "all" && (
            <button
              type="button"
              onClick={() => push(createQS({ status: "" }))}
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-[#99462a]/10 dark:bg-[#ccff00]/10 text-[#99462a] dark:text-[#ccff00] border border-[#99462a]/20 dark:border-[#ccff00]/20 hover:bg-[#99462a]/20 transition-colors"
            >
              {currentStatus}
              <X className="h-3 w-3" />
            </button>
          )}
          {sponsorshipOnly && (
            <button
              type="button"
              onClick={() => push(createQS({ sponsorship: "" }))}
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-[#99462a]/10 dark:bg-[#ccff00]/10 text-[#99462a] dark:text-[#ccff00] border border-[#99462a]/20 dark:border-[#ccff00]/20 hover:bg-[#99462a]/20 transition-colors"
            >
              <Stamp className="h-3 w-3" />
              Needs Sponsorship
              <X className="h-3 w-3" />
            </button>
          )}
          {currentTier !== "all" && (
            <button
              type="button"
              onClick={() => push(createQS({ tier: "" }))}
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-[#99462a]/10 dark:bg-[#ccff00]/10 text-[#99462a] dark:text-[#ccff00] border border-[#99462a]/20 dark:border-[#ccff00]/20 hover:bg-[#99462a]/20 transition-colors"
            >
              <Building2 className="h-3 w-3" />
              {currentTier}
              <X className="h-3 w-3" />
            </button>
          )}
          {activeFilterCount > 1 && (
            <button
              type="button"
              onClick={clearAllFilters}
              className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2 transition-colors"
            >
              Clear all
            </button>
          )}
        </div>
      )}
    </div>
  );
}
