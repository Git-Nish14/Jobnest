export default function ATSLoading() {
  return (
    <div className="space-y-8 animate-pulse">
      <div className="db-page-header">
        <div className="space-y-2">
          <div className="h-8 w-36 rounded-lg bg-muted" />
          <div className="h-4 w-80 rounded bg-muted" />
        </div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="db-content-card h-72" />
        <div className="db-content-card h-72" />
      </div>
    </div>
  );
}
