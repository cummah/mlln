import { NextRequest, NextResponse } from 'next/server'
import { slugToSector, getAllSectors } from '@/lib/sectors'
import { getTopPerformers, getOversoldAssets, getRecentBuyZoneEntries } from '@/lib/sector-queries'
import {
  getSkeletonLoadersCount,
  getSignalReasoningTruncateChars,
  getRecentSignalsDaysWindow,
  getTableRowsLimit,
} from '@/lib/ui-settings'

export async function GET(
  request: NextRequest,
  { params }: { params: { sector: string } }
) {
  try {
    const sector = params.sector
    const period = (request.nextUrl.searchParams.get('period') || '1M') as '1M' | '3M'
    const signalFrequency = (request.nextUrl.searchParams.get('signalFrequency') || 'weekly') as 'weekly' | 'monthly'

    // Validate sector exists
    const allSectors = await getAllSectors()
    const sectorNames = new Set(allSectors)

    if (!sectorNames.has(slugToSector(sector))) {
      return NextResponse.json({ error: 'Sector not found' }, { status: 404 })
    }

    // Fetch settings and data in parallel
    const [topPerformers, oversold, recentBuyZone, skeletonCount, reasoningTruncate, daysWindow, tableLimit] = await Promise.all([
      getTopPerformers(sector, period),
      getOversoldAssets(sector),
      getRecentBuyZoneEntries(sector, signalFrequency),
      getSkeletonLoadersCount(),
      getSignalReasoningTruncateChars(),
      getRecentSignalsDaysWindow(),
      getTableRowsLimit(),
    ])

    // Create response with settings included
    const response = NextResponse.json({
      topPerformers,
      oversold,
      recentBuyZone,
      settings: {
        skeletonLoadersCount: skeletonCount,
        signalReasoningTruncateChars: reasoningTruncate,
        recentSignalsDaysWindow: daysWindow,
        tableRowsLimit: tableLimit,
      },
      generatedAt: new Date().toISOString(),
    })

    // The data changes once a day, after the nightly job
    response.headers.set('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400')

    return response
  } catch (error) {
    console.error('Error fetching performers:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
