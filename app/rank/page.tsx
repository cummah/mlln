import { Metadata } from 'next'
import { RankTable } from '@/components/rank/RankTable'
import { getRankData } from '@/lib/rank/data'

export const metadata: Metadata = {
  title: 'DCA Rank | mlln.ai',
  description: 'Every asset ranked by DCA suitability score, with standard and enhanced DCA returns over 1, 3 and 5 years.',
}

// Rebuilt by the nightly job, which asks the site to refresh when it finishes (/api/revalidate).
export const revalidate = 86400
// The database client asks for uncached reads, which would make Next render this page on every visit and cancel the
// daily cache above. Forcing static rendering keeps it to one build per day, refreshed by /api/revalidate.
export const dynamic = 'force-static';

// Throws on failure so the last good page keeps being served instead of caching an error page.
export default async function RankPage() {
  return <RankTable data={await getRankData()} />
}
