/**
 * Utilities for monthly signals dashboard computation.
 * All heavy lifting happens here, memoized in components.
 */

export interface CohortStats {
  period: string; // YYYY-MM
  signalCount: number;
  totalInvested: number;
  totalValue: number;
  avgReturn: number | null;
  medianReturn: number | null;
  closedCount: number;
  openCount: number;
  closedProfit: number;
  openProfit: number;
  closedAvgReturn: number | null;
  openAvgReturn: number | null;
  winRate: number | null;
  daysAgo: number;
  isMature: boolean; // True if > 6 weeks old
}

export interface DrawdownPoint {
  date: string;
  cumulativeInvested: number;
  cumulativeValue: number;
  drawdown: number;
  maxDrawdown: number;
}

export interface SignalRowEnhanced {
  ticker: string;
  signalDate: string;
  invested: number;
  performance: number | null;
  currentValue: number;
  exitOpen: boolean;
  exitAdjustedValue: number;
  exitDate: string | null;
  displayPerformance: number | null; // Threshold-gated
  displayValue: number;
  cohortPeriod: string;
  isClosedProfit: boolean;
  isClosedLoss: boolean;
  isOpenProfit: boolean;
  isOpenLoss: boolean;
}

/**
 * Group signals by cohort (month) and compute statistics per cohort.
 * This is the single most impactful optimization: instead of computing
 * stats per-signal in the chart, we pre-aggregate by month.
 */
export function computeCohortStats(
  signals: SignalRowEnhanced[]
): Map<string, CohortStats> {
  const cohortMap = new Map<string, SignalRowEnhanced[]>();
  const now = Date.now();

  // Group by period
  for (const sig of signals) {
    const key = sig.cohortPeriod;
    if (!cohortMap.has(key)) {
      cohortMap.set(key, []);
    }
    cohortMap.get(key)!.push(sig);
  }

  // Compute stats per cohort
  const result = new Map<string, CohortStats>();
  for (const [period, cohortSignals] of Array.from(cohortMap.entries())) {
    const [year, month] = period.split('-').map(Number);
    const cohortDate = new Date(year, month - 1, 1);
    const daysAgo = Math.floor((now - cohortDate.getTime()) / (1000 * 60 * 60 * 24));
    const isMature = daysAgo > 42; // >6 weeks

    const totalInvested = cohortSignals.reduce((sum: number, s: SignalRowEnhanced) => sum + s.invested, 0);
    const totalValue = cohortSignals.reduce((sum: number, s: SignalRowEnhanced) => sum + s.displayValue, 0);

    const perfs = cohortSignals
      .map((s: SignalRowEnhanced) => s.displayPerformance)
      .filter((p: number | null): p is number => p !== null);
    const sortedPerfs = [...perfs].sort((a: number, b: number) => a - b);
    const mid = Math.floor(sortedPerfs.length / 2);
    const medianReturn =
      sortedPerfs.length > 0
        ? sortedPerfs.length % 2
          ? sortedPerfs[mid]
          : (sortedPerfs[mid - 1] + sortedPerfs[mid]) / 2
        : null;

    const closed = cohortSignals.filter((s: SignalRowEnhanced) => !s.exitOpen);
    const open = cohortSignals.filter((s: SignalRowEnhanced) => s.exitOpen);
    const closedProfit = closed.filter((s: SignalRowEnhanced) => (s.displayPerformance ?? 0) >= 0).length;
    const closedLoss = closed.filter((s: SignalRowEnhanced) => (s.displayPerformance ?? 0) < 0).length;
    const openProfit = open.filter((s: SignalRowEnhanced) => (s.displayPerformance ?? 0) >= 0).length;
    const openLoss = open.filter((s: SignalRowEnhanced) => (s.displayPerformance ?? 0) < 0).length;

    const closedAvgPerf = closed.length
      ? closed
          .map((s: SignalRowEnhanced) => s.displayPerformance)
          .filter((p: number | null): p is number => p !== null)
          .reduce((a: number, b: number) => a + b, 0) / closed.length
      : null;
    const openAvgPerf = open.length
      ? open
          .map((s: SignalRowEnhanced) => s.displayPerformance)
          .filter((p: number | null): p is number => p !== null)
          .reduce((a: number, b: number) => a + b, 0) / open.length
      : null;

    const winCount = perfs.filter((p: number) => p >= 0).length;
    const winRate = perfs.length > 0 ? (winCount / perfs.length) * 100 : null;

    const closedProf = closed.reduce((sum: number, s: SignalRowEnhanced) => sum + (s.displayValue - s.invested), 0);
    const openProf = open.reduce((sum: number, s: SignalRowEnhanced) => sum + (s.displayValue - s.invested), 0);

    result.set(period, {
      period,
      signalCount: cohortSignals.length,
      totalInvested,
      totalValue,
      avgReturn:
        perfs.length > 0
          ? perfs.reduce((a: number, b: number) => a + b, 0) / perfs.length
          : null,
      medianReturn,
      closedCount: closed.length,
      openCount: open.length,
      closedProfit: closedProf,
      openProfit: openProf,
      closedAvgReturn: closedAvgPerf,
      openAvgReturn: openAvgPerf,
      winRate,
      daysAgo,
      isMature,
    });
  }

  return result;
}

/**
 * Compute equity curve and drawdown for both Buy & Hold and Sold strategies.
 */
export function computeEquityCurve(
  signals: SignalRowEnhanced[]
): {
  byHoldCurve: DrawdownPoint[];
  soldCurve: DrawdownPoint[];
  maxDrawdownBh: number;
  maxDrawdownSold: number;
} {
  // Sort by date
  const sorted = [...signals].sort(
    (a, b) =>
      new Date(a.signalDate).getTime() - new Date(b.signalDate).getTime()
  );

  const bhCurve: DrawdownPoint[] = [];
  const soldCurve: DrawdownPoint[] = [];
  let bhCumulativeInvested = 0;
  let bhCumulativeValue = 0;
  let soldCumulativeInvested = 0;
  let soldCumulativeValue = 0;
  let maxDdBh = 0;
  let maxDdSold = 0;
  let peakBh = 0;
  let peakSold = 0;

  for (const sig of sorted) {
    // Buy & Hold: always mark-to-market
    bhCumulativeInvested += sig.invested;
    bhCumulativeValue += sig.currentValue;
    const bhDrawdown =
      peakBh > 0 ? ((peakBh - bhCumulativeValue) / peakBh) * 100 : 0;
    peakBh = Math.max(peakBh, bhCumulativeValue);
    maxDdBh = Math.max(maxDdBh, bhDrawdown);

    bhCurve.push({
      date: sig.signalDate,
      cumulativeInvested: bhCumulativeInvested,
      cumulativeValue: bhCumulativeValue,
      drawdown: bhDrawdown,
      maxDrawdown: maxDdBh,
    });

    // Sold: only count closed trades at their exit value
    if (!sig.exitOpen && sig.exitDate) {
      soldCumulativeInvested += sig.invested;
      soldCumulativeValue += sig.exitAdjustedValue;
    } else {
      soldCumulativeInvested += sig.invested;
      soldCumulativeValue += sig.displayValue;
    }

    const soldDrawdown =
      peakSold > 0 ? ((peakSold - soldCumulativeValue) / peakSold) * 100 : 0;
    peakSold = Math.max(peakSold, soldCumulativeValue);
    maxDdSold = Math.max(maxDdSold, soldDrawdown);

    soldCurve.push({
      date: sig.signalDate,
      cumulativeInvested: soldCumulativeInvested,
      cumulativeValue: soldCumulativeValue,
      drawdown: soldDrawdown,
      maxDrawdown: maxDdSold,
    });
  }

  return {
    byHoldCurve: bhCurve,
    soldCurve: soldCurve,
    maxDrawdownBh: maxDdBh,
    maxDrawdownSold: maxDdSold,
  };
}

/**
 * Return distribution buckets for histogram.
 */
export function computeReturnDistribution(
  signals: SignalRowEnhanced[],
  bucketSize: number = 5 // 5% buckets
): { bucket: string; closedCount: number; openCount: number }[] {
  const buckets = new Map<string, { closedCount: number; openCount: number }>();

  for (const sig of signals) {
    const perf = sig.displayPerformance ?? 0;
    const bucketIndex = Math.floor(perf / bucketSize);
    const bucketStart = bucketIndex * bucketSize;
    const bucketEnd = bucketStart + bucketSize;
    const label =
      bucketStart >= 0 ? `+${bucketStart}% to +${bucketEnd}%` : `${bucketStart}% to ${bucketEnd}%`;

    if (!buckets.has(label)) {
      buckets.set(label, { closedCount: 0, openCount: 0 });
    }

    const bucket = buckets.get(label)!;
    if (sig.exitOpen) {
      bucket.openCount++;
    } else {
      bucket.closedCount++;
    }
  }

  // Sort by bucket start value
  return Array.from(buckets.entries())
    .map(([label, data]) => ({ bucket: label, ...data }))
    .sort((a, b) => {
      const aStart = parseInt(a.bucket.split('%')[0].replace('+', ''));
      const bStart = parseInt(b.bucket.split('%')[0].replace('+', ''));
      return aStart - bStart;
    });
}

/**
 * Top/bottom contributors.
 */
export function computeContributors(
  signals: SignalRowEnhanced[],
  topN: number = 10
): {
  topGainers: SignalRowEnhanced[];
  topLosers: SignalRowEnhanced[];
  totalProfit: number;
  profitExcludingTop5: number;
} {
  const sorted = [...signals].sort(
    (a, b) =>
      (b.displayValue - b.invested) - (a.displayValue - a.invested)
  );

  const topGainers = sorted.slice(0, topN);
  const topLosers = [...sorted].reverse().slice(0, topN);

  const totalProfit = signals.reduce(
    (sum, s) => sum + (s.displayValue - s.invested),
    0
  );
  const top5Profit = sorted
    .slice(0, 5)
    .reduce((sum, s) => sum + (s.displayValue - s.invested), 0);
  const profitExcludingTop5 = totalProfit - top5Profit;

  return {
    topGainers,
    topLosers,
    totalProfit,
    profitExcludingTop5,
  };
}

/**
 * Min exit score sensitivity: show how returns change as we vary the threshold.
 */
export interface SensitivityRow {
  minExitScore: number;
  closedCount: number;
  return: number | null;
  totalCapital: number;
}

export function computeSensitivityTable(
  signals: SignalRowEnhanced[]
): SensitivityRow[] {
  const thresholds = [0, 1, 2, 3, 4, 5];
  const result: SensitivityRow[] = [];

  for (const threshold of thresholds) {
    const filtered = signals.filter(s => {
      if (threshold === 0) return true; // All buy-hold
      // Only closed if threshold applies
      return s.exitOpen || (s.exitAdjustedValue && s.invested);
    });

    if (filtered.length === 0) {
      result.push({
        minExitScore: threshold,
        closedCount: 0,
        return: null,
        totalCapital: 0,
      });
      continue;
    }

    const totalInvested = filtered.reduce((sum, s) => sum + s.invested, 0);
    const totalValue = filtered.reduce(
      (sum, s) =>
        sum +
        (threshold === 0 || s.exitOpen ? s.displayValue : s.exitAdjustedValue),
      0
    );
    const closedCount = filtered.filter(
      s => !s.exitOpen
    ).length;
    const returnPct =
      totalInvested > 0
        ? ((totalValue - totalInvested) / totalInvested) * 100
        : null;

    result.push({
      minExitScore: threshold,
      closedCount,
      return: returnPct,
      totalCapital: totalInvested,
    });
  }

  return result;
}
