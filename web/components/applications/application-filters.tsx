"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { Search, X, ChevronDown, ArrowDownAZ, ArrowUpAZ, CalendarArrowDown, CalendarArrowUp, ChevronsUpDown } from "lucide-react";
import { APPLICATION_STATUSES } from "@/config";
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

  const [search, setSearch] = useState(searchParams.get("search") || "");
  const currentStatus = searchParams.get("status") || "all";
  const currentSort   = searchParams.get("sort")   || "date_desc";

  const push = useCallback(
    (qs: string) => startTransition(() => router.push(`/applications?${qs}`)),
    [router, startTransition]
  );

  const createQS = useCallback(
    (params: Record<string, string>) => {
      const next = new URLSearchParams(searchParams.toString());
      Object.entries(params).forEach(([k, v]) => {
        if (v && v !== "all") next.set(k, v);
        else next.delete(k);
      });
      return next.toString();
    },
    [searchParams]
  );

  const pushRef = useRef(push);
  const createQSRef = useRef(createQS);
  useEffect(() => { pushRef.current = push; });
  useEffect(() => { createQSRef.current = createQS; });

  const urlSearch = searchParams.get("search") ?? "";
  useEffect(() => {
    if (search === urlSearch) return;
    const t = setTimeout(
      () => pushRef.current(createQSRef.current({ search })),
      400
    );
    return () => clearTimeout(t);
  // urlSearch intentionally excluded — we only want to react to user typing
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

  const currentSortOption = SORT_OPTIONS.find((o) => o.value === currentSort) ?? SORT_OPTIONS[0];

  return (
    <div className="db-filter-bar">

      <form
        onSubmit={handleSearchSubmit}
        className="relative w-full lg:w-72 xl:w-80 lg:shrink-0"
      >
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#55433d]/50 pointer-events-none" />
        <input
          type="text"
          className="db-filter-search"
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

      <div className="flex items-center gap-2 min-w-0 lg:flex-1">

        <div className="db-filter-pills" role="group" aria-label="Filter by status">
          <button
            type="button"
            onClick={() => push(createQS({ status: "" }))}
            className={cn("db-filter-pill", currentStatus === "all" ? "db-filter-pill-active" : "db-filter-pill-inactive")}
            aria-pressed={currentStatus === "all" ? "true" : "false"}
          >
            All
          </button>
          {APPLICATION_STATUSES.map((status) => (
            <button
              key={status}
              type="button"
              onClick={() => push(createQS({ status }))}
              className={cn("db-filter-pill", currentStatus === status ? "db-filter-pill-active" : "db-filter-pill-inactive")}
              aria-pressed={currentStatus === status ? "true" : "false"}
            >
              {status}
            </button>
          ))}
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button type="button" className="db-filter-sort" aria-label={`Sort: ${currentSortOption.label}`}>
              <currentSortOption.icon className="h-3.5 w-3.5 shrink-0 opacity-60" />
              <span className="hidden sm:inline">{currentSortOption.label}</span>
              <span className="sm:hidden">{currentSortOption.shortLabel}</span>
              <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-50 lg:ml-auto" />
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
                  className={cn(
                    "flex items-center gap-2.5",
                    currentSort === opt.value && "font-semibold text-[#99462a]"
                  )}
                >
                  <Icon className="h-3.5 w-3.5 opacity-60" />
                  {opt.label}
                  {currentSort === opt.value && (
                    <span className="ml-auto h-1.5 w-1.5 rounded-full bg-[#99462a]" />
                  )}
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
