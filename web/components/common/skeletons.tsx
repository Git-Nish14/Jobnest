import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

function SkeletonFrame({ children, className, label = "Loading page" }: {
  children: React.ReactNode;
  className?: string;
  label?: string;
}) {
  return (
    <div role="status" aria-busy="true" className={cn("min-w-0 motion-safe:animate-pulse [&_.animate-pulse]:animate-none", className)}>
      <span className="sr-only">{label}</span>
      <div aria-hidden="true" className="contents">{children}</div>
    </div>
  );
}

function AtelierShimmer({ className }: { className?: string }) {
  return <Skeleton className={`bg-[#e3e2e0] dark:bg-white/10 ${className ?? ""}`} />;
}

// Skeleton bar heights as Tailwind arbitrary classes (static, no inline styles)
const SKEL_BAR_HEIGHTS = ["h-[40%]", "h-[65%]", "h-[90%]", "h-[55%]", "h-[75%]", "h-[45%]", "h-[60%]"] as const;
const SKEL_STAT_BG = ["bg-[#f4f3f1] dark:bg-white/5", "bg-[#e9e8e6] dark:bg-white/8", "bg-[#ffdbd0]/40 dark:bg-white/5"] as const;

// ── DashboardSkeleton
export function DashboardSkeleton() {
  return (
    <SkeletonFrame label="Loading dashboard">
      <div className="mobile-dashboard space-y-5 md:hidden">
        <div className="space-y-2">
          <AtelierShimmer className="h-3 w-24" />
          <AtelierShimmer className="h-9 w-64" />
          <AtelierShimmer className="h-4 w-full" />
        </div>
        <div className="mobile-focus-card space-y-4">
          <AtelierShimmer className="h-5 w-36" />
          <AtelierShimmer className="h-12 w-full" />
          <div className="grid grid-cols-2 gap-2">
            <AtelierShimmer className="h-11 w-full rounded-xl" />
            <AtelierShimmer className="h-11 w-full rounded-xl" />
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {[0, 1, 2].map((i) => <AtelierShimmer key={i} className="h-20 w-full rounded-2xl" />)}
        </div>
        <AtelierShimmer className="h-7 w-36" />
        <div className="grid grid-cols-3 gap-2">
          {[0, 1, 2].map((i) => <AtelierShimmer key={i} className="h-20 w-full rounded-2xl" />)}
        </div>
        <SkeletonRows count={3} />
      </div>
      <div className="hidden space-y-8 md:block">

      <div className="space-y-3">
        <AtelierShimmer className="h-12 w-72 md:h-16 md:w-96 rounded-lg" />
        <AtelierShimmer className="h-5 w-80 rounded" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {SKEL_STAT_BG.map((bg, i) => (
          <div key={i} className={`${bg} rounded-xl p-8 flex flex-col justify-between db-skel-stat`}>
            <div className="space-y-3">
              <AtelierShimmer className="h-5 w-5 rounded" />
              <AtelierShimmer className="h-3 w-28 rounded" />
              <AtelierShimmer className="h-12 w-16 rounded" />
            </div>
            <AtelierShimmer className="h-4 w-36 rounded mt-8" />
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">

        <div className="md:col-span-8 p-8 db-skel-panel">
          <div className="flex justify-between items-center mb-8">
            <AtelierShimmer className="h-7 w-48 rounded" />
            <AtelierShimmer className="h-4 w-32 rounded" />
          </div>
          <div className="db-chart-area">
            {SKEL_BAR_HEIGHTS.map((h, i) => (
              <div key={i} className={`flex-1 bg-[#e9e8e6] dark:bg-white/8 animate-pulse rounded-t ${h}`} />
            ))}
          </div>
          <div className="flex justify-between mt-3 px-1">
            {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
              <AtelierShimmer key={d} className="h-3 w-6 rounded" />
            ))}
          </div>
        </div>

        <div className="md:col-span-4 p-8 db-skel-panel flex flex-col gap-6">
          <AtelierShimmer className="h-7 w-36 rounded" />
          <div className="space-y-5 flex-1">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="flex items-start gap-3">
                <AtelierShimmer className="h-5 w-5 rounded-full mt-0.5 shrink-0" />
                <div className="min-w-0 flex-1 space-y-1.5">
                  <AtelierShimmer className="h-4 w-full rounded" />
                  <AtelierShimmer className="h-3 w-24 rounded" />
                </div>
              </div>
            ))}
          </div>
          <AtelierShimmer className="h-16 w-full rounded-xl mt-auto" />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">

        <div className="md:col-span-4 p-8 db-skel-panel flex flex-col gap-5">
          <div className="space-y-1">
            <AtelierShimmer className="h-7 w-44 rounded" />
            <AtelierShimmer className="h-3 w-52 rounded" />
          </div>
          <div className="flex items-center gap-5">
            <AtelierShimmer className="h-24 w-24 rounded-full shrink-0" />
            <div className="min-w-0 flex-1 space-y-3">
              <AtelierShimmer className="h-3 w-full rounded" />
              <AtelierShimmer className="h-2 w-full rounded-full" />
              <div className="flex justify-between pt-1">
                <AtelierShimmer className="h-8 w-12 rounded" />
                <AtelierShimmer className="h-8 w-12 rounded" />
              </div>
            </div>
          </div>
          <div className="space-y-2.5">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="flex items-center gap-2">
                <AtelierShimmer className="h-2.5 w-2.5 rounded-full shrink-0" />
                <AtelierShimmer className="h-3 flex-1 rounded" />
                <AtelierShimmer className="h-3 w-6 rounded" />
              </div>
            ))}
          </div>
        </div>

        <div className="md:col-span-8 flex flex-col gap-5">
          <div className="flex justify-between items-end">
            <div className="space-y-1">
              <AtelierShimmer className="h-8 w-52 rounded" />
              <AtelierShimmer className="h-4 w-48 rounded" />
            </div>
            <AtelierShimmer className="h-4 w-28 rounded" />
          </div>
          <div className="space-y-2">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="bg-[#f4f3f1] dark:bg-white/5 rounded-xl px-6 py-5 flex items-center justify-between gap-4">
                <div className="flex items-center gap-4 min-w-0">
                  <AtelierShimmer className="h-11 w-11 rounded-xl shrink-0" />
                  <div className="space-y-1.5 min-w-0">
                    <AtelierShimmer className="h-4 w-40 rounded" />
                    <AtelierShimmer className="h-3 w-28 rounded" />
                  </div>
                </div>
                <div className="flex items-center gap-6 shrink-0">
                  <div className="hidden md:block space-y-1 text-right">
                    <AtelierShimmer className="h-2.5 w-12 rounded" />
                    <AtelierShimmer className="h-4 w-20 rounded" />
                  </div>
                  <AtelierShimmer className="h-6 w-20 rounded-full" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
      </div>
    </SkeletonFrame>
  );
}

// ── NestAiSkeleton
export function NestAiSkeleton() {
  return (
    <SkeletonFrame label="Loading NESTAi" className="flex nestai-root nestai-page -mx-4 sm:-mx-6 lg:-mx-8 -mt-6 sm:-mt-8 -mb-36 md:-mb-8">

      <aside className="hidden lg:flex flex-col w-64 border-r nestai-sidebar shrink-0">
        <div className="flex items-center justify-between px-3 py-3 border-b atelier-dropdown-header">
          <AtelierShimmer className="h-5 w-20 rounded" />
          <div className="flex gap-1">
            <AtelierShimmer className="h-7 w-7 rounded" />
            <AtelierShimmer className="h-7 w-7 rounded" />
          </div>
        </div>
        <div className="flex-1 p-2 space-y-1">
          <AtelierShimmer className="h-3 w-12 rounded mb-2 mx-2" />
          {[...Array(6)].map((_, i) => (
            <div key={i} className="flex items-center gap-2 px-2 py-2.5 rounded-lg">
              <AtelierShimmer className="h-3 flex-1 rounded" />
            </div>
          ))}
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">

        <div className="flex items-center justify-between px-4 py-2.5 border-b nestai-topbar">
          <div className="flex items-center gap-2">
            <AtelierShimmer className="h-6 w-6 rounded-full" />
            <AtelierShimmer className="h-4 w-20 rounded" />
          </div>
          <AtelierShimmer className="h-6 w-24 rounded-full" />
        </div>

        <div className="flex-1 flex flex-col items-center justify-center px-6 py-8">
          <div className="w-full max-w-2xl flex flex-col items-center text-center space-y-8">
            <div className="space-y-4 w-full flex flex-col items-center">
              <AtelierShimmer className="h-14 w-72 md:w-96 rounded-lg" />
              <AtelierShimmer className="h-5 w-80 rounded" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 w-full">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="flex flex-col items-start p-5 bg-[#f4f3f1] dark:bg-white/5 rounded-xl space-y-3">
                  <AtelierShimmer className="h-9 w-9 rounded-lg" />
                  <AtelierShimmer className="h-4 w-32 rounded" />
                  <AtelierShimmer className="h-3 w-full rounded" />
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="px-4 pb-4 pt-2 shrink-0">
          <div className="max-w-2xl mx-auto">
            <div className="flex items-center gap-2 rounded-2xl border nestai-input px-3 py-2.5">
              <AtelierShimmer className="h-5 w-5 rounded shrink-0" />
              <AtelierShimmer className="h-5 flex-1 rounded" />
              <AtelierShimmer className="h-8 w-8 rounded-xl shrink-0" />
            </div>
          </div>
        </div>
      </div>
    </SkeletonFrame>
  );
}

// ── ApplicationsSkeleton
export function ApplicationsSkeleton() {
  return (
    <SkeletonFrame label="Loading applications">
      <div className="db-page-header">
        <div className="space-y-2">
          <AtelierShimmer className="h-14 w-56 rounded-lg" />
          <AtelierShimmer className="h-5 w-80 rounded" />
        </div>
        <div className="flex gap-3">
          <AtelierShimmer className="h-10 w-24 rounded-full" />
          <AtelierShimmer className="h-10 w-40 rounded-full" />
        </div>
      </div>

      {/* Filter bar — 2-row on mobile (search / pills+sort), 1-row on lg+ */}
      <div className="bg-[#f4f3f1] dark:bg-white/5 rounded-[0.875rem] p-3 flex flex-col lg:flex-row gap-2 mb-6 border border-[#dbc1b9]/12">
        <AtelierShimmer className="h-10 w-full lg:w-72 rounded-[0.625rem] lg:shrink-0" />
        <div className="flex items-center gap-2 min-w-0 lg:flex-1">
          <div className="flex gap-1.5 flex-1 overflow-hidden">
            {[...Array(4)].map((_, i) => (
              <AtelierShimmer key={i} className="h-8 w-16 rounded-full shrink-0" />
            ))}
          </div>
          <AtelierShimmer className="h-9 w-24 rounded-[0.625rem] shrink-0" />
        </div>
      </div>

      <div className="space-y-4">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="db-app-card relative overflow-hidden pl-5 sm:pl-6">
            <div className="absolute left-0 inset-y-0 w-1.5 rounded-l-xl bg-[#e3e2e0] animate-pulse" />
            <div className="flex items-start gap-5">
              <AtelierShimmer className="h-14 w-14 sm:h-16 sm:w-16 rounded-xl shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="min-w-0 space-y-2 flex-1">
                    <AtelierShimmer className="h-5 w-48 rounded" />
                    <AtelierShimmer className="h-4 w-28 rounded" />
                  </div>
                  <AtelierShimmer className="h-6 w-20 rounded-full shrink-0" />
                </div>
                <div className="flex gap-4">
                  <AtelierShimmer className="h-3.5 w-28 rounded" />
                  <AtelierShimmer className="h-3.5 w-20 rounded hidden sm:block" />
                  <AtelierShimmer className="h-3.5 w-24 rounded hidden sm:block" />
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </SkeletonFrame>
  );
}

// ── ApplicationDetailSkeleton
export function ApplicationDetailSkeleton() {
  return (
    <SkeletonFrame label="Loading application details">
      <div className="flex items-center justify-between mb-8">
        <AtelierShimmer className="h-5 w-32 rounded" />
        <AtelierShimmer className="h-10 w-24 rounded-full" />
      </div>

      <div className="bg-[#f4f3f1] dark:bg-white/5 rounded-2xl p-6 sm:p-8 mb-8">
        <div className="flex flex-col sm:flex-row sm:items-start gap-6">
          <AtelierShimmer className="h-16 w-16 sm:h-20 sm:w-20 rounded-2xl shrink-0" />
          <div className="min-w-0 flex-1 space-y-3">
            <AtelierShimmer className="h-9 w-72 rounded" />
            <AtelierShimmer className="h-6 w-48 rounded" />
            <div className="flex gap-5 pt-1">
              <AtelierShimmer className="h-4 w-36 rounded" />
              <AtelierShimmer className="h-4 w-24 rounded hidden sm:block" />
              <AtelierShimmer className="h-4 w-28 rounded hidden sm:block" />
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <div className="db-content-card">
            <AtelierShimmer className="h-6 w-44 rounded mb-6" />
            <div className="grid sm:grid-cols-2 gap-5">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="space-y-2">
                  <AtelierShimmer className="h-3 w-24 rounded" />
                  <AtelierShimmer className="h-5 w-40 rounded" />
                </div>
              ))}
            </div>
          </div>
          <div className="db-content-card space-y-3">
            <AtelierShimmer className="h-6 w-36 rounded mb-4" />
            {[...Array(2)].map((_, i) => (
              <div key={i} className="flex gap-4">
                <AtelierShimmer className="h-12 w-12 rounded-xl shrink-0" />
                <div className="min-w-0 flex-1 space-y-2">
                  <AtelierShimmer className="h-4 w-52 rounded" />
                  <AtelierShimmer className="h-3 w-36 rounded" />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-6">
          <div className="db-content-card space-y-4">
            <AtelierShimmer className="h-6 w-28 rounded mb-2" />
            <AtelierShimmer className="h-16 w-full rounded-xl" />
            <AtelierShimmer className="h-16 w-full rounded-xl" />
          </div>
          <div className="db-content-card space-y-3">
            <AtelierShimmer className="h-6 w-36 rounded mb-2" />
            {[...Array(4)].map((_, i) => (
              <div key={i} className="flex gap-3">
                <AtelierShimmer className="h-3 w-3 rounded-full mt-1 shrink-0" />
                <AtelierShimmer className="h-4 w-full rounded" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </SkeletonFrame>
  );
}

// ── SalarySkeleton
export function SalarySkeleton() {
  return (
    <SkeletonFrame label="Loading salary comparison" className="space-y-8">
      {/* Header */}
      <div className="db-page-header">
        <div className="space-y-2">
          <AtelierShimmer className="h-10 w-44 rounded-lg" />
          <AtelierShimmer className="h-5 w-80 rounded" />
        </div>
        <AtelierShimmer className="h-9 w-28 rounded-full" />
      </div>

      {/* 4 stat cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="db-content-card space-y-3">
            <div className="flex items-center gap-2">
              <AtelierShimmer className="h-4 w-4 rounded" />
              <AtelierShimmer className="h-3 w-28 rounded" />
            </div>
            <AtelierShimmer className="h-9 w-24 rounded" />
            <AtelierShimmer className="h-3 w-32 rounded" />
          </div>
        ))}
      </div>

      {/* Comparison table */}
      <div className="space-y-3">
        <AtelierShimmer className="h-7 w-48 rounded" />
        <div className="db-content-card overflow-x-auto">
          {/* Table header */}
          <div className="flex gap-4 pb-3 border-b border-[#dbc1b9]/20">
            {["w-48", "w-40", "w-24", "w-20", "w-20", "w-20", "w-20", "w-24", "w-24", "w-20"].map((width, i) => (
              <AtelierShimmer key={i} className={`h-3 ${width} rounded shrink-0`} />
            ))}
          </div>
          {/* Table rows */}
          {[...Array(4)].map((_, i) => (
            <div key={i} className="flex gap-4 py-3 border-b border-[#dbc1b9]/10 last:border-0">
              <AtelierShimmer className="h-4 w-28 rounded shrink-0" />
              <AtelierShimmer className="h-4 w-32 rounded shrink-0" />
              <AtelierShimmer className="h-5 w-16 rounded-full shrink-0" />
              {[...Array(7)].map((__, j) => (
                <AtelierShimmer key={j} className="h-4 w-16 rounded shrink-0" />
              ))}
            </div>
          ))}
        </div>
      </div>
    </SkeletonFrame>
  );
}

// ── ATSSkeleton
export function ATSSkeleton() {
  return (
    <SkeletonFrame label="Loading resume scanner" className="space-y-8">
      {/* Header */}
      <div className="db-page-header">
        <div className="space-y-2">
          <AtelierShimmer className="h-10 w-36 rounded-lg" />
          <AtelierShimmer className="h-5 w-96 rounded" />
        </div>
      </div>

      {/* Two-column scanner layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: document picker + JD textarea */}
        <div className="db-content-card space-y-5">
          <AtelierShimmer className="h-6 w-36 rounded" />
          <AtelierShimmer className="h-10 w-full rounded-lg" />
          <div className="space-y-2">
            <AtelierShimmer className="h-4 w-32 rounded" />
            <AtelierShimmer className="h-40 w-full rounded-xl" />
          </div>
          <AtelierShimmer className="h-10 w-full rounded-full" />
        </div>

        {/* Right: results panel */}
        <div className="db-content-card space-y-5">
          <div className="flex items-center justify-between">
            <AtelierShimmer className="h-6 w-28 rounded" />
            <AtelierShimmer className="h-10 w-10 rounded-full" />
          </div>
          {/* Score ring placeholder */}
          <div className="flex items-center gap-5">
            <AtelierShimmer className="h-24 w-24 rounded-full shrink-0" />
            <div className="min-w-0 flex-1 space-y-3">
              <AtelierShimmer className="h-4 w-32 rounded" />
              <AtelierShimmer className="h-3 w-48 rounded" />
              <AtelierShimmer className="h-3 w-40 rounded" />
            </div>
          </div>
          {/* Keyword rows */}
          <div className="space-y-2">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex items-center gap-3">
                <AtelierShimmer className="h-4 w-4 rounded-full shrink-0" />
                <AtelierShimmer className="h-4 flex-1 rounded" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </SkeletonFrame>
  );
}

// ── DocumentsSkeleton
export function DocumentsSkeleton() {
  return (
    <SkeletonFrame label="Loading documents" className="space-y-6">
      {/* Header */}
      <div className="db-page-header">
        <div className="space-y-2">
          <AtelierShimmer className="h-10 w-48 rounded-lg" />
          <AtelierShimmer className="h-5 w-72 rounded" />
        </div>
        <AtelierShimmer className="h-9 w-28 rounded-full" />
      </div>

      {/* Quota bar */}
      <div className="db-content-card space-y-3">
        <div className="flex items-center justify-between">
          <AtelierShimmer className="h-4 w-40 rounded" />
          <AtelierShimmer className="h-4 w-24 rounded" />
        </div>
        <AtelierShimmer className="h-2 w-full rounded-full" />
      </div>

      {/* Search + filter pills */}
      <div className="flex flex-col sm:flex-row gap-3">
        <AtelierShimmer className="h-10 w-full sm:w-64 rounded-lg shrink-0" />
        <div className="flex gap-2">
          {[...Array(5)].map((_, i) => (
            <AtelierShimmer key={i} className="h-8 w-14 rounded-full shrink-0" />
          ))}
        </div>
      </div>

      {/* Document card grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="db-content-card space-y-3">
            <div className="flex items-start justify-between gap-3">
              <AtelierShimmer className="h-10 w-10 rounded-lg shrink-0" />
              <AtelierShimmer className="h-5 w-12 rounded-full shrink-0" />
            </div>
            <div className="space-y-1.5">
              <AtelierShimmer className="h-4 w-full rounded" />
              <AtelierShimmer className="h-3 w-24 rounded" />
            </div>
            <div className="flex gap-2 pt-1">
              <AtelierShimmer className="h-7 w-16 rounded-full" />
              <AtelierShimmer className="h-7 w-16 rounded-full" />
            </div>
          </div>
        ))}
      </div>
    </SkeletonFrame>
  );
}

// ── PrepSkeleton
export function PrepSkeleton() {
  return <SkeletonFrame label="Loading interview preparation" className="space-y-8">
    <SkeletonHeader actions={0} />
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
      {[0, 1, 2, 3].map((i) => <div key={i} className="db-content-card flex flex-col items-center gap-3 py-5">
        <AtelierShimmer className="h-20 w-20 rounded-full" />
        <AtelierShimmer className="h-6 w-16" />
        <AtelierShimmer className="h-3 w-24" />
      </div>)}
    </div>
    <div className="flex flex-wrap gap-2">
      {Array.from({ length: 6 }, (_, i) => <AtelierShimmer key={i} className="h-9 w-24 rounded-full" />)}
    </div>
    <div className="grid grid-cols-4 gap-3">
      {[0, 1, 2, 3].map((i) => <AtelierShimmer key={i} className="h-20 w-full rounded-xl" />)}
    </div>
    <SkeletonRows count={5} checkbox />
  </SkeletonFrame>;
}
export function NotificationsSkeleton() {
  return (
    <SkeletonFrame label="Loading notifications" className="space-y-6">
      {/* Header */}
      <div className="db-page-header">
        <div className="space-y-2">
          <AtelierShimmer className="h-10 w-44 rounded-lg" />
          <AtelierShimmer className="h-5 w-64 rounded" />
        </div>
        <AtelierShimmer className="h-9 w-24 rounded-full" />
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2">
        {[...Array(3)].map((_, i) => (
          <AtelierShimmer key={i} className="h-8 w-20 rounded-full" />
        ))}
      </div>

      {/* Notification rows */}
      <div className="db-content-card divide-y divide-[#dbc1b9]/15">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="flex items-start gap-4 py-4">
            <AtelierShimmer className="h-9 w-9 rounded-full shrink-0" />
            <div className="flex-1 min-w-0 space-y-1.5">
              <AtelierShimmer className="h-4 w-64 rounded" />
              <AtelierShimmer className="h-3 w-48 rounded" />
              <AtelierShimmer className="h-3 w-24 rounded" />
            </div>
            <AtelierShimmer className="h-2 w-2 rounded-full shrink-0 mt-2" />
          </div>
        ))}
      </div>
    </SkeletonFrame>
  );
}

// ── ProfileSkeleton
export function ProfileSkeleton() {
  return <SkeletonFrame label="Loading profile settings" className="mx-auto max-w-5xl space-y-6">
    <div className="space-y-2">
      <AtelierShimmer className="h-3 w-28" />
      <AtelierShimmer className="h-12 w-64" />
      <AtelierShimmer className="h-4 w-80" />
    </div>
    <div className="flex items-center gap-4 rounded-2xl border bg-card p-5 sm:p-6">
      <AtelierShimmer className="h-16 w-16 shrink-0 rounded-full" />
      <div className="min-w-0 flex-1 space-y-2">
        <AtelierShimmer className="h-5 w-40" />
        <AtelierShimmer className="h-4 w-52" />
      </div>
    </div>
    <div className="grid grid-cols-4 gap-2">
      {[0, 1, 2, 3].map((i) => <AtelierShimmer key={i} className="h-11 w-full rounded-lg" />)}
    </div>
    <div className="space-y-4">
      <AtelierShimmer className="h-7 w-44" />
      {[0, 1].map((i) => <div key={i} className="space-y-4 rounded-xl border bg-card p-5 sm:p-6">
        <AtelierShimmer className="h-4 w-32" />
        <AtelierShimmer className="h-3 w-72" />
        <AtelierShimmer className="h-11 w-full max-w-xl rounded-lg" />
        <AtelierShimmer className="h-10 w-28 rounded-full" />
      </div>)}
    </div>
  </SkeletonFrame>;
}
export function GenericPageSkeleton() {
  return (
    <SkeletonFrame label="Loading page">
      <div className="db-page-header">
        <div className="space-y-2">
          <AtelierShimmer className="h-14 w-52 rounded-lg" />
          <AtelierShimmer className="h-5 w-72 rounded" />
        </div>
        <AtelierShimmer className="h-10 w-36 rounded-full" />
      </div>

      <div className="flex items-center gap-3 mb-5">
        <AtelierShimmer className="h-5 w-5 rounded" />
        <AtelierShimmer className="h-6 w-40 rounded" />
      </div>

      <div className="db-content-card space-y-3">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="flex items-center gap-4 py-2">
            <AtelierShimmer className="h-11 w-11 rounded-xl shrink-0" />
            <div className="min-w-0 flex-1 space-y-1.5">
              <AtelierShimmer className="h-4 w-48 rounded" />
              <AtelierShimmer className="h-3 w-64 rounded" />
            </div>
            <AtelierShimmer className="h-6 w-20 rounded-full shrink-0" />
          </div>
        ))}
      </div>
    </SkeletonFrame>
  );
}

function SkeletonHeader({ actions = 1 }: { actions?: number }) {
  return (
    <div className="db-page-header gap-4">
      <div className="min-w-0 space-y-2">
        <AtelierShimmer className="h-10 w-56 sm:h-14" />
        <AtelierShimmer className="h-5 w-80" />
      </div>
      {actions > 0 && <div className="flex flex-wrap gap-2">
        {Array.from({ length: actions }, (_, i) => <AtelierShimmer key={i} className="h-10 w-28 rounded-full" />)}
      </div>}
    </div>
  );
}

function SkeletonRows({ count = 4, checkbox = false }: { count?: number; checkbox?: boolean }) {
  return (
    <div className="db-content-card space-y-4">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="flex min-w-0 items-start gap-3">
          <AtelierShimmer className={checkbox ? "h-5 w-5 shrink-0" : "h-11 w-11 shrink-0 rounded-xl"} />
          <div className="min-w-0 flex-1 space-y-2">
            <AtelierShimmer className="h-4 w-56" />
            <AtelierShimmer className="h-3 w-40" />
          </div>
          <AtelierShimmer className="hidden h-6 w-20 shrink-0 rounded-full sm:block" />
        </div>
      ))}
    </div>
  );
}

export function ContactsSkeleton() {
  return <SkeletonFrame label="Loading contacts" className="space-y-5">
    <SkeletonHeader />
    <AtelierShimmer className="h-7 w-40" />
    <SkeletonRows count={6} />
  </SkeletonFrame>;
}

export function InterviewsSkeleton() {
  return <SkeletonFrame label="Loading interviews" className="space-y-8">
    <SkeletonHeader actions={0} />
    <div className="space-y-4">
      <AtelierShimmer className="h-8 w-60" />
      {[0, 1, 2].map((i) => <div key={i} className="db-app-card space-y-3">
        <AtelierShimmer className="h-6 w-48" />
        <AtelierShimmer className="h-4 w-64" />
        <div className="flex flex-wrap gap-3">
          <AtelierShimmer className="h-4 w-28" /><AtelierShimmer className="h-4 w-24" />
        </div>
      </div>)}
    </div>
    <AtelierShimmer className="h-8 w-44" />
    <SkeletonRows count={2} />
  </SkeletonFrame>;
}

export function RemindersSkeleton() {
  return <SkeletonFrame label="Loading reminders" className="space-y-6">
    <SkeletonHeader actions={2} />
    {[0, 1, 2].map((i) => <div key={i} className="space-y-4">
      <AtelierShimmer className="h-7 w-40" />
      <SkeletonRows count={i === 0 ? 2 : 3} checkbox />
    </div>)}
  </SkeletonFrame>;
}

export function TemplatesSkeleton() {
  return <SkeletonFrame label="Loading email templates" className="space-y-8">
    <SkeletonHeader actions={2} />
    <div className="db-content-card space-y-3">
      <AtelierShimmer className="h-3 w-36" />
      <div className="flex flex-wrap gap-2">
        {Array.from({ length: 8 }, (_, i) => <AtelierShimmer key={i} className="h-7 w-24 rounded-lg" />)}
      </div>
      <AtelierShimmer className="h-3 w-72" />
    </div>
    {[0, 1].map((i) => <div key={i} className="space-y-4">
      <AtelierShimmer className="h-7 w-40" />
      <SkeletonRows count={3} />
    </div>)}
  </SkeletonFrame>;
}

export function NetworkingSkeleton() {
  return <SkeletonFrame label="Loading networking" className="space-y-6">
    <SkeletonHeader actions={0} />
    <div className="grid grid-cols-3 gap-3">
      {[0, 1, 2].map((i) => <AtelierShimmer key={i} className="h-20 w-full rounded-xl" />)}
    </div>
    <div className="flex gap-2">
      {[0, 1, 2].map((i) => <AtelierShimmer key={i} className="h-10 w-28 rounded-full" />)}
    </div>
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <AtelierShimmer className="h-32 w-full rounded-xl lg:col-span-2" />
      <AtelierShimmer className="hidden h-32 w-full rounded-xl sm:block" />
    </div>
    <div className="flex gap-4 overflow-hidden">
      {[0, 1, 2, 3].map((i) => <div key={i} className="w-[220px] shrink-0 space-y-3">
        <AtelierShimmer className="h-4 w-28" />
        <SkeletonRows count={2} />
      </div>)}
    </div>
  </SkeletonFrame>;
}

export function ApplicationFormSkeleton() {
  return <SkeletonFrame label="Loading application form" className="application-page-shell space-y-4 sm:space-y-6">
    <AtelierShimmer className="h-11 w-40" />
    <div className="db-content-card space-y-6">
      <AtelierShimmer className="h-9 w-56" />
      <AtelierShimmer className="h-24 w-full rounded-xl" />
      <div className="grid gap-5 md:grid-cols-2">
        {Array.from({ length: 6 }, (_, i) => <div key={i} className="min-w-0 space-y-2">
          <AtelierShimmer className="h-4 w-28" />
          <AtelierShimmer className="h-11 w-full rounded-xl" />
        </div>)}
      </div>
      <AtelierShimmer className="h-12 w-full rounded-xl" />
      <div className="flex gap-3">
        <AtelierShimmer className="h-11 w-36 rounded-full" />
        <AtelierShimmer className="h-11 w-24 rounded-full" />
      </div>
    </div>
  </SkeletonFrame>;
}

export function PortfolioSkeleton() {
  return <SkeletonFrame label="Loading portfolio" className="min-h-dvh">
    <div className="border-b border-border">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <AtelierShimmer className="h-5 w-20" /><AtelierShimmer className="h-4 w-24" />
      </div>
    </div>
    <div className="mx-auto max-w-5xl space-y-14 px-4 py-10 sm:px-6 lg:px-8">
      <div className="flex flex-col items-start gap-6 sm:flex-row">
        <AtelierShimmer className="h-24 w-24 shrink-0 rounded-full" />
        <div className="min-w-0 flex-1 space-y-3">
          <AtelierShimmer className="h-9 w-56" />
          <AtelierShimmer className="h-5 w-80" />
          <AtelierShimmer className="h-4 w-60" />
        </div>
      </div>
      {[0, 1].map((i) => <div key={i} className="space-y-5">
        <AtelierShimmer className="h-7 w-40" />
        <div className="grid gap-4 sm:grid-cols-2">
          {[0, 1].map((j) => <div key={j} className="space-y-3 rounded-xl border bg-card p-5">
            <AtelierShimmer className="h-6 w-44" />
            <AtelierShimmer className="h-14 w-full" />
          </div>)}
        </div>
      </div>)}
    </div>
  </SkeletonFrame>;
}

export function CenteredFormSkeleton({ label = "Loading form" }: { label?: string }) {
  return <SkeletonFrame label={label} className="flex min-h-dvh flex-col items-center justify-center gap-8 px-4 py-12">
    <AtelierShimmer className="h-8 w-28" />
    <div className="w-full max-w-xl space-y-5 rounded-2xl border bg-card p-6 sm:p-8">
      <AtelierShimmer className="h-8 w-56" />
      <AtelierShimmer className="h-4 w-full" />
      {[0, 1, 2].map((i) => <AtelierShimmer key={i} className="h-11 w-full rounded-lg" />)}
      <AtelierShimmer className="h-11 w-full rounded-full" />
    </div>
  </SkeletonFrame>;
}
