import Link from 'next/link'
import { sectorToSlug } from '@/lib/sectors'

interface SectorLinkProps {
  sector: string
  className?: string
}

export function SectorLink({ sector, className = '' }: SectorLinkProps) {
  return (
    <Link
      href={`/sectors/${sectorToSlug(sector)}`}
      className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[var(--bg-secondary)] hover:bg-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors text-sm font-medium ${className}`}
    >
      <span>{sector}</span>
      <span className="text-xs text-[var(--text-tertiary)]">→</span>
    </Link>
  )
}
