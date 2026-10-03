'use client';

import Link from 'next/link';
import { sectorToSlug } from '@/lib/sectors';
import { colors, spacing, typography, styles } from '@/lib/designSystem';

interface SectorGridProps {
  sectors: string[];
}

export function SectorGrid({ sectors }: SectorGridProps) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: spacing.lg }}>
      {sectors.map((sector) => (
        <Link
          key={sector}
          href={`/sectors/${sectorToSlug(sector)}`}
          style={{ textDecoration: 'none' }}
        >
          <div
            style={{
              ...styles.card,
              height: '100%',
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLDivElement).style.borderColor = colors.teal;
              (e.currentTarget as HTMLDivElement).style.background = colors.surface2;
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLDivElement).style.borderColor = colors.border;
              (e.currentTarget as HTMLDivElement).style.background = colors.surface;
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.md }}>
              <h3 style={{ fontSize: typography.fontSize.lg, fontWeight: 600, color: colors.text, margin: 0 }}>
                {sector}
              </h3>
              <p style={{ fontSize: typography.fontSize.sm, color: colors.text3, margin: 0 }}>
                View analysis →
              </p>
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
}
