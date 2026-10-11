import { Metadata } from 'next'
import { FeedError } from '@/components/signals/FeedError'
import { RankTable } from '@/components/rank/RankTable'
import { getRankData } from '@/lib/rank/data'

export const metadata: Metadata = {
  title: 'DCA Rank | mlln.ai',
  description: 'Every asset ranked by DCA suitability score, with standard and enhanced DCA returns over 1, 3 and 5 years.',
}

// Rebuilt by the nightly job, which asks the site to refresh when it finishes (/api/revalidate).
export const revalidate = 86400

export default async function RankPage() {
  try {
    return <RankTable data={await getRankData()} />
  } catch (e) {
    return <FeedError title="DCA Rank" message={e instanceof Error ? e.message : String(e)} />
  }
}
