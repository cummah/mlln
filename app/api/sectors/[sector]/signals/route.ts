import { NextRequest, NextResponse } from 'next/server'
import { slugToSector, getAllSectors } from '@/lib/sectors'
import { getRecentBuyZoneEntries } from '@/lib/sector-queries'
import { getSkeletonLoadersCount, getTableRowsLimit } from '@/lib/ui-settings'

export async function GET(
  _request: NextRequest,
  { params }: { params: { sector: string } }
) {
  try {
    const sector = params.sector
    const sectorNames = new Set(await getAllSectors())
    if (!sectorNames.has(slugToSector(sector))) {
      return NextResponse.json({ error: 'Sector not found' }, { status: 404 })
    }

    const [weekly, monthly, skeletonLoadersCount, tableRowsLimit] = await Promise.all([
      getRecentBuyZoneEntries(sector, 'weekly'),
      getRecentBuyZoneEntries(sector, 'monthly'),
      getSkeletonLoadersCount(),
      getTableRowsLimit(),
    ])

    const response = NextResponse.json({
      weekly,
      monthly,
      settings: { skeletonLoadersCount, tableRowsLimit },
      generatedAt: new Date().toISOString(),
    })
    // The data changes once a day, after the nightly job
    response.headers.set('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400')
    return response
  } catch (error) {
    console.error('Error fetching sector signals:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
