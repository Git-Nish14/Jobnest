export default function NetworkingLoading() {
  return (
    <main className="db-main">
      {/* Page header skeleton */}
      <div className="db-page-header">
        <div className="space-y-2">
          <div className="h-10 w-48 rounded-lg bg-[#e8ddd8] dark:bg-[#2a1a10] animate-pulse" />
          <div className="h-4 w-80 rounded bg-[#e8ddd8] dark:bg-[#2a1a10] animate-pulse" />
        </div>
      </div>

      {/* Stats strip */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        {[0, 1, 2].map((i) => (
          <div key={i} className="db-content-card py-3 space-y-2 text-center">
            <div className="h-8 w-12 mx-auto rounded bg-[#e8ddd8] dark:bg-[#2a1a10] animate-pulse" />
            <div className="h-3 w-20 mx-auto rounded bg-[#e8ddd8] dark:bg-[#2a1a10] animate-pulse" />
          </div>
        ))}
      </div>

      {/* Tab bar */}
      <div className="db-filter-bar mb-6">
        <div className="db-filter-pills">
          {[96, 80, 112].map((w) => (
            <div
              key={w}
              className="rounded-full bg-[#e8ddd8] dark:bg-[#2a1a10] animate-pulse h-8"
              style={{ width: w }}
            />
          ))}
        </div>
      </div>

      {/* Goal widget + pipeline skeletons */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 mb-8">
        <div className="lg:col-span-2 db-content-card space-y-3">
          <div className="h-4 w-48 rounded bg-[#e8ddd8] dark:bg-[#2a1a10] animate-pulse" />
          <div className="h-2 rounded-full bg-[#e8ddd8] dark:bg-[#2a1a10] animate-pulse" />
          <div className="h-3 w-40 rounded bg-[#e8ddd8] dark:bg-[#2a1a10] animate-pulse" />
        </div>
        <div className="db-content-card space-y-3">
          <div className="h-4 w-32 rounded bg-[#e8ddd8] dark:bg-[#2a1a10] animate-pulse" />
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-3 w-full rounded bg-[#e8ddd8] dark:bg-[#2a1a10] animate-pulse" />
          ))}
        </div>
      </div>

      {/* Pipeline columns */}
      <div className="flex gap-4 overflow-hidden">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="flex flex-col gap-3 w-[220px] flex-shrink-0">
            <div className="h-3 w-28 rounded bg-[#e8ddd8] dark:bg-[#2a1a10] animate-pulse" />
            {[0, 1].map((j) => (
              <div key={j} className="db-content-card space-y-2 py-3">
                <div className="flex gap-2">
                  <div className="h-8 w-8 rounded-full bg-[#e8ddd8] dark:bg-[#2a1a10] animate-pulse flex-shrink-0" />
                  <div className="flex-1 space-y-1.5">
                    <div className="h-3 w-24 rounded bg-[#e8ddd8] dark:bg-[#2a1a10] animate-pulse" />
                    <div className="h-3 w-16 rounded bg-[#e8ddd8] dark:bg-[#2a1a10] animate-pulse" />
                  </div>
                </div>
                <div className="h-7 rounded-lg bg-[#e8ddd8] dark:bg-[#2a1a10] animate-pulse" />
              </div>
            ))}
          </div>
        ))}
      </div>
    </main>
  );
}
