export function PageSkeleton() {
  return (
    <div
      className="grid grid-cols-4 gap-4 p-6"
      aria-busy="true"
      aria-label="Loading content"
    >
      {(["a", "b", "c", "d"] as const).map((id) => (
        <div
          key={id}
          className="bg-card border border-border rounded-[var(--radius-lg)] p-3"
        >
          <div className="aspect-square rounded-[var(--radius-md)] bg-surface-elevated animate-pulse mb-3" />
          <div className="h-3 rounded-md bg-surface-elevated animate-pulse mb-2 w-3/4" />
          <div className="h-3 rounded-md bg-surface-elevated animate-pulse mb-2 w-1/2" />
          <div className="h-3 rounded-md bg-surface-elevated animate-pulse w-[30%]" />
        </div>
      ))}
    </div>
  );
}

export function ProductDetailSkeleton() {
  return (
    <div className="max-w-[1200px] mx-auto py-8 px-[var(--content-padding)]">
      {/* Two-column grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
        {/* Left Column — Gallery placeholder */}
        <div className="lg:sticky lg:top-[80px] self-start space-y-3">
          <div className="aspect-square bg-surface-elevated rounded-[var(--radius-xl)] border border-border animate-pulse" />
          <div className="flex gap-2 overflow-x-auto pb-1">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="shrink-0 w-[72px] h-[72px] rounded-[var(--radius-md)] bg-surface-elevated animate-pulse" />
            ))}
          </div>
        </div>

        {/* Right Column — Product Info placeholder */}
        <div className="space-y-5">
          {/* Brand / category */}
          <div>
            <div className="h-4 bg-surface-elevated rounded w-20 animate-pulse" />
            <div className="h-8 bg-surface-elevated rounded w-3/4 mt-2 animate-pulse" />
            <div className="flex items-center gap-2 mt-2">
              <div className="h-4 bg-surface-elevated rounded w-24 animate-pulse" />
              <div className="h-4 bg-surface-elevated rounded w-16 animate-pulse" />
            </div>
          </div>

          {/* Price block */}
          <div className="flex items-end gap-2">
            <div className="h-10 bg-surface-elevated rounded w-32 animate-pulse" />
            <div className="h-6 bg-surface-elevated rounded w-20 animate-pulse" />
          </div>

          {/* Colors selector placeholder */}
          <div>
            <div className="h-4 bg-surface-elevated rounded w-24 mb-2 animate-pulse" />
            <div className="flex flex-wrap gap-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-9 bg-surface-elevated rounded w-20 animate-pulse" />
              ))}
            </div>
          </div>

          {/* Sizes selector placeholder */}
          <div>
            <div className="h-4 bg-surface-elevated rounded w-20 mb-2 animate-pulse" />
            <div className="flex flex-wrap gap-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-9 bg-surface-elevated rounded w-16 animate-pulse" />
              ))}
            </div>
          </div>

          {/* Quantity placeholder */}
          <div>
            <div className="h-4 bg-surface-elevated rounded w-24 mb-2 animate-pulse" />
            <div className="flex items-center gap-3">
              <div className="flex items-center border border-border rounded-[var(--radius-md)] overflow-hidden">
                <div className="w-10 h-10 bg-surface-elevated animate-pulse" />
                <div className="w-12 h-10 bg-surface-elevated animate-pulse" />
                <div className="w-10 h-10 bg-surface-elevated animate-pulse" />
              </div>
            </div>
          </div>

          {/* Action buttons placeholder */}
          <div className="flex gap-3">
            <div className="flex-1 h-14 bg-surface-elevated rounded-[var(--radius-lg)] animate-pulse" />
            <div className="flex-1 h-14 bg-surface-elevated rounded-[var(--radius-lg)] animate-pulse" />
            <div className="w-12 h-14 bg-surface-elevated rounded-[var(--radius-lg)] animate-pulse" />
          </div>

          {/* Trust row placeholder */}
          <div className="flex gap-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-5 bg-surface-elevated rounded w-32 animate-pulse" />
            ))}
          </div>
        </div>
      </div>

      {/* Seller placeholder */}
      <div className="mt-8 bg-card rounded-[var(--radius-xl)] p-5 border border-border animate-pulse">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-[var(--radius-lg)] bg-surface-elevated" />
          <div className="flex-1 space-y-2">
            <div className="h-4 bg-surface-elevated rounded w-32" />
            <div className="h-3 bg-surface-elevated rounded w-24" />
          </div>
        </div>
      </div>
    </div>
  );
}
