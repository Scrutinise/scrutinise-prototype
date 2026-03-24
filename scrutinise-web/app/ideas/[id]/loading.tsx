export default function Loading() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      {/* Header skeleton */}
      <div className="mb-6 space-y-3">
        <div className="h-4 w-24 animate-pulse rounded bg-muted" />
        <div className="h-8 w-2/3 animate-pulse rounded bg-muted" />
        <div className="h-4 w-1/2 animate-pulse rounded bg-muted" />
      </div>
      {/* Stage stepper skeleton */}
      <div className="mb-8 flex gap-2">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="h-2 flex-1 animate-pulse rounded-full bg-muted" />
        ))}
      </div>
      {/* Tab skeleton */}
      <div className="flex gap-4 border-b border-border pb-2">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-5 w-20 animate-pulse rounded bg-muted" />
        ))}
      </div>
      {/* Content skeleton */}
      <div className="mt-6 space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-16 animate-pulse rounded-lg bg-muted" />
        ))}
      </div>
    </div>
  )
}
