import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import MyPortfolioContent from '@/components/portfolio/MyPortfolioContent'

export const metadata: Metadata = {
  title: 'My Portfolios | mlln.ai',
  description: 'Your saved portfolio allocations with performance tracking.',
}

export const dynamic = 'force-dynamic'

export default async function MyPortfolioPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Get user's profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('tier')
    .eq('user_id', user.id)
    .single()

  if (!profile) {
    redirect('/account')
  }

  // Get user's portfolios
  const { data: portfolios } = await supabase
    .from('user_portfolios')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  return (
    <div style={{ padding: '14px 18px 24px', maxWidth: '1600px', marginLeft: 'auto', marginRight: 'auto' }}>
      <MyPortfolioContent
        user={user}
        portfolios={portfolios || []}
        tier={profile.tier}
      />
    </div>
  )
}
