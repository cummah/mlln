interface SkeletonProps {
  className?: string
}

export function Skeleton({ className = '' }: SkeletonProps) {
  return (
    <div
      className={`bg-[var(--bg-secondary)] animate-pulse rounded-md ${className}`}
    />
  )
}
