"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useState, useTransition } from "react";
import { Search, X, ChevronDown } from "lucide-react";
import { APPLICATION_STATUSES } from "@/config";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui";
import { cn } from "@/lib/utils";

const SORT_OPTIONS = [
  { value: "date_desc",     label: "Newest First" },
  { value: "date_asc",      label: "Oldest First" },
  { value: "company_asc",   label: "Company A–Z" },
  { value: "company_desc",  label: "Company Z–A" },
  { value: "position_asc",  label: "Position A–Z" },
];

export function ApplicationFilters() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

  const [search, setSearch] = useState(searchParams.get("search") || "");
  const currentStatus = searchParams.get("status") || "all";
  const currentSort   = searchParams.get("sort")   || "date_desc";

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

  const push = (qs: string) =>
    startTransition(() => router.push(`/applications?${qs}`));

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    push(createQS({ search }));
  };

  const clearSearch = () => {
    setSearch("");
    push(createQS({ search: "" }));
  };

  const currentSortLabel =
    SORT_OPTIONS.find((o) => o.value === currentSort)?.label ?? "Sort";

  return (
    <div className="db-filter-bar">

      {/* Search */}
      <form onSubmit={handleSearchSubmit} className="relative grow w-full">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-[#55433d]/60 pointer-events-none" />
        <input
          type="text"
          className="db-filter-search"
          placeholder="Search your journey…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        {search && (
          <button
            type="button"
            onClick={clearSearch}
            aria-label="Clear search"
            className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded text-[#55433d]/50 hover:text-[#55433d] transition-colors"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </form>

      {/* Status pills */}
      <div className="flex items-center gap-2 overflow-x-auto pb-0.5 lg:pb-0 w-full lg:w-auto">
        <button
          type="button"
          onClick={() => push(createQS({ status: "" }))}
          className={cn("db-filter-pill", currentStatus === "all" ? "db-filter-pill-active" : "db-filter-pill-inactive")}
        >
          All
        </button>
        {APPLICATION_STATUSES.map((status) => (
          <button
            key={status}
            type="button"
            onClick={() => push(createQS({ status }))}
            className={cn("db-filter-pill", currentStatus === status ? "db-filter-pill-active" : "db-filter-pill-inactive")}
          >
            {status}
          </button>
        ))}
      </div>

      {/* Sort dropdown */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button type="button" className="db-filter-sort lg:min-w-44">
            <span className="text-[#55433d]">{currentSortLabel}</span>
            <ChevronDown className="h-4 w-4 text-[#55433d]/60 ml-2" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuLabel className="text-xs text-[#55433d]/60 uppercase tracking-widest">Sort by</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {SORT_OPTIONS.map((opt) => (
            <DropdownMenuItem
              key={opt.value}
              onClick={() => push(createQS({ sort: opt.value }))}
              className={cn(currentSort === opt.value && "font-semibold text-[#99462a]")}
            >
              {opt.label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
