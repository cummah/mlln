'use client';

import Link from 'next/link';
import { colors, spacing, typography } from '@/lib/designSystem';

interface SectorBreadcrumbProps {
  sectorName: string;
}

export function SectorBreadcrumb({ sectorName }: SectorBreadcrumbProps) {
  return (
    <nav style={{ fontSize: typography.fontSize.sm, color: colors.text2, display: 'flex', alignItems: 'center', gap: spacing.md }}>
      <Link
        href="/"
        style={{ color: colors.text2, textDecoration: 'none', cursor: 'pointer', transition: 'color 0.2s' }}
        onMouseEnter={(e) => (e.currentTarget as HTMLAnchorElement).style.color = colors.text}
        onMouseLeave={(e) => (e.currentTarget as HTMLAnchorElement).style.color = colors.text2}
      >
        Home
      </Link>
      <span>→</span>
      <Link
        href="/sectors"
        style={{ color: colors.text2, textDecoration: 'none', cursor: 'pointer', transition: 'color 0.2s' }}
        onMouseEnter={(e) => (e.currentTarget as HTMLAnchorElement).style.color = colors.text}
        onMouseLeave={(e) => (e.currentTarget as HTMLAnchorElement).style.color = colors.text2}
      >
        Sectors
      </Link>
      <span>→</span>
      <span style={{ color: colors.text }}>{sectorName}</span>
    </nav>
  );
}
