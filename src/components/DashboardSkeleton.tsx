export function DashboardSkeleton() {
  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, idx) => (
          <div key={idx} className="h-28 animate-pulse rounded-2xl bg-slate-200" />
        ))}
      </div>
      <div className="h-16 animate-pulse rounded-xl bg-slate-200" />
      <div className="h-80 animate-pulse rounded-2xl bg-slate-200" />
    </div>
  );
}
