import type { Metadata } from 'next'
import { getBacktestSummary } from '@/lib/backtest-summary'
import { PortfolioContent } from './PortfolioContent'

export const metadata: Metadata = {
  title: 'Portfolio Builder — DCA vs Alpha | mlln.ai',
  description:
    'Build a multi-asset dollar-cost-averaging portfolio and see how the signal-enhanced Alpha strategy compares to standard DCA over 1, 3, and 5 years.',
}

export const revalidate = 3600

// Diversified across index/growth-tech/blue-chip/commodity/high-volatility so the
// teaser shows a mix of alpha profiles, not five correlated tech names.
const DEFAULT_TICKERS = ['SPY', 'NVDA', 'AAPL', 'GLD', 'TSLA']

// Reads the database with uncached requests, which would otherwise make Next render this page on every visit.
// Rendering once a day instead is enough, because the data only changes after the nightly job, which refreshes it.
export const dynamic = 'force-static'

export default async function PortfolioPage() {
  const summaries = await Promise.all(DEFAULT_TICKERS.map((ticker) => getBacktestSummary(ticker)))
  const initialSummaries = summaries.filter((s): s is NonNullable<typeof s> => s !== null)

  return (
    <div
      className="min-h-screen bg-[var(--bg)]"
      style={{ padding: '14px 18px 24px', maxWidth: '1600px', marginLeft: 'auto', marginRight: 'auto' }}
    >
      {/* Header is a single row so the results start near the top of the
          viewport. The old stacked breadcrumb + 28px h1 + subtitle block cost
          ~150px before any data appeared, and duplicated the breadcrumb the
          topbar already renders. */}
      <header
        style={{
          display: 'flex',
          alignItems: 'baseline',
          justifyContent: 'space-between',
          gap: '14px',
          flexWrap: 'wrap',
          marginBottom: '12px',
        }}
      >
        <h1 style={{ fontSize: '19px', fontWeight: 700, color: 'var(--text)', margin: 0, letterSpacing: '-0.2px' }}>
          Portfolio Builder
        </h1>
        <p style={{ fontSize: '12px', color: 'var(--text-2)', margin: 0, lineHeight: 1.5 }}>
          Set your allocation on the left — Alpha vs standard DCA over 1, 3 and 5 years updates as you go.
        </p>
      </header>

      <PortfolioContent initialTickers={DEFAULT_TICKERS} initialSummaries={initialSummaries} />
    </div>
  )
}
