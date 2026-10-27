import { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { isAdmin } from '@/lib/entitlements'
import { SignalExplorer } from '@/components/signals/SignalExplorer'
import { getFeed } from '@/lib/signals/feed'

export const metadata: Metadata = {
  title: 'Daily Signals | mlln.ai',
  description: 'Daily buy signals across all assets, with the indicators behind each one and returns to the latest close.',
}

// Render on-demand to avoid build timeouts. Cached by browser/CDN.
export const dynamic = 'force-dynamic';

// If the data cannot be read, this throws instead of rendering. During a daily refresh Next then keeps serving the last good
// page, and at build time the failure is visible, so a database outage can never be cached as a page of wrong or empty numbers.
export default async function Page() {
  const admin = await isAdmin();

  if (!admin) {
    redirect('/');
  }

  return <SignalExplorer data={await getFeed('daily')} />
}
