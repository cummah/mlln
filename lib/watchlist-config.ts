// Hardcoded watchlist configurations for the 4 curated watchlists.
// Each watchlist is a snapshot of assets at a specific start date, meant to track a thematic portfolio.

export interface WatchlistConfig {
  id: string // URL-safe slug
  name: string
  description: string
  tickers: string[]
  startDate: string // YYYY-MM-DD
  order: number // Display order on hub
}

export const WATCHLIST_CONFIGS: WatchlistConfig[] = [
  {
    id: 'top-10',
    name: 'Top 10 Watchlist',
    description: 'The ten largest companies at the start of 2026, watched since then. See what the model buys this period, how much of each, and how a monthly plan has done since January against standard DCA and SPY.',
    tickers: ['NVDA', 'AAPL', 'GOOGL', 'MSFT', 'AMZN', 'TSM', 'AVGO', 'META', 'TSLA', 'BRK.A'],
    startDate: '2026-01-01',
    order: 1,
  },
  {
    id: 'ai',
    name: 'AI Watchlist',
    description: 'AI compute leaders and infrastructure plays: from chip makers to foundries, memory, and data-centre operators.',
    tickers: ['NVDA', 'AMD', 'AVGO', 'TSM', 'MU', 'PLTR', 'NBIS', 'IREN', 'APLD', 'VRT'],
    startDate: '2024-10-26',
    order: 2,
  },
  {
    id: 'defence',
    name: 'Defence Watchlist',
    description: 'Space systems, defence primes, and emerging defence tech: satellites, aerospace, electronics, and emerging players.',
    tickers: ['RKLB', 'RDW', 'NOC', 'GD', 'BA', 'VSAT', 'AXON', 'CACI', 'LMT', 'RTX'],
    startDate: '2023-10-26',
    order: 3,
  },
  {
    id: 'etfs',
    name: 'ETF Watchlist',
    description: 'Broad market ETFs: US equity, international, emerging markets, and factor-based strategies.',
    tickers: ['VTI', 'SPY', 'VUG', 'QQQ', 'VXUS', 'EEM', 'VWO', 'FAGIX', 'SCHA', 'VSMAX'],
    startDate: '2023-10-21',
    order: 4,
  },
]

export function getWatchlistConfig(id: string): WatchlistConfig | undefined {
  return WATCHLIST_CONFIGS.find(w => w.id === id)
}

export function getWatchlistConfigByOrder(): WatchlistConfig[] {
  return [...WATCHLIST_CONFIGS].sort((a, b) => a.order - b.order)
}
