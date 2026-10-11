import type { BacktestSummary } from './backtest-summary'
import type { Period } from '@/types'

export type Frequency = 'weekly' | 'monthly'

export interface PortfolioAssetInput {
  summary: BacktestSummary
  pct: number // 0-100
}

export interface PortfolioPeriodResult {
  period: Period
  stdInvested: number
  stdValue: number
  stdReturn: number
  enhInvested: number
  enhValue: number
  enhReturn: number
  alpha: number
  perAsset: Array<{ ticker: string; alpha: number }>
  excluded: Array<{ ticker: string; reason: string }>
}

const YEARS_REQUIRED: Record<Period, number> = { '1y': 1, '3y': 3, '5y': 5 }
const MS_PER_YEAR = 365.25 * 24 * 60 * 60 * 1000

// Recently-listed tickers don't have real 3Y/5Y history — same fallback check
// CustomBacktestTiles uses (components/ticker/CustomBacktestTiles.tsx) to avoid
// silently mixing in 1Y-equivalent data as if it were a longer window.
function hasHistoryForPeriod(summary: BacktestSummary, period: Period, frequency: Frequency): boolean {
  // The rebuilt summary says exactly which windows exist. Use that when it is there.
  const available = (summary as { available?: Record<Frequency, Record<Period, boolean>> }).available
  if (available) return available[frequency][period]
  const yearsRequired = YEARS_REQUIRED[period]
  if (yearsRequired <= 1 || !summary.backtest_start_date) return true
  const yearsOfHistory = (Date.now() - new Date(summary.backtest_start_date).getTime()) / MS_PER_YEAR
  return yearsOfHistory >= yearsRequired
}

// The precomputed backtests assume $100/week and $433/month. Those are the same
// annual outlay ($100 x 52/12 = $433.33), so a monthly budget has to be
// converted to a per-week figure before it scales the weekly series. Passing a
// monthly $1,000 straight through modelled $1,000/week — 4.33x the contribution
// of the monthly rows next to it, which made weekly look far better purely
// because it invested more money.
const WEEKS_PER_MONTH = 52 / 12

export function contributionFor(monthlyAmount: number, frequency: Frequency): number {
  return frequency === 'weekly' ? monthlyAmount / WEEKS_PER_MONTH : monthlyAmount
}

// Scales a single asset's precomputed period stats by the actual $ contribution,
// mirroring the linear-scaling trick in CustomBacktestTiles.getRealData: dollar
// fields scale by (actualAmount / baselineAmount), return/alpha percentages don't.
// `amount` is the per-contribution amount for `frequency`, not a monthly budget.
export function scaleAssetPeriod(summary: BacktestSummary, amount: number, frequency: Frequency, period: Period) {
  const getField = (name: string): number => {
    const val = (summary as unknown as Record<string, unknown>)[name]
    return typeof val === 'number' ? val : 0
  }

  if (frequency === 'weekly') {
    const ratio = amount / 100
    return {
      stdInvested: getField(`stdInvested${period}`) * ratio,
      stdValue: getField(`stdValue${period}`) * ratio,
      enhInvested: getField(`enhInvested${period}`) * ratio,
      enhValue: getField(`enhValue${period}`) * ratio,
      alpha: getField(`alpha${period}`),
    }
  }

  const ratio = amount / 433
  return {
    stdInvested: getField(`monthlyStdInvested${period}`) * ratio,
    stdValue: getField(`monthlyStdValue${period}`) * ratio,
    enhInvested: getField(`monthlyEnhInvested${period}`) * ratio,
    enhValue: getField(`monthlyEnhValue${period}`) * ratio,
    alpha: getField(`monthlyAlpha${period}`),
  }
}

// Sums each asset's scaled dollar invested/value across the portfolio (fixed
// allocation, no rebalancing), then recomputes return/alpha from the summed
// dollars — this naturally weights by each asset's actual invested amount
// rather than averaging per-asset percentages.
/** `totalAmount` is the monthly budget; weekly rows convert it internally. */
export function aggregatePortfolio(
  entries: PortfolioAssetInput[],
  totalAmount: number,
  frequency: Frequency,
  period: Period
): PortfolioPeriodResult {
  let stdInvested = 0
  let stdValue = 0
  let enhInvested = 0
  let enhValue = 0
  const perAsset: Array<{ ticker: string; alpha: number }> = []
  const excluded: Array<{ ticker: string; reason: string }> = []

  for (const { summary, pct } of entries) {
    if (!hasHistoryForPeriod(summary, period, frequency)) {
      excluded.push({ ticker: summary.ticker, reason: `no ${period.toUpperCase()} history yet` })
      continue
    }
    const assetAmount = contributionFor(totalAmount, frequency) * (pct / 100)
    const scaled = scaleAssetPeriod(summary, assetAmount, frequency, period)
    stdInvested += scaled.stdInvested
    stdValue += scaled.stdValue
    enhInvested += scaled.enhInvested
    enhValue += scaled.enhValue
    perAsset.push({ ticker: summary.ticker, alpha: scaled.alpha })
  }

  const stdReturn = stdInvested > 0 ? ((stdValue - stdInvested) / stdInvested) * 100 : 0
  const enhReturn = enhInvested > 0 ? ((enhValue - enhInvested) / enhInvested) * 100 : 0

  return {
    period,
    stdInvested,
    stdValue,
    stdReturn,
    enhInvested,
    enhValue,
    enhReturn,
    alpha: enhReturn - stdReturn,
    perAsset: perAsset.sort((a, b) => b.alpha - a.alpha),
    excluded,
  }
}
