import { Skeleton } from "@/components/ui/skeleton";

// ── Dashboard page skeleton ──────────────────────────────────────────────────
export function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-2">
          <Skeleton className="h-8 w-36" />
          <Skeleton className="h-4 w-56" />
        </div>
        <Skeleton className="h-9 w-40" />
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="rounded-xl border bg-white p-4 sm:p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-2">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-8 w-14" />
              </div>
              <Skeleton className="h-9 w-9 rounded-lg shrink-0" />
            </div>
          </div>
        ))}
      </div>

      {/* Charts Row */}
      <div className="grid gap-4 sm:gap-6 lg:grid-cols-2">
        {[...Array(2)].map((_, i) => (
          <div key={i} className="rounded-xl border bg-white p-6">
            <div className="mb-4 space-y-1.5">
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-3 w-28" />
            </div>
            <Skeleton className="h-[200px] w-full rounded-lg" />
          </div>
        ))}
      </div>

      {/* Response Rate & Recent */}
      <div className="grid gap-4 sm:gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 rounded-xl border bg-white p-6">
          <div className="mb-4 flex items-center justify-between">
            <Skeleton className="h-5 w-44" />
            <Skeleton className="h-8 w-20" />
          </div>
          <div className="space-y-1">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex items-center gap-3 py-3 border-t first:border-t-0">
                <Skeleton className="h-8 w-8 rounded-lg shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-4 w-48" />
                  <Skeleton className="h-3 w-28" />
                </div>
                <Skeleton className="h-5 w-16 rounded-full" />
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-xl border bg-white p-6">
          <Skeleton className="h-5 w-32 mb-4" />
          <Skeleton className="h-32 w-32 rounded-full mx-auto mb-4" />
          <Skeleton className="h-4 w-full mb-2" />
          <Skeleton className="h-4 w-3/4" />
        </div>
      </div>

      {/* Interviews & Reminders */}
      <div className="grid gap-4 sm:gap-6 lg:grid-cols-2">
        {[...Array(2)].map((_, i) => (
          <div key={i} className="rounded-xl border bg-white p-6">
            <div className="mb-4 flex items-center justify-between">
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-8 w-20" />
            </div>
            <div className="space-y-3">
              {[...Array(3)].map((_, j) => (
                <div key={j} className="flex items-center gap-3 py-2 border-t first:border-t-0">
                  <Skeleton className="h-8 w-8 rounded-lg shrink-0" />
                  <div className="flex-1 space-y-1.5">
                    <Skeleton className="h-4 w-36" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                  <Skeleton className="h-5 w-14 rounded-full" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Applications page skeleton ───────────────────────────────────────────────
export function ApplicationsSkeleton() {
  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-2">
          <Skeleton className="h-8 w-40" />
          <Skeleton className="h-4 w-64" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-9 w-24" />
          <Skeleton className="h-9 w-36" />
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 sm:gap-3">
        <Skeleton className="h-10 w-full max-w-xs" />
        <Skeleton className="h-10 w-32" />
        <Skeleton className="h-10 w-32" />
      </div>

      {/* Application Cards */}
      <div className="space-y-3">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="rounded-xl border bg-white p-4 sm:p-5">
            <div className="flex items-start gap-3 sm:gap-4">
              <Skeleton className="h-9 w-9 sm:h-10 sm:w-10 rounded-lg shrink-0" />
              <div className="flex-1 min-w-0 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Skeleton className="h-5 w-44" />
                    <Skeleton className="h-5 w-16 rounded-full" />
                  </div>
                </div>
                <Skeleton className="h-4 w-32" />
                <div className="flex gap-4">
                  <Skeleton className="h-3 w-24" />
                  <Skeleton className="h-3 w-20" />
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Generic page skeleton (interviews, reminders, contacts, etc.) ────────────
export function GenericPageSkeleton() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-2">
          <Skeleton className="h-8 w-40" />
          <Skeleton className="h-4 w-60" />
        </div>
        <Skeleton className="h-9 w-36" />
      </div>

      {/* Main card */}
      <div className="rounded-xl border bg-white p-6">
        <div className="mb-6 space-y-1.5">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-4 w-56" />
        </div>
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="flex items-center gap-4 p-4 rounded-lg border">
              <Skeleton className="h-10 w-10 rounded-lg shrink-0" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-48" />
                <Skeleton className="h-3 w-64" />
              </div>
              <Skeleton className="h-5 w-20 rounded-full" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
