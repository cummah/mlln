import { notFound } from 'next/navigation'
import { Metadata } from 'next'
import nextDynamic from 'next/dynamic'
import { getAllSectors, sectorToSlug, slugToSector } from '@/lib/sectors'
import { getSectorStats } from '@/lib/sector-queries'
import { SectorStatTiles } from '@/components/sectors/SectorStatTiles'
import { SectorInsightText } from '@/components/sectors/SectorInsightText'
import { getRelatedSectorsCount, getPeriodsToShow } from '@/lib/ui-settings'
import { colors, spacing, typography, componentStyles } from '@/lib/designSystem'

const SectorBreadcrumb = nextDynamic(() => import('@/components/sectors/SectorBreadcrumb').then(m => ({ default: m.SectorBreadcrumb })))
const SectorSignalsTable = nextDynamic(() => import('@/components/sectors/SectorSignalsTable').then(m => ({ default: m.SectorSignalsTable })))
const RelatedSectorsList = nextDynamic(() => import('@/components/sectors/RelatedSectorsList').then(m => ({ default: m.RelatedSectorsList })))

// Render on-demand to avoid build timeouts
export const dynamic = 'force-dynamic'

interface PageProps {
  params: {
    sector: string
  }
}

export async function generateStaticParams() {
  const sectors = await getAllSectors()
  return sectors.map((sector) => ({
    sector: sectorToSlug(sector),
  }))
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const sectorName = slugToSector(params.sector)
  const sectors = await getAllSectors()

  if (!sectors.includes(sectorName)) {
    return { title: 'Not Found' }
  }

  return {
    title: `${sectorName} Stocks | Enhanced DCA Analysis`,
    description: `Analyze ${sectorName} stocks with Smart DCA insights. See top performers, oversold opportunities, and sector statistics.`,
  }
}

export default async function SectorPage({ params }: PageProps) {
  const sectorName = slugToSector(params.sector)
  const sectors = await getAllSectors()

  if (!sectors.includes(sectorName)) {
    notFound()
  }

  const [stats, relatedCount] = await Promise.all([
    getSectorStats(params.sector),
    getRelatedSectorsCount(),
  ])

  // Get related sectors (exclude current)
  const relatedSectors = sectors
    .filter((s) => s !== sectorName)
    .slice(0, relatedCount)

  return (
    <div style={{ minHeight: '100vh', background: colors.bg }} suppressHydrationWarning>
      <div style={{ maxWidth: '1200px', marginLeft: 'auto', marginRight: 'auto', padding: `${spacing['5xl']} ${spacing['4xl']}`, display: 'flex', flexDirection: 'column', gap: spacing['5xl'] }}>
        {/* Breadcrumb */}
        <SectorBreadcrumb sectorName={sectorName} />

        {/* Hero */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.xl }}>
          <div>
            <h1 style={{ fontSize: '32px', fontWeight: 500, color: colors.text, marginBottom: spacing.md, margin: 0 }}>
              {sectorName}
            </h1>
            <p style={{ fontSize: typography.fontSize.lg, color: colors.text2, margin: 0 }}>
              Smart DCA analysis and insights for {sectorName} stocks
            </p>
          </div>

          <SectorStatTiles stats={stats} />
        </div>

        {/* Insight Text */}
        <div>
          <SectorInsightText sector={params.sector} />
        </div>

        {/* Signals */}
        <div>
          <h2 style={{ fontSize: typography.fontSize['2xl'], fontWeight: 500, color: colors.text, marginBottom: spacing.lg, margin: 0 }}>
            {sectorName} Signals
          </h2>
          <SectorSignalsTable sector={params.sector} />
        </div>

        {/* Related Sectors */}
        <div>
          <h2 style={{ fontSize: typography.fontSize['2xl'], fontWeight: 500, color: colors.text, marginBottom: spacing.lg, margin: 0 }}>
            Explore Other Sectors
          </h2>
          <RelatedSectorsList sectors={relatedSectors} />
        </div>
      </div>
    </div>
  )
}
