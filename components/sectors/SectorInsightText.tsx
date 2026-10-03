import { slugToSector } from '@/lib/sectors'
import { getTopPerformers, getOversoldAssets } from '@/lib/sector-queries'
import { getTopPerformersCount, getTopPerformersExampleCount } from '@/lib/ui-settings'

interface SectorInsightTextProps {
  sector: string
}

export async function SectorInsightText({ sector }: SectorInsightTextProps) {
  const sectorName = slugToSector(sector)

  try {
    const [topPerformers, oversoldAssets, topN, exampleN] = await Promise.all([
      getTopPerformers(sector, '1M'),
      getOversoldAssets(sector),
      getTopPerformersCount(),
      getTopPerformersExampleCount(),
    ])

    if (topPerformers.length === 0) {
      return null
    }

    // Get top N performers (from settings)
    const topPerformersToShow = topPerformers.slice(0, topN)
    const topPerformersText = topPerformersToShow
      .map((p, i) => `${p.ticker} (+${p.dcaReturnPct}% EDCA)`)
      .join(', ')

    // Count assets with positive 1-year Enhanced DCA returns
    const positiveReturns = topPerformers.filter(p => p.dcaReturnPct > 0).length

    // Get buy opportunity assets info
    const buyOpportunitiesCount = oversoldAssets.length
    const buyOpportunitiesTickers =
      oversoldAssets.length > 0
        ? oversoldAssets
            .slice(0, exampleN)
            .map(a => a.ticker)
            .join(' and ')
        : ''

    const text = `The top performing ${sectorName} stocks by Enhanced DCA return over the last month are ${topPerformersText}. ${positiveReturns} of the top ${topPerformers.length} have positive DCA returns. ${buyOpportunitiesCount} assets in the ${sectorName} sector currently have active buy signals${buyOpportunitiesTickers ? `, including ${buyOpportunitiesTickers}` : ''}.`

    return (
      <p className="text-[15px] text-[var(--text-secondary)] leading-relaxed">
        {text}
      </p>
    )
  } catch (error) {
    console.error('Error rendering sector insight text:', error)
    return null
  }
}
