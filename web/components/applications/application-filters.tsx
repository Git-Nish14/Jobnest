"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useState, useTransition } from "react";
import { Search, X, SlidersHorizontal, ArrowUpDown, Download } from "lucide-react";
import { APPLICATION_STATUSES } from "@/config";
import {
  Input,
  Button,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui";
import { cn } from "@/lib/utils";

const SORT_OPTIONS = [
  { value: "date_desc", label: "Newest First" },
  { value: "date_asc", label: "Oldest First" },
  { value: "company_asc", label: "Company A-Z" },
  { value: "company_desc", label: "Company Z-A" },
  { value: "position_asc", label: "Position A-Z" },
];

const DATE_RANGE_OPTIONS = [
  { value: "all", label: "All Time" },
  { value: "today", label: "Today" },
  { value: "week", label: "This Week" },
  { value: "month", label: "This Month" },
  { value: "quarter", label: "Last 3 Months" },
  { value: "year", label: "This Year" },
];

interface ApplicationFiltersProps {
  onExport?: () => void;
}

export function ApplicationFilters({ onExport }: ApplicationFiltersProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [showAdvanced, setShowAdvanced] = useState(false);

  const [search, setSearch] = useState(searchParams.get("search") || "");
  const currentStatus = searchParams.get("status") || "all";
  const currentSort = searchParams.get("sort") || "date_desc";
  const currentDateRange = searchParams.get("dateRange") || "all";
  const currentLocation = searchParams.get("location") || "";

  const createQueryString = useCallback(
    (params: Record<string, string>) => {
      const newSearchParams = new URLSearchParams(searchParams.toString());

      Object.entries(params).forEach(([key, value]) => {
        if (value && value !== "all") {
          newSearchParams.set(key, value);
        } else {
          newSearchParams.delete(key);
        }
      });

      return newSearchParams.toString();
    },
    [searchParams]
  );

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(() => {
      router.push(`/applications?${createQueryString({ search })}`);
    });
  };

  const handleStatusChange = (status: string) => {
    startTransition(() => {
      router.push(
        `/applications?${createQueryString({
          status: status === "all" ? "" : status,
        })}`
      );
    });
  };

  const handleSortChange = (sort: string) => {
    startTransition(() => {
      router.push(`/applications?${createQueryString({ sort })}`);
    });
  };

  const handleDateRangeChange = (dateRange: string) => {
    startTransition(() => {
      router.push(`/applications?${createQueryString({ dateRange })}`);
    });
  };

  const handleLocationChange = (e: React.SyntheticEvent<HTMLInputElement>) => {
    const location = (e.target as HTMLInputElement).value;
    startTransition(() => {
      router.push(`/applications?${createQueryString({ location })}`);
    });
  };

  const clearSearch = () => {
    setSearch("");
    startTransition(() => {
      router.push(`/applications?${createQueryString({ search: "" })}`);
    });
  };

  const clearAllFilters = () => {
    setSearch("");
    startTransition(() => {
      router.push("/applications");
    });
  };

  const hasActiveFilters =
    search ||
    currentStatus !== "all" ||
    currentSort !== "date_desc" ||
    currentDateRange !== "all" ||
    currentLocation;

  return (
    <div className="space-y-4">
      {/* Search and Actions Row */}
      <div className="flex flex-col sm:flex-row gap-3">
        <form onSubmit={handleSearchSubmit} className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search by company or position..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 pr-9"
          />
          {search && (
            <button
              type="button"
              onClick={clearSearch}
              aria-label="Clear search"
              title="Clear search"
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </form>

        <div className="flex gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className={cn(showAdvanced && "bg-muted")}
            title="Advanced filters"
          >
            <SlidersHorizontal className="h-4 w-4" />
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="gap-2">
                <ArrowUpDown className="h-4 w-4" />
                <span className="hidden sm:inline">Sort</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Sort by</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {SORT_OPTIONS.map((option) => (
                <DropdownMenuItem
                  key={option.value}
                  onClick={() => handleSortChange(option.value)}
                  className={cn(currentSort === option.value && "bg-muted")}
                >
                  {option.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {onExport && (
            <Button variant="outline" onClick={onExport} className="gap-2">
              <Download className="h-4 w-4" />
              <span className="hidden sm:inline">Export</span>
            </Button>
          )}
        </div>
      </div>

      {/* Status Filters */}
      <div className="flex gap-2 flex-wrap">
        <Button
          variant={currentStatus === "all" ? "default" : "outline"}
          size="sm"
          onClick={() => handleStatusChange("all")}
          disabled={isPending}
        >
          All
        </Button>
        {APPLICATION_STATUSES.map((status) => (
          <Button
            key={status}
            variant={currentStatus === status ? "default" : "outline"}
            size="sm"
            onClick={() => handleStatusChange(status)}
            disabled={isPending}
            className={cn(
              currentStatus === status && "bg-primary hover:bg-primary/90"
            )}
          >
            {status}
          </Button>
        ))}
      </div>

      {/* Advanced Filters */}
      {showAdvanced && (
        <div className="flex flex-wrap gap-4 p-4 bg-muted/50 rounded-lg border">
          <div className="flex-1 min-w-[200px]">
            <label className="text-sm font-medium mb-2 block">Date Range</label>
            <Select value={currentDateRange} onValueChange={handleDateRangeChange}>
              <SelectTrigger>
                <SelectValue placeholder="Select date range" />
              </SelectTrigger>
              <SelectContent>
                {DATE_RANGE_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex-1 min-w-[200px]">
            <label className="text-sm font-medium mb-2 block">Location</label>
            <Input
              type="text"
              placeholder="Filter by location..."
              defaultValue={currentLocation}
              onBlur={handleLocationChange}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  handleLocationChange(e);
                }
              }}
            />
          </div>

          {hasActiveFilters && (
            <div className="flex items-end">
              <Button
                variant="ghost"
                size="sm"
                onClick={clearAllFilters}
                className="text-muted-foreground"
              >
                <X className="h-4 w-4 mr-1" />
                Clear all filters
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
