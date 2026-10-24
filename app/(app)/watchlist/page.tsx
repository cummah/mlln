import type { Metadata } from 'next'
import { WATCHLIST_CONFIGS } from '@/lib/watchlist-config'
import { getWatchlist } from '@/lib/watchlist'
import { WatchlistHubPage } from '@/components/watchlist/WatchlistHubPage'

export const metadata: Metadata = {
  title: 'Watchlists | mlln.ai',
  description: 'Curated watchlists: Top 10, AI, Defence, Energy. See what the model buys this period with weekly and monthly buy signals.',
}

export const revalidate = 86400
export const dynamic = 'force-static'

export default async function WatchlistPage() {
  const watchlistsData = await Promise.all(
    WATCHLIST_CONFIGS.map(config => getWatchlist(config.id))
  )

  return <WatchlistHubPage watchlists={WATCHLIST_CONFIGS} data={watchlistsData} />
}
