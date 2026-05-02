export default function PrepLoading() {
  return (
    <div className="animate-pulse space-y-8">
      <div className="h-12 w-64 bg-[#e9e8e6] rounded-xl" />
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="db-skel-panel db-skel-stat rounded-2xl" />
        ))}
      </div>
      <div className="db-skel-panel h-96 rounded-2xl" />
    </div>
  );
}
