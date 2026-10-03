export default function Loading() {
  return (
    <div className="min-h-screen bg-[var(--bg-primary)]">
      <div className="max-w-5xl mx-auto px-6 md:px-8 py-16 md:py-20 space-y-10">
        {/* Header skeleton */}
        <div className="space-y-4">
          <div className="h-9 w-40 bg-[var(--bg-secondary)] rounded animate-pulse" />
          <div className="flex gap-2">
            <div className="h-6 w-32 bg-[var(--bg-secondary)] rounded-full animate-pulse" />
            <div className="h-6 w-40 bg-[var(--bg-secondary)] rounded-full animate-pulse" />
          </div>
        </div>

        {/* Settings bar skeleton */}
        <div className="flex flex-wrap gap-3">
          <div className="h-9 w-32 bg-[var(--bg-secondary)] rounded animate-pulse" />
          <div className="h-9 w-48 bg-[var(--bg-secondary)] rounded animate-pulse" />
          <div className="h-9 w-96 bg-[var(--bg-secondary)] rounded animate-pulse" />
        </div>

        {/* Tile grid skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-[var(--bg-secondary)] rounded-[var(--radius-lg)] p-5 space-y-3 animate-pulse border border-[var(--border-subtle)]">
              <div className="h-4 w-20 bg-[var(--bg-tertiary)] rounded" />
              <div className="space-y-2.5">
                {[1, 2, 3, 4, 5].map((j) => (
                  <div key={j} className="h-3 w-full bg-[var(--bg-tertiary)] rounded" />
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Alpha banner skeleton */}
        <div className="h-24 bg-[var(--bg-secondary)] rounded-[var(--radius-md)] animate-pulse border border-[var(--border-subtle)]" />

        {/* Chart skeleton */}
        <div>
          <div className="h-4 w-20 bg-[var(--bg-secondary)] rounded mb-3 animate-pulse" />
          <div className="bg-[var(--bg-secondary)] rounded-[var(--radius-lg)] p-6 animate-pulse border border-[var(--border-subtle)]">
            <div className="h-80 bg-[var(--bg-tertiary)] rounded" />
          </div>
        </div>

        {/* Signal card skeleton */}
        <div className="bg-[var(--bg-secondary)] rounded-[var(--radius-lg)] p-6 animate-pulse border border-[var(--border-subtle)]">
          <div className="h-32 bg-[var(--bg-tertiary)] rounded" />
        </div>

        {/* Stats skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {[1, 2].map((i) => (
            <div key={i} className="h-20 bg-[var(--bg-secondary)] rounded-[var(--radius-md)] animate-pulse border border-[var(--border-subtle)]" />
          ))}
        </div>
      </div>
    </div>
  );
}
