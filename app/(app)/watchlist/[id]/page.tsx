import type { Metadata } from 'next'
import { getWatchlistConfig, WATCHLIST_CONFIGS } from '@/lib/watchlist-config'
import { getWatchlist } from '@/lib/watchlist'
import { WatchlistView } from '@/components/watchlist/WatchlistView'
import { notFound } from 'next/navigation'

export const revalidate = 86400
export const dynamic = 'force-static'

export function generateStaticParams() {
  return WATCHLIST_CONFIGS.map(w => ({ id: w.id }))
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const config = getWatchlistConfig((await params).id)
  if (!config) return {}
  return {
    title: `${config.name} | mlln.ai`,
    description: config.description,
  }
}

export default async function WatchlistDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const config = getWatchlistConfig(id)
  if (!config) notFound()

  const data = await getWatchlist(id)
  const maxMonths = (id === 'ai' || id === 'etfs' || id === 'defence') ? 10 : undefined
  return <WatchlistView data={data} maxMonths={maxMonths} />
}
