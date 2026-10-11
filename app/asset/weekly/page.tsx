import { Metadata } from 'next'
import { FeedError } from '@/components/signals/FeedError'
import { SignalExplorer } from '@/components/signals/SignalExplorer'
import { getFeed } from '@/lib/signals/feed'

export const metadata: Metadata = {
  title: 'Weekly Signals | mlln.ai',
  description: 'Weekly buy signals across all assets, with the indicators behind each one and returns to the latest close.',
}

// The nightly job asks the site to refresh right after it finishes (/api/revalidate), so a page is
// built once per day and served from cache. This longer limit is only a safety net.
export const revalidate = 86400

export default async function Page() {
  try {
    return <SignalExplorer data={await getFeed('weekly')} />
  } catch (e) {
    return <FeedError title="Weekly Buy Signals" message={e instanceof Error ? e.message : String(e)} />
  }
}
