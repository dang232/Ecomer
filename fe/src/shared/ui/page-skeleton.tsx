import { Skeleton } from "./skeleton";

export function PageSkeleton() {
  return (
    <div
      role="status"
      className="grid grid-cols-1 gap-4 p-6 sm:grid-cols-2 lg:grid-cols-4"
      aria-busy="true"
      aria-label="Loading content"
    >
      {["a", "b", "c", "d"].map((id) => (
        <div key={id} className="border border-border bg-card p-3">
          <Skeleton className="mb-3 aspect-square" />
          <Skeleton className="mb-2 h-3 w-3/4" />
          <Skeleton className="mb-2 h-3 w-1/2" />
          <Skeleton className="h-3 w-[30%]" />
        </div>
      ))}
    </div>
  );
}

export function ProductDetailSkeleton() {
  return (
    <div
      role="status"
      className="mx-auto max-w-[1200px] px-[var(--content-padding)] py-8"
      aria-busy="true"
      aria-label="Loading product"
    >
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2 lg:gap-12">
        <div className="space-y-3">
          <Skeleton className="aspect-square border border-border" />
          <div className="flex gap-2">
            {[0, 1, 2, 3].map((index) => (
              <Skeleton key={index} className="h-[72px] w-[72px] shrink-0" />
            ))}
          </div>
        </div>
        <div className="space-y-5">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-8 w-3/4" />
          <Skeleton className="h-10 w-32" />
          <Skeleton className="h-4 w-full" />
          <div className="flex gap-3">
            <Skeleton className="h-12 flex-1" />
            <Skeleton className="h-12 flex-1" />
          </div>
        </div>
      </div>
    </div>
  );
}
