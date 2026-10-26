import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { MyWatchlistCard } from '@/components/watchlist/MyWatchlistCard'

export const metadata: Metadata = {
  title: 'My Watchlists | mlln.ai',
  description: 'Your custom watchlists built from your portfolio assets.',
}

export const revalidate = 3600

export default async function MyWatchlistsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/auth/login')
  }

  const { data: watchlists, error } = await supabase
    .from('user_watchlists')
    .select('id, name, created_at, watchlist_assets(ticker)')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Failed to fetch watchlists:', error)
  }

  const userWatchlists = watchlists || []

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '40px 20px' }}>
      <div style={{ marginBottom: '40px' }}>
        <h1 style={{ margin: '0 0 12px 0', fontSize: '32px', fontWeight: '700' }}>My Watchlists</h1>
        <p style={{ margin: '0 0 12px 0', fontSize: '16px', color: 'var(--text-2)', lineHeight: '1.6', maxWidth: '720px' }}>
          Custom watchlists built from your portfolio. Track signals and performance for assets you care about.
        </p>
        <p style={{ margin: '0', fontSize: '14px', color: 'var(--text-3)', maxWidth: '720px' }}>
          Create a new watchlist from your portfolio on the <Link href="/portfolio" style={{ color: 'var(--teal)', textDecoration: 'underline' }}>Portfolio Builder</Link>.
        </p>
      </div>

      {userWatchlists.length === 0 ? (
        <div
          style={{
            background: 'var(--surface-elevated)',
            border: '1px solid var(--border-elevated)',
            borderRadius: '14px',
            padding: '40px',
            textAlign: 'center',
          }}
        >
          <p style={{ fontSize: '18px', color: 'var(--text-2)', marginBottom: '16px' }}>No custom watchlists yet</p>
          <p style={{ fontSize: '14px', color: 'var(--text-3)', marginBottom: '24px', maxWidth: '400px', margin: 'auto' }}>
            Create your first watchlist from your portfolio to start tracking signals and performance.
          </p>
          <Link
            href="/portfolio"
            style={{
              display: 'inline-block',
              padding: '12px 24px',
              background: 'var(--teal)',
              color: '#040e18',
              borderRadius: '8px',
              textDecoration: 'none',
              fontWeight: '600',
              fontSize: '14px',
            }}
          >
            Go to Portfolio Builder
          </Link>
        </div>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
            gap: '24px',
          }}
        >
          {userWatchlists.map((wl: any) => (
            <MyWatchlistCard
              key={wl.id}
              id={wl.id}
              name={wl.name}
              assetCount={wl.watchlist_assets?.length || 0}
              createdAt={wl.created_at}
            />
          ))}
        </div>
      )}
    </div>
  )
}
