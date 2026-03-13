"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useState, useTransition } from "react";
import { Search, X } from "lucide-react";
import { APPLICATION_STATUSES } from "@/lib/validations/application";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";

export function ApplicationFilters() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const [search, setSearch] = useState(searchParams.get("search") || "");
  const currentStatus = searchParams.get("status") || "all";

  const createQueryString = useCallback(
    (params: Record<string, string>) => {
      const newSearchParams = new URLSearchParams(searchParams.toString());

      Object.entries(params).forEach(([key, value]) => {
        if (value) {
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

  const clearSearch = () => {
    setSearch("");
    startTransition(() => {
      router.push(`/applications?${createQueryString({ search: "" })}`);
    });
  };

  return (
    <div className="flex flex-col gap-4">
      <form onSubmit={handleSearchSubmit} className="relative">
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
    </div>
  );
}
