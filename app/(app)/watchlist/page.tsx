import type { Metadata } from 'next'
import { getDemoWatchlist } from '@/lib/watchlist'
import { WatchlistView } from '@/components/watchlist/WatchlistView'

export const metadata: Metadata = {
  title: 'Top 10 Watchlist: What to Buy This Period | mlln.ai',
  description: 'A watchlist of assets with their latest weekly and monthly buy signals, and exactly how much of each to buy this period.',
}

// Built once a day and refreshed by the nightly job (/api/revalidate). If the data cannot be read this throws, so the
// last good page keeps being served and a database outage is never cached as a page of empty or wrong numbers.
export const revalidate = 86400
export const dynamic = 'force-static'

export default async function WatchlistPage() {
  return <WatchlistView data={await getDemoWatchlist()} />
}
