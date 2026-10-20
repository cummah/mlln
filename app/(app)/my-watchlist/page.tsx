import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import MyWatchlistContent from '@/components/watchlist/MyWatchlistContent'

export const metadata: Metadata = {
  title: 'My Watchlist | mlln.ai',
  description: 'Your custom watchlist with personal asset picks and DCA signals.',
}

export const dynamic = 'force-dynamic'

export default async function MyWatchlistPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Get user's profile and tier
  const { data: profile } = await supabase
    .from('profiles')
    .select('tier')
    .eq('user_id', user.id)
    .single()

  // Only tier 1+ can have custom watchlists
  if (!profile || profile.tier < 1) {
    redirect('/watchlist')
  }

  // Get user's watchlists
  const { data: watchlists } = await supabase
    .from('user_watchlists')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  return (
    <div style={{ padding: '14px 18px 24px', maxWidth: '1600px', marginLeft: 'auto', marginRight: 'auto' }}>
      <MyWatchlistContent
        user={user}
        watchlists={watchlists || []}
        tier={profile.tier}
      />
    </div>
  )
}
