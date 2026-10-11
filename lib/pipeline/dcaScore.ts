// DCA suitability score, 1 to 100. The formula is unchanged from the previous pipeline: it ranks how
// well the enhanced strategy did on this ticker, against every other ticker. It is a backward looking
// measure of past fit, not a forecast.

export interface ScoreRow {
  ticker: string
  alpha_1m: number | null
  alpha_3m: number | null
  alpha_1y: number | null
  alpha_3y: number | null
  alpha_5y: number | null
  monthly_alpha_1y: number | null
  monthly_alpha_3y: number | null
  monthly_alpha_5y: number | null
  enh_return_1y: number | null
  enh_return_3y: number | null
  enh_return_5y: number | null
  enh_avg_entry_5y: number | null
  std_avg_entry_5y: number | null
  enh_value_5y: number | null
  enh_invested_5y: number | null
  std_value_5y: number | null
  std_invested_5y: number | null
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))

/** Share of the sorted universe strictly below the value, in 0 to 1. */
function rank(sortedAsc: number[], value: number): number {
  let lo = 0, hi = sortedAsc.length
  while (lo < hi) { const mid = (lo + hi) >> 1; if (sortedAsc[mid] < value) lo = mid + 1; else hi = mid }
  return sortedAsc.length ? lo / sortedAsc.length : 0
}

const avgOf = (vals: (number | null)[]) => {
  const v = vals.filter((x): x is number => x != null)
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null
}

export function computeScores(rows: ScoreRow[]): Map<string, number> {
  const sort = (xs: number[]) => [...xs].sort((a, b) => a - b)

  // Universe distributions, sorted once
  const longAlpha = sort(rows.map(r => avgOf([r.alpha_1y, r.alpha_3y, r.alpha_5y]) ?? 0))
  const ret5 = sort(rows.map(r => r.enh_return_5y ?? 0))
  const ret3 = sort(rows.map(r => r.enh_return_3y ?? 0))
  const ret1 = sort(rows.map(r => r.enh_return_1y ?? 0))
  const discountOf = (r: ScoreRow) => r.enh_avg_entry_5y != null && r.std_avg_entry_5y != null && r.std_avg_entry_5y > 0
    ? ((r.std_avg_entry_5y - r.enh_avg_entry_5y) / r.std_avg_entry_5y) * 100 : null
  const discounts = sort(rows.map(discountOf).filter((x): x is number => x !== null))
  const effOf = (r: ScoreRow) => r.enh_value_5y != null && r.enh_invested_5y != null && r.enh_invested_5y > 0 &&
    r.std_value_5y != null && r.std_invested_5y != null && r.std_invested_5y > 0
    ? (r.enh_value_5y / r.enh_invested_5y) / (r.std_value_5y / r.std_invested_5y) : null
  const ratios = sort(rows.map(effOf).filter((x): x is number => x !== null))

  const out = new Map<string, number>()
  for (const r of rows) {
    let score = 0

    // 1. Alpha consistency, 35 points
    const avgAlpha = avgOf([r.alpha_1y, r.alpha_3y, r.alpha_5y])
    if (avgAlpha != null && avgAlpha > 0) score += clamp(rank(longAlpha, avgAlpha) * 20, 0, 20)
    score += [r.alpha_1m, r.alpha_3m, r.alpha_1y, r.alpha_3y, r.alpha_5y].filter(v => v != null && v > 0).length * 3

    // 2. Absolute profitability, 25 points
    if (r.enh_return_5y != null && r.enh_return_5y < 0) {
      score += 5
    } else {
      if (r.enh_return_5y != null && r.enh_return_5y > 0) score += clamp(rank(ret5, r.enh_return_5y) * 12, 0, 12)
      if (r.enh_return_3y != null && r.enh_return_3y > 0) score += clamp(rank(ret3, r.enh_return_3y) * 8, 0, 8)
      if (r.enh_return_1y != null && r.enh_return_1y > 0) score += clamp(rank(ret1, r.enh_return_1y) * 5, 0, 5)
    }

    // 3. Capital efficiency, 20 points
    const disc = discountOf(r)
    if (disc != null && disc > 0) score += clamp(rank(discounts, disc) * 12, 0, 12)
    const eff = effOf(r)
    if (eff != null && eff > 1) score += clamp(rank(ratios, eff) * 8, 0, 8)

    // 4. Short term defence, 10 points
    if (r.alpha_1m != null && r.alpha_1m > 0) score += 5
    if (r.alpha_3m != null && r.alpha_3m > 0) score += 5

    // 5. Weekly and monthly agree, 10 points
    const both = [[r.alpha_1y, r.monthly_alpha_1y], [r.alpha_3y, r.monthly_alpha_3y], [r.alpha_5y, r.monthly_alpha_5y]]
      .filter(([w, m]) => w != null && m != null && w > 0 && m > 0).length
    score += Math.round(both * 3.33)

    // Ceiling: heavy absolute losses cannot be alpha-washed into a high score
    let ceiling = 100
    if (r.enh_return_5y != null) {
      if (r.enh_return_5y <= -50) ceiling = 25
      else if (r.enh_return_5y <= -30) ceiling = 40
      else if (r.enh_return_5y <= -10) ceiling = 55
      else if (r.enh_return_5y < 0) ceiling = 70
    }
    out.set(r.ticker, clamp(Math.round(Math.min(score, ceiling)), 1, 100))
  }
  return out
}
