import { Skeleton } from "@/components/ui/skeleton";

function AtelierShimmer({ className }: { className?: string }) {
  return <Skeleton className={`bg-[#e3e2e0] ${className ?? ""}`} />;
}

// Skeleton bar heights as Tailwind arbitrary classes (static, no inline styles)
const SKEL_BAR_HEIGHTS = ["h-[40%]", "h-[65%]", "h-[90%]", "h-[55%]", "h-[75%]", "h-[45%]", "h-[60%]"] as const;
const SKEL_STAT_BG = ["bg-[#f4f3f1]", "bg-[#e9e8e6]", "bg-[#ffdbd0]/40"] as const;

// ── DashboardSkeleton
export function DashboardSkeleton() {
  return (
    <div className="space-y-8">

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
              <div key={i} className={`flex-1 bg-[#e9e8e6] animate-pulse rounded-t ${h}`} />
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
                <div className="flex-1 space-y-1.5">
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
            <div className="flex-1 space-y-3">
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
              <div key={i} className="bg-[#f4f3f1] rounded-xl px-6 py-5 flex items-center justify-between gap-4">
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
  );
}

// ── NestAiSkeleton
export function NestAiSkeleton() {
  return (
    <div className="flex nestai-root nestai-page -mx-4 sm:-mx-6 lg:-mx-8 -mt-6 sm:-mt-8 -mb-36 md:-mb-8">

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
                <div key={i} className="flex flex-col items-start p-5 bg-[#f4f3f1] rounded-xl space-y-3">
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
    </div>
  );
}

// ── ApplicationsSkeleton
export function ApplicationsSkeleton() {
  return (
    <div>
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
      <div className="bg-[#f4f3f1] rounded-[0.875rem] p-3 flex flex-col lg:flex-row gap-2 mb-6 border border-[#dbc1b9]/12">
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
                  <div className="space-y-2 flex-1">
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
    </div>
  );
}

// ── ApplicationDetailSkeleton
export function ApplicationDetailSkeleton() {
  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <AtelierShimmer className="h-5 w-32 rounded" />
        <AtelierShimmer className="h-10 w-24 rounded-full" />
      </div>

      <div className="bg-[#f4f3f1] rounded-2xl p-6 sm:p-8 mb-8">
        <div className="flex flex-col sm:flex-row sm:items-start gap-6">
          <AtelierShimmer className="h-16 w-16 sm:h-20 sm:w-20 rounded-2xl shrink-0" />
          <div className="flex-1 space-y-3">
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
                <div className="flex-1 space-y-2">
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
    </div>
  );
}

// ── SalarySkeleton
export function SalarySkeleton() {
  return (
    <div className="space-y-8">
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
        <div className="db-content-card">
          {/* Table header */}
          <div className="flex gap-4 pb-3 border-b border-[#dbc1b9]/20">
            {[48, 40, 24, 20, 20, 20, 20, 24, 24, 20].map((w, i) => (
              <AtelierShimmer key={i} className={`h-3 w-${w} rounded shrink-0`} />
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
    </div>
  );
}

// ── ATSSkeleton
export function ATSSkeleton() {
  return (
    <div className="space-y-8">
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
            <div className="flex-1 space-y-3">
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
    </div>
  );
}

// ── DocumentsSkeleton
export function DocumentsSkeleton() {
  return (
    <div className="space-y-6">
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
    </div>
  );
}

// ── PrepSkeleton
export function PrepSkeleton() {
  return (
    <div className="space-y-8">
      {/* Header with 4 rings */}
      <div className="db-content-card">
        <div className="flex flex-col sm:flex-row sm:items-center gap-6">
          <div className="space-y-2">
            <AtelierShimmer className="h-10 w-52 rounded-lg" />
            <AtelierShimmer className="h-5 w-64 rounded" />
          </div>
          <div className="flex gap-6 sm:ml-auto">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="flex flex-col items-center gap-2">
                <AtelierShimmer className="h-16 w-16 rounded-full" />
                <AtelierShimmer className="h-3 w-16 rounded" />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 border-b border-[#dbc1b9]/30 pb-px">
        {[...Array(4)].map((_, i) => (
          <AtelierShimmer key={i} className="h-9 w-28 rounded-t-lg" />
        ))}
      </div>

      {/* Tab content */}
      <div className="db-content-card space-y-4">
        <div className="flex items-center justify-between">
          <AtelierShimmer className="h-6 w-44 rounded" />
          <AtelierShimmer className="h-9 w-28 rounded-full" />
        </div>
        {[...Array(5)].map((_, i) => (
          <div key={i} className="flex items-center gap-4 py-2 border-b border-[#dbc1b9]/10 last:border-0">
            <AtelierShimmer className="h-5 w-5 rounded shrink-0" />
            <div className="flex-1 space-y-1">
              <AtelierShimmer className="h-4 w-64 rounded" />
              <AtelierShimmer className="h-3 w-40 rounded" />
            </div>
            <AtelierShimmer className="h-6 w-16 rounded-full shrink-0" />
          </div>
        ))}
      </div>
    </div>
  );
}

// ── NotificationsSkeleton
export function NotificationsSkeleton() {
  return (
    <div className="space-y-6">
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
    </div>
  );
}

// ── ProfileSkeleton
export function ProfileSkeleton() {
  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="space-y-2">
        <AtelierShimmer className="h-10 w-28 rounded-lg" />
        <AtelierShimmer className="h-5 w-60 rounded" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Sidebar */}
        <div className="lg:col-span-1 space-y-4">
          <div className="db-content-card space-y-4">
            <AtelierShimmer className="h-16 w-16 rounded-full mx-auto" />
            <div className="space-y-2 text-center">
              <AtelierShimmer className="h-5 w-32 rounded mx-auto" />
              <AtelierShimmer className="h-3 w-40 rounded mx-auto" />
              <AtelierShimmer className="h-5 w-16 rounded-full mx-auto" />
            </div>
          </div>
          <div className="db-content-card space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex items-center gap-2.5">
                <AtelierShimmer className="h-4 w-4 rounded shrink-0" />
                <AtelierShimmer className="h-3 w-28 rounded" />
              </div>
            ))}
          </div>
        </div>

        {/* Main settings column */}
        <div className="lg:col-span-3 space-y-5">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="db-content-card space-y-4">
              <div className="flex items-center gap-3 pb-4 border-b border-[#dbc1b9]/20">
                <AtelierShimmer className="h-8 w-8 rounded-lg shrink-0" />
                <AtelierShimmer className="h-5 w-36 rounded" />
              </div>
              <div className="space-y-3">
                {[...Array(i === 2 ? 2 : 1)].map((__, j) => (
                  <div key={j} className="space-y-1.5">
                    <AtelierShimmer className="h-3 w-24 rounded" />
                    <AtelierShimmer className="h-10 w-full rounded-lg" />
                  </div>
                ))}
              </div>
              <AtelierShimmer className="h-9 w-28 rounded-full mt-2" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── GenericPageSkeleton
export function GenericPageSkeleton() {
  return (
    <div>
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
            <div className="flex-1 space-y-1.5">
              <AtelierShimmer className="h-4 w-48 rounded" />
              <AtelierShimmer className="h-3 w-64 rounded" />
            </div>
            <AtelierShimmer className="h-6 w-20 rounded-full shrink-0" />
          </div>
        ))}
      </div>
    </div>
  );
}
