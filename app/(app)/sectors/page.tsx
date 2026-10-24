import { Metadata } from 'next'
import { getAllSectors } from '@/lib/sectors'
import { getAllSectorStats } from '@/lib/sector-queries'
import { colors, spacing, typography } from '@/lib/designSystem'
import { SectorsDashboard } from '@/components/sectors/SectorsDashboard'

export const metadata: Metadata = {
  title: 'Stock Sectors | Enhanced DCA Analysis',
  description: 'Explore all stock sectors with Smart DCA insights, performance data, and analysis.',
}

export const revalidate = 86400
export const dynamic = 'force-static'

export default async function SectorsPage() {
  const sectorNames = await getAllSectors()
  const sectorStats = await getAllSectorStats(sectorNames)

  return (
    <div style={{ minHeight: '100vh', background: colors.bg }}>
      <div style={{ maxWidth: '1400px', marginLeft: 'auto', marginRight: 'auto', padding: `${spacing['5xl']} ${spacing['4xl']}`, display: 'flex', flexDirection: 'column', gap: spacing['5xl'] }}>
        {/* Header */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.lg }}>
          <h1 style={{ fontSize: '32px', fontWeight: 500, color: colors.text, margin: 0 }}>
            Sector Dashboard
          </h1>
          <p style={{ fontSize: typography.fontSize.lg, color: colors.text2 }}>
            Monitor all sectors at a glance. Compare performance, identify buy zones, and explore assets with strong signals.
          </p>
        </div>

        {/* Dashboard */}
        <SectorsDashboard sectors={sectorStats} />
      </div>
    </div>
  )
}
