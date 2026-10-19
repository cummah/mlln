import { Metadata } from 'next'
import { SignalExplorer } from '@/components/signals/SignalExplorer'
import { getFeed } from '@/lib/signals/feed'

export const metadata: Metadata = {
  title: 'Weekly Signals | mlln.ai',
  description: 'Weekly buy signals across all assets, with the indicators behind each one and returns to the latest close.',
}

// The nightly job asks the site to refresh right after it finishes (/api/revalidate), so a page is
// built once per day and served from cache. This longer limit is only a safety net.
export const revalidate = 86400
// The database client asks for uncached reads, which would make Next render this page on every visit and cancel the
// daily cache above. Forcing static rendering keeps it to one build per day, refreshed by /api/revalidate.
export const dynamic = 'force-static';

// If the data cannot be read, this throws instead of rendering. During a daily refresh Next then keeps serving the last good
// page, and at build time the failure is visible, so a database outage can never be cached as a page of wrong or empty numbers.
export default async function Page() {
  return <SignalExplorer data={await getFeed('weekly')} />
}
