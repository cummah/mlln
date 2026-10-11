import { Metadata } from 'next'
import { getAllSectors } from '@/lib/sectors'
import { colors, spacing, typography } from '@/lib/designSystem'
import { SectorGrid } from '@/components/sectors/SectorGrid'

export const metadata: Metadata = {
  title: 'Stock Sectors | Enhanced DCA Analysis',
  description: 'Explore all stock sectors with Smart DCA insights, performance data, and analysis.',
}

// Reads the database with uncached requests, which would otherwise make Next render this page on every visit.
// Rendering once a day instead is enough, because the data only changes after the nightly job, which refreshes it.
export const revalidate = 86400
export const dynamic = 'force-static'

export default async function SectorsPage() {
  const sectors = await getAllSectors()

  return (
    <div style={{ minHeight: '100vh', background: colors.bg }}>
      <div style={{ maxWidth: '1200px', marginLeft: 'auto', marginRight: 'auto', padding: `${spacing['5xl']} ${spacing['4xl']}`, display: 'flex', flexDirection: 'column', gap: spacing['5xl'] }}>
        {/* Header */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.lg }}>
          <h1 style={{ fontSize: '32px', fontWeight: 500, color: colors.text, margin: 0 }}>
            Stock Sectors
          </h1>
          <p style={{ fontSize: typography.fontSize.lg, color: colors.text2 }}>
            Analyze sector performance with Smart DCA insights. Explore top performers, oversold opportunities, and buy zone entries.
          </p>
        </div>

        {/* Sectors Grid */}
        <SectorGrid sectors={sectors} />

        {/* Info */}
        <div style={{ marginTop: spacing['5xl'], paddingTop: spacing['4xl'], borderTop: `1px solid ${colors.border}` }}>
          <p style={{ fontSize: typography.fontSize.sm, color: colors.text3, margin: 0 }}>
            {sectors.length} sectors available. Each sector page includes performance rankings,
            oversold opportunities, and Smart DCA buy zone entries.
          </p>
        </div>
      </div>
    </div>
  )
}
