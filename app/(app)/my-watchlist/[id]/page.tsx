import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getUserWatchlist } from '@/lib/watchlist'
import { WatchlistView } from '@/components/watchlist/WatchlistView'

export const metadata: Metadata = {
  title: 'Watchlist | mlln.ai',
  description: 'View your custom watchlist signals and performance.',
}

export const revalidate = 3600

export default async function UserWatchlistPage({ params }: { params: { id: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/auth/login')
  }

  // Fetch user watchlist
  const { data: watchlist, error } = await supabase
    .from('user_watchlists')
    .select('id, name, created_at, inception_date, watchlist_assets(ticker)')
    .eq('id', params.id)
    .eq('user_id', user.id)
    .single()

  if (error || !watchlist) {
    notFound()
  }

  const tickers = (watchlist.watchlist_assets || []).map((a: any) => a.ticker)

  if (tickers.length === 0) {
    return (
      <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '40px 20px' }}>
        <h1>{watchlist.name}</h1>
        <p style={{ color: 'var(--text-2)' }}>No assets in this watchlist yet. Edit it on your account page.</p>
      </div>
    )
  }

  // Fetch watchlist data
  const data = await getUserWatchlist(watchlist.id, watchlist.name, tickers, watchlist.inception_date)

  return <WatchlistView data={data} watchlistId={watchlist.id} isCustom />
}
