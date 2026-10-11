import { notFound } from 'next/navigation'
import { Metadata } from 'next'
import dynamic from 'next/dynamic'
import { getAllSectors, sectorToSlug, slugToSector } from '@/lib/sectors'
import { getSectorStats, getSectorAssets } from '@/lib/sector-queries'
import { SectorInsightText } from '@/components/sectors/SectorInsightText'
import { getRelatedSectorsCount, getPeriodsToShow } from '@/lib/ui-settings'
import { colors, spacing, typography, componentStyles } from '@/lib/designSystem'

const SectorBreadcrumb = dynamic(() => import('@/components/sectors/SectorBreadcrumb').then(m => ({ default: m.SectorBreadcrumb })))
const SectorPerformers = dynamic(() => import('@/components/sectors/SectorPerformers').then(m => ({ default: m.SectorPerformers })))
const SectorAssetsTable = dynamic(() => import('@/components/sectors/SectorAssetsTable').then(m => ({ default: m.SectorAssetsTable })))
const RelatedSectorsList = dynamic(() => import('@/components/sectors/RelatedSectorsList').then(m => ({ default: m.RelatedSectorsList })))

// Built once a day and refreshed by the nightly job (/api/revalidate).
export const revalidate = 86400

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

  const [stats, sectorAssets, relatedCount] = await Promise.all([
    getSectorStats(params.sector),
    getSectorAssets(params.sector),
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

          {/* Stats Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: spacing.lg }}>
            <div style={componentStyles.statBox}>
              <div style={componentStyles.statLabel}>Total Assets</div>
              <div style={componentStyles.statValue}>
                {stats.totalAssets}
              </div>
            </div>

            <div style={componentStyles.statBox}>
              <div style={componentStyles.statLabel}>In Buy Zone</div>
              <div style={{ ...componentStyles.statValue, color: colors.green }}>
                {stats.assetsInBuyZone}
              </div>
            </div>

            <div style={componentStyles.statBox}>
              <div style={componentStyles.statLabel}>1M Sector Return</div>
              <div style={{ ...componentStyles.statValue, color: stats.sectorReturn1M === null ? colors.text2 : stats.sectorReturn1M > 0 ? colors.green : colors.red }}>
                {stats.sectorReturn1M === null ? 'n/a' : `${stats.sectorReturn1M > 0 ? '+' : ''}${stats.sectorReturn1M.toFixed(2)}%`}
              </div>
            </div>
          </div>
        </div>

        {/* Insight Text */}
        <div>
          <SectorInsightText sector={params.sector} />
        </div>

        {/* Performers */}
        <div>
          <h2 style={{ fontSize: typography.fontSize['2xl'], fontWeight: 500, color: colors.text, marginBottom: spacing.lg, margin: 0 }}>
            Performance Analysis
          </h2>
          <SectorPerformers sector={params.sector} />
        </div>

        {/* Assets Table */}
        <div>
          <h2 style={{ fontSize: typography.fontSize['2xl'], fontWeight: 500, color: colors.text, marginBottom: spacing.lg, margin: 0 }}>
            All {sectorName} Assets
          </h2>
          <SectorAssetsTable assets={sectorAssets} />
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
