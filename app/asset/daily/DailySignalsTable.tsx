'use client';

import { useState, useEffect, useMemo, type ReactNode } from 'react';
import Link from 'next/link';
import { PeriodReturnsChart } from '@/components/ticker/PeriodReturnsChart';
import { DualRangeSlider } from '@/components/ui/DualRangeSlider';
import { exportTableToCSV, type TableColumn } from '@/lib/csv-export';

interface SignalRow {
  ticker: string;
  name: string;
  sector: string;
  signalDate: string | null;
  signalMult: number | null;
  invested: number | null;
  performance: number | null;
  currentValue: number | null;
  exitAdjustedPerformance: number | null;
  exitAdjustedValue: number | null;
  dcaSuitabilityScore: number | null;
  fundamentalQualityScore: number | null;
  finalConvictionScore: number | null;
  macroRegimeState: string | null;
  factorRegimeScore: number | null;
  factorRegimeLabel: string | null;
  volTimingScore: number | null;
  volTimingLabel: string | null;
  meanReversionScore: number | null;
  meanReversionLabel: string | null;
  tags: string[] | null;
  exitDate: string | null;
  exitReturn: number | null;
  exitScore: number | null;
  exitDateNextOpen: string | null;
  exitReturnNextOpen: number | null;
  exitOpen: boolean;
  // Trailing ATR(14) stop-loss breach scenarios, one slot per ATR_MULTIPLIERS step
  // (see scripts/compute-backtest-summary.ts) — null entries mean that multiplier
  // never breached within the available price history.
  atrStopBreachDates: (string | null)[] | null;
  atrStopBreachReturns: (number | null)[] | null;
  // Daily-only: how many days after this signal a weekly/monthly signal on the same
  // ticker confirmed the same direction (null = no confirming signal within the window).
  weeklyAlignmentDays: number | null;
  monthlyAlignmentDays: number | null;
  // Precomputed by scripts/compute-daily-signal-enrichment.ts (ATR-14 as % of close,
  // trend strength, 5-day momentum), as of the signal's own date.
  volatility: number | null;
  trendStrength: number | null;
  fiveDayMomentum: number | null;
  // Derived at display time (dataWithAdjustedAmount): whichever of performance/
  // currentValue vs exitAdjustedPerformance/exitAdjustedValue applies given the
  // current effective (threshold-gated) open/closed state.
  displayPerformance?: number | null;
  displayCurrentValue?: number | null;
  effectiveExitReason?: 'signal' | 'atrstop' | 'max-days-hold' | null;
  // Counterfactual: for closed trades, what % would have been made if held from exit to today
  counterfactualReturn?: number | null;
}

type SortColumn = 'ticker' | 'sector' | 'signalDate' | 'signalMult' | 'invested' | 'currentValue' | 'performance' | 'dcaSuitabilityScore' | 'finalConvictionScore' | 'fundamentalQualityScore' | 'factorRegimeScore' | 'volTimingScore' | 'meanReversionScore' | 'status' | 'exitDate' | 'exitReason' | 'exitScore' | 'counterfactualReturn';
type SortDirection = 'asc' | 'desc';
type ReturnFilter = 'all' | 'positive' | 'negative';
type DateRangeFilter = 'all' | 'lastWeek' | 'last2Weeks' | 'lastMonth';
type StatusFilter = 'all' | 'open' | 'closed';
type ExcludeYesterdayFilter = 'include' | 'exclude';

const MAJOR_BUY_THRESHOLD = 5.0;
// ATR-14 across the current universe: p99 ~11.7%, max is a long tail of illiquid-name
// outliers — 15 covers essentially every real signal without compressing the useful range.
const VOLATILITY_SLIDER_MAX = 15;
const SCORE_SLIDER_MAX = 100;
const MULTIPLIER_SLIDER_MAX = 6;
const EXIT_SCORE_SLIDER_MAX = 9;
// Matches MODIFIER_CLAMP in scripts/compute-macro-backtest.ts - the PCA factor model's tilt is clamped to +/-40%.
const FACTOR_REGIME_SLIDER_MAX = 40;
// Matches VOL_BONUS_CLAMP in scripts/compute-macro-backtest.ts - the EWMA vol-timing bonus is clamped to +/-30%.
const VOL_TIMING_SLIDER_MAX = 30;
// Matches MR_BONUS_CLAMP in scripts/compute-macro-backtest.ts - the mean-reversion bonus is clamped to +/-30%.
const MEAN_REVERSION_SLIDER_MAX = 30;
// 5-day momentum ranges from negative to positive, typical range -30 to +30.
const MOMENTUM_SLIDER_MAX = 30;
// Must match ATR_MULTIPLIERS in scripts/compute-backtest-summary.ts — the discrete
// trailing-stop scenarios precomputed per signal. Index into this array is what
// atrStopFilterIdx points at; null means the slider is "Off".
const ATR_MULTIPLIERS = [1.0, 1.5, 2.0, 2.5, 3.0, 3.5, 4.0];

function formatCurrency(value: number | null): string {
  if (value === null) return '—';
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
    maximumFractionDigits: 0,
  }).format(value);
}

function formatPerformance(perf: number | null): string {
  if (perf === null) return '—';
  const sign = perf >= 0 ? '+' : '';
  return `${sign}${perf.toFixed(1)}%`;
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—';
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
}

function getPerformanceColor(perf: number | null): string {
  if (perf === null) return 'var(--text-2)';
  if (perf >= 0) return 'var(--green)';
  return '#E24B4A';
}

function formatDuration(days: number): string {
  if (days < 60) return `${Math.round(days)}d`;
  return `${(days / 30).toFixed(1)}mo`;
}

// A row only counts as sold once its own real exit score clears the user's threshold.
// At 0 nothing ever clears it — 0 means "do not sell anything," not "hide closed rows."
function isEffectivelyClosed(
  row: SignalRow,
  minExitScoreFilter: number,
  maxExitScoreFilter: number = EXIT_SCORE_SLIDER_MAX
): boolean {
  return minExitScoreFilter > 0 && !row.exitOpen && row.exitScore !== null &&
    row.exitScore >= minExitScoreFilter && row.exitScore <= maxExitScoreFilter;
}

interface EffectiveExit {
  closed: boolean;
  date: string | null;
  return: number | null;
  reason: 'signal' | 'atrstop' | 'max-days-hold' | null;
}

// Combines the two independent exit triggers a row can have — the Exit Score gate
// above, and the trailing ATR stop-loss (picked via atrStopFilterIdx into
// ATR_MULTIPLIERS, or null when the slider is "Off"). Whichever qualifying trigger
// has the earlier date is what actually would have happened; string comparison is
// safe since both are YYYY-MM-DD.
function computeEffectiveExit(
  row: SignalRow,
  minExitScoreFilter: number,
  maxExitScoreFilter: number,
  atrStopFilterIdx: number | null
): EffectiveExit {
  const signalOn = isEffectivelyClosed(row, minExitScoreFilter, maxExitScoreFilter);
  const signalDate = signalOn ? row.exitDate : null;
  const signalReturn = signalOn ? row.exitReturn : null;

  let slDate: string | null = null;
  let slReturn: number | null = null;
  if (atrStopFilterIdx !== null && row.atrStopBreachDates && row.atrStopBreachReturns) {
    slDate = row.atrStopBreachDates[atrStopFilterIdx] ?? null;
    slReturn = row.atrStopBreachReturns[atrStopFilterIdx] ?? null;
  }

  if (!signalDate && !slDate) return { closed: false, date: null, return: null, reason: null };
  if (signalDate && (!slDate || signalDate <= slDate)) {
    return { closed: true, date: signalDate, return: signalReturn, reason: 'signal' };
  }
  return { closed: true, date: slDate, return: slReturn, reason: 'atrstop' };
}

// Days from signal to now — used for the Buy & Hold card's CAGR, which by definition
// never exits, so the holding period is always the full elapsed time since the signal.
// Clamped to a 7-day floor so a days-old signal doesn't produce a wildly exaggerated CAGR.
function getHoldingDays(row: SignalRow): number | null {
  if (!row.signalDate) return null;
  const days = (Date.now() - new Date(row.signalDate).getTime()) / (1000 * 60 * 60 * 24);
  return days > 0 ? Math.max(days, 7) : null;
}

interface StrategyStats {
  count: number;
  totalInvested: number;
  totalValue: number;
  totalReturnPct: number | null;
  avgReturn: number | null;
  medianReturn: number | null;
  winRate: number | null;
  winCount: number;
  validCount: number;
}

// Same shape, two different sources: pure buy-hold fields for the "Buy & Hold" card,
// display (effective/threshold-gated) fields for the "Bought & Sold" card.
function aggregateStats(rows: SignalRow[], mode: 'buyhold' | 'sold'): StrategyStats {
  const perfOf = (r: SignalRow) => (mode === 'buyhold' ? r.performance : r.displayPerformance ?? r.performance);
  const valueOf = (r: SignalRow) => (mode === 'buyhold' ? r.currentValue : r.displayCurrentValue ?? r.currentValue);

  const totalInvested = rows.reduce((sum, r) => sum + (r.invested || 0), 0);
  const totalValue = rows.reduce((sum, r) => sum + (valueOf(r) || 0), 0);
  const perfs = rows.map(perfOf).filter((p): p is number => p !== null && p !== undefined);
  const sortedPerfs = [...perfs].sort((a, b) => a - b);
  const mid = Math.floor(sortedPerfs.length / 2);
  const winCount = perfs.filter(p => p >= 0).length;

  return {
    count: rows.length,
    totalInvested,
    totalValue,
    totalReturnPct: totalInvested > 0 ? ((totalValue - totalInvested) / totalInvested) * 100 : null,
    avgReturn: perfs.length ? perfs.reduce((a, b) => a + b, 0) / perfs.length : null,
    medianReturn: sortedPerfs.length
      ? (sortedPerfs.length % 2 ? sortedPerfs[mid] : (sortedPerfs[mid - 1] + sortedPerfs[mid]) / 2)
      : null,
    winRate: perfs.length ? (winCount / perfs.length) * 100 : null,
    winCount,
    validCount: perfs.length,
  };
}

// Minimum starting cash such that every buy in this set could be funded purely from
// that starting cash plus proceeds from earlier sells, never going negative. This is
// the classic "minimum prefix balance" trick: run every buy (-invested) and sell
// (+realized proceeds) in chronological order from a balance of 0, and the required
// capital is the negative of the lowest point that running balance ever reaches.
// Assumes sale proceeds are available same-day for same-day buys, and (since it only
// simulates the currently-displayed/filtered signals) ignores any capital tied up in
// positions outside the current filter.
function computeMinStartingCapital(rows: SignalRow[]): { minCapital: number; endingValue: number } {
  const events: { date: number; amount: number }[] = [];
  for (const r of rows) {
    if (r.signalDate && r.invested !== null) {
      events.push({ date: new Date(r.signalDate).getTime(), amount: -r.invested });
    }
    if (!r.exitOpen && r.exitDate && r.exitAdjustedValue !== null) {
      events.push({ date: new Date(r.exitDate).getTime(), amount: r.exitAdjustedValue });
    }
  }
  // Same-day: proceeds land before buys are debited (optimistic, but consistent).
  events.sort((a, b) => a.date - b.date || b.amount - a.amount);

  let balance = 0;
  let minBalance = 0;
  for (const e of events) {
    balance += e.amount;
    if (balance < minBalance) minBalance = balance;
  }

  const openValue = rows.filter(r => r.exitOpen).reduce((sum, r) => sum + (r.currentValue || 0), 0);
  const minCapital = Math.max(0, -minBalance);
  // `balance` is cumulative flow from a baseline of 0, not actual cash — add back the
  // starting capital itself to get true ending wealth (cash + still-open positions).
  return { minCapital, endingValue: minCapital + balance + openValue };
}

function compareValues(a: any, b: any, ascending: boolean): number {
  // Nulls always sort last, regardless of direction, so real values stay usable at both ends.
  if (a === null && b === null) return 0;
  if (a === null) return 1;
  if (b === null) return -1;

  // Handle undefined as well
  if (a === undefined && b === undefined) return 0;
  if (a === undefined) return 1;
  if (b === undefined) return -1;

  if (typeof a === 'string' && typeof b === 'string') {
    const result = a.localeCompare(b);
    return ascending ? result : -result;
  }

  // For numbers and other types, do numeric comparison
  const aNum = Number(a);
  const bNum = Number(b);

  if (!isNaN(aNum) && !isNaN(bNum)) {
    const result = aNum - bNum;
    return ascending ? result : -result;
  }

  // Fallback: treat as strings
  const aStr = String(a ?? '');
  const bStr = String(b ?? '');
  const result = aStr.localeCompare(bStr);
  return ascending ? result : -result;
}

function sortData(data: SignalRow[], column: SortColumn, direction: SortDirection): SignalRow[] {
  const sorted = [...data];
  sorted.sort((a, b) => {
    let aVal: any;
    let bVal: any;

    switch (column) {
      case 'ticker':
        aVal = a.ticker;
        bVal = b.ticker;
        break;
      case 'sector':
        aVal = a.sector;
        bVal = b.sector;
        break;
      case 'signalDate':
        aVal = a.signalDate ? new Date(a.signalDate).getTime() : null;
        bVal = b.signalDate ? new Date(b.signalDate).getTime() : null;
        break;
      case 'signalMult':
        aVal = a.signalMult;
        bVal = b.signalMult;
        break;
      case 'invested':
        aVal = a.invested;
        bVal = b.invested;
        break;
      case 'currentValue':
        aVal = a.displayCurrentValue ?? a.currentValue;
        bVal = b.displayCurrentValue ?? b.currentValue;
        break;
      case 'performance':
        aVal = a.displayPerformance ?? a.performance;
        bVal = b.displayPerformance ?? b.performance;
        break;
      case 'dcaSuitabilityScore':
        aVal = a.dcaSuitabilityScore;
        bVal = b.dcaSuitabilityScore;
        break;
      case 'finalConvictionScore':
        aVal = a.finalConvictionScore;
        bVal = b.finalConvictionScore;
        break;
      case 'fundamentalQualityScore':
        aVal = a.fundamentalQualityScore;
        bVal = b.fundamentalQualityScore;
        break;
      case 'factorRegimeScore':
        aVal = a.factorRegimeScore;
        bVal = b.factorRegimeScore;
        break;
      case 'volTimingScore':
        aVal = a.volTimingScore;
        bVal = b.volTimingScore;
        break;
      case 'meanReversionScore':
        aVal = a.meanReversionScore;
        bVal = b.meanReversionScore;
        break;
      case 'status':
        // Open sorts after closed when ascending
        aVal = a.exitOpen ? 1 : 0;
        bVal = b.exitOpen ? 1 : 0;
        break;
      case 'exitDate':
        aVal = a.exitDate ? new Date(a.exitDate).getTime() : null;
        bVal = b.exitDate ? new Date(b.exitDate).getTime() : null;
        break;
      case 'exitReason':
        aVal = a.effectiveExitReason ?? null;
        bVal = b.effectiveExitReason ?? null;
        break;
      case 'exitScore':
        aVal = a.exitScore;
        bVal = b.exitScore;
        break;
      case 'counterfactualReturn':
        aVal = a.counterfactualReturn;
        bVal = b.counterfactualReturn;
        break;
    }

    return compareValues(aVal, bVal, direction === 'asc');
  });

  return sorted;
}

function getDaysAgo(date: Date): number {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

// `data` is expected to already carry effective (threshold-applied) performance,
// currentValue, and exitOpen — see isEffectivelyClosed / the effectiveData transform.
function applyFilters(
  data: SignalRow[],
  tickerSearch: string,
  returnFilter: ReturnFilter,
  dateRangeFilter: DateRangeFilter,
  sectorFilters: string[],
  minScoreFilter: number,
  minMultiplierFilter: number,
  minConvictionFilter: number = 0,
  minFundamentalFilter: number = 0,
  statusFilter: StatusFilter = 'all',
  excludeYesterdayFilter: ExcludeYesterdayFilter = 'exclude',
  requireWeeklyAlignment: boolean = false,
  requireMonthlyAlignment: boolean = false,
  minVolatility: number = 0,
  maxVolatility: number = VOLATILITY_SLIDER_MAX,
  maxScoreFilter: number = SCORE_SLIDER_MAX,
  maxMultiplierFilter: number = MULTIPLIER_SLIDER_MAX,
  maxConvictionFilter: number = SCORE_SLIDER_MAX,
  maxFundamentalFilter: number = SCORE_SLIDER_MAX,
  minFactorRegime: number = -FACTOR_REGIME_SLIDER_MAX,
  maxFactorRegime: number = FACTOR_REGIME_SLIDER_MAX,
  minVolTiming: number = -VOL_TIMING_SLIDER_MAX,
  maxVolTiming: number = VOL_TIMING_SLIDER_MAX,
  minMeanReversion: number = -MEAN_REVERSION_SLIDER_MAX,
  maxMeanReversion: number = MEAN_REVERSION_SLIDER_MAX,
  minMomentum: number = -MOMENTUM_SLIDER_MAX,
  maxMomentum: number = MOMENTUM_SLIDER_MAX
): SignalRow[] {
  const search = tickerSearch.trim().toUpperCase();

  return data.filter((row) => {
    // Filter by ticker/name search
    if (search && !row.ticker.toUpperCase().includes(search) && !row.name.toUpperCase().includes(search)) return false;

    // Filter by returns (whichever is currently on display: buy-hold or realized)
    const perf = row.displayPerformance;
    if (returnFilter === 'positive' && (perf === null || perf === undefined || perf < 0)) return false;
    if (returnFilter === 'negative' && (perf === null || perf === undefined || perf >= 0)) return false;

    // Filter by date range
    if (dateRangeFilter !== 'all' && row.signalDate) {
      const signalDate = new Date(row.signalDate);
      const daysAgo = getDaysAgo(signalDate);

      switch (dateRangeFilter) {
        case 'lastWeek':
          if (daysAgo > 7) return false;
          break;
        case 'last2Weeks':
          if (daysAgo > 14) return false;
          break;
        case 'lastMonth':
          if (daysAgo > 30) return false;
          break;
      }
    }

    // Filter by sector
    if (sectorFilters.length > 0 && !sectorFilters.includes(row.sector)) return false;

    // Filter by DCA suitability score
    if (minScoreFilter > 0 && (row.dcaSuitabilityScore === null || row.dcaSuitabilityScore < minScoreFilter)) return false;
    if (maxScoreFilter < SCORE_SLIDER_MAX && (row.dcaSuitabilityScore === null || row.dcaSuitabilityScore > maxScoreFilter)) return false;

    // Filter by signal multiplier
    if (minMultiplierFilter > 0 && (row.signalMult === null || row.signalMult < minMultiplierFilter)) return false;
    if (maxMultiplierFilter < MULTIPLIER_SLIDER_MAX && (row.signalMult === null || row.signalMult > maxMultiplierFilter)) return false;

    // Filter by conviction score
    if (minConvictionFilter > 0 && (row.finalConvictionScore === null || row.finalConvictionScore < minConvictionFilter)) return false;
    if (maxConvictionFilter < SCORE_SLIDER_MAX && (row.finalConvictionScore === null || row.finalConvictionScore > maxConvictionFilter)) return false;

    // Filter by fundamental quality score
    if (minFundamentalFilter > 0 && (row.fundamentalQualityScore === null || row.fundamentalQualityScore < minFundamentalFilter)) return false;
    if (maxFundamentalFilter < SCORE_SLIDER_MAX && (row.fundamentalQualityScore === null || row.fundamentalQualityScore > maxFundamentalFilter)) return false;

    // Filter by status — narrows by effective (threshold-applied) open/closed state.
    if (statusFilter === 'open' && !row.exitOpen) return false;
    if (statusFilter === 'closed' && row.exitOpen) return false;

    // Daily-only: exclude signals from the last day or two, which don't have next-day
    // price data yet to compute a meaningful return.
    if (excludeYesterdayFilter === 'exclude' && row.signalDate) {
      const signalDate = new Date(row.signalDate);
      const daysAgo = getDaysAgo(signalDate);
      if (daysAgo === 0 || daysAgo === 1) return false;
    }

    // Daily-only: multi-timeframe alignment filters
    if (requireWeeklyAlignment && row.weeklyAlignmentDays === null) return false;
    if (requireMonthlyAlignment && row.monthlyAlignmentDays === null) return false;

    // Daily-only: volatility band (ATR-14 as % of close), precomputed per signal.
    if (minVolatility > 0 && (row.volatility === null || row.volatility < minVolatility)) return false;
    if (maxVolatility < VOLATILITY_SLIDER_MAX && (row.volatility === null || row.volatility > maxVolatility)) return false;

    // Factor regime tilt (PCA statistical factor model), stored as a fraction e.g. 0.12 = +12%.
    const factorPct = row.factorRegimeScore !== null ? row.factorRegimeScore * 100 : null;
    if (minFactorRegime > -FACTOR_REGIME_SLIDER_MAX && (factorPct === null || factorPct < minFactorRegime)) return false;
    if (maxFactorRegime < FACTOR_REGIME_SLIDER_MAX && (factorPct === null || factorPct > maxFactorRegime)) return false;

    // Volatility timing bonus (EWMA dip sizing), stored as a fraction e.g. 0.1 = +10%.
    const volPct = row.volTimingScore !== null ? row.volTimingScore * 100 : null;
    if (minVolTiming > -VOL_TIMING_SLIDER_MAX && (volPct === null || volPct < minVolTiming)) return false;
    if (maxVolTiming < VOL_TIMING_SLIDER_MAX && (volPct === null || volPct > maxVolTiming)) return false;

    // Mean reversion bonus (Ornstein-Uhlenbeck/AR(1) dip sizing), stored as a fraction e.g. 0.1 = +10%.
    const mrPct = row.meanReversionScore !== null ? row.meanReversionScore * 100 : null;
    if (minMeanReversion > -MEAN_REVERSION_SLIDER_MAX && (mrPct === null || mrPct < minMeanReversion)) return false;
    if (maxMeanReversion < MEAN_REVERSION_SLIDER_MAX && (mrPct === null || mrPct > maxMeanReversion)) return false;

    // 5-day momentum — positive means recent uptrend, negative means downtrend.
    if (minMomentum > -MOMENTUM_SLIDER_MAX && (row.fiveDayMomentum === null || row.fiveDayMomentum < minMomentum)) return false;
    if (maxMomentum < MOMENTUM_SLIDER_MAX && (row.fiveDayMomentum === null || row.fiveDayMomentum > maxMomentum)) return false;

    return true;
  });
}

interface PeriodReturn {
  period: string;
  return: number;
  signalCount: number;
}

interface DailySignalsTableProps {
  data: SignalRow[];
  chartData?: PeriodReturn[];
  chartLoading?: boolean;
}

const AVAILABLE_COLUMNS: TableColumn[] = [
  { key: 'ticker', label: 'Asset' },
  { key: 'sector', label: 'Sector' },
  { key: 'signalDate', label: 'Signal Date' },
  { key: 'signalMult', label: 'Multiplier' },
  { key: 'invested', label: 'Invested' },
  { key: 'currentValue', label: 'P&L' },
  { key: 'performance', label: 'Return' },
  { key: 'status', label: 'Status' },
  { key: 'exitDate', label: 'Exit Date' },
  { key: 'exitScore', label: 'Exit Score' },
  { key: 'counterfactualReturn', label: 'Return Since Exit' },
  { key: 'dcaSuitabilityScore', label: 'DCA Score' },
  { key: 'finalConvictionScore', label: 'Conviction' },
  { key: 'fundamentalQualityScore', label: 'Fundamental' },
  { key: 'factorRegimeScore', label: 'Factor Regime' },
  { key: 'volTimingScore', label: 'Vol Timing' },
  { key: 'meanReversionScore', label: 'Mean Reversion' },
];

const DEFAULT_VISIBLE_COLUMNS = new Set(['ticker', 'signalDate', 'invested', 'currentValue', 'performance', 'status', 'exitDate', 'counterfactualReturn', 'factorRegimeScore', 'volTimingScore', 'meanReversionScore']);

const DEFAULT_FILTERS = {
  tickerSearch: '',
  returnFilter: 'all' as ReturnFilter,
  dateRangeFilter: 'all' as DateRangeFilter,
  sectorFilters: [] as string[],
  minScoreFilter: 0,
  maxScoreFilter: SCORE_SLIDER_MAX,
  minMultiplierFilter: 0,
  maxMultiplierFilter: MULTIPLIER_SLIDER_MAX,
  minConvictionFilter: 0,
  maxConvictionFilter: SCORE_SLIDER_MAX,
  minFundamentalFilter: 0,
  maxFundamentalFilter: SCORE_SLIDER_MAX,
  statusFilter: 'all' as StatusFilter,
  // min 0 + max EXIT_SCORE_SLIDER_MAX = do not sell anything (pure buy-and-hold, the
  // platform's default). Raising min is what opts individual signals into being sold,
  // one at a time, as their own real exit score clears the bar and stays under max —
  // there's no separate on/off switch beyond min being 0.
  minExitScoreFilter: 0,
  maxExitScoreFilter: EXIT_SCORE_SLIDER_MAX,
  // null = "Off — buy & hold", same convention as minExitScoreFilter being 0.
  atrStopFilterIdx: null as number | null,
  excludeYesterdayFilter: 'exclude' as ExcludeYesterdayFilter,
  requireWeeklyAlignment: false,
  requireMonthlyAlignment: false,
  minVolatility: 0,
  maxVolatility: VOLATILITY_SLIDER_MAX,
  minFactorRegime: -FACTOR_REGIME_SLIDER_MAX,
  maxFactorRegime: FACTOR_REGIME_SLIDER_MAX,
  minVolTiming: -VOL_TIMING_SLIDER_MAX,
  maxVolTiming: VOL_TIMING_SLIDER_MAX,
  minMeanReversion: -MEAN_REVERSION_SLIDER_MAX,
  maxMeanReversion: MEAN_REVERSION_SLIDER_MAX,
  minMomentum: -MOMENTUM_SLIDER_MAX,
  maxMomentum: MOMENTUM_SLIDER_MAX,
  exitAtNextOpen: false,
  maxDaysHold: 0,
};

export function DailySignalsTable({ data, chartData, chartLoading }: DailySignalsTableProps) {
  // DEBUG: Check exit data
  useEffect(() => {
    const sample = data[0];
    if (sample) {
      console.log('Exit data:', {
        exitDate: sample.exitDate,
        exitDateNextOpen: sample.exitDateNextOpen,
        exitReturn: sample.exitReturn,
        exitReturnNextOpen: sample.exitReturnNextOpen,
      });
    }
  }, [data]);

  const [sortColumn, setSortColumn] = useState<SortColumn>('signalDate');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [tickerSearch, setTickerSearch] = useState(DEFAULT_FILTERS.tickerSearch);
  const [returnFilter, setReturnFilter] = useState<ReturnFilter>(DEFAULT_FILTERS.returnFilter);
  const [dateRangeFilter, setDateRangeFilter] = useState<DateRangeFilter>(DEFAULT_FILTERS.dateRangeFilter);
  const [sectorFilters, setSectorFilters] = useState<string[]>(DEFAULT_FILTERS.sectorFilters);
  const [minScoreFilter, setMinScoreFilter] = useState(DEFAULT_FILTERS.minScoreFilter);
  const [maxScoreFilter, setMaxScoreFilter] = useState(DEFAULT_FILTERS.maxScoreFilter);
  const [minMultiplierFilter, setMinMultiplierFilter] = useState(DEFAULT_FILTERS.minMultiplierFilter);
  const [maxMultiplierFilter, setMaxMultiplierFilter] = useState(DEFAULT_FILTERS.maxMultiplierFilter);
  const [minConvictionFilter, setMinConvictionFilter] = useState(DEFAULT_FILTERS.minConvictionFilter);
  const [maxConvictionFilter, setMaxConvictionFilter] = useState(DEFAULT_FILTERS.maxConvictionFilter);
  const [minFundamentalFilter, setMinFundamentalFilter] = useState(DEFAULT_FILTERS.minFundamentalFilter);
  const [maxFundamentalFilter, setMaxFundamentalFilter] = useState(DEFAULT_FILTERS.maxFundamentalFilter);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>(DEFAULT_FILTERS.statusFilter);
  const [minExitScoreFilter, setMinExitScoreFilter] = useState(DEFAULT_FILTERS.minExitScoreFilter);
  const [maxExitScoreFilter, setMaxExitScoreFilter] = useState(DEFAULT_FILTERS.maxExitScoreFilter);
  const [atrStopFilterIdx, setAtrStopFilterIdx] = useState(DEFAULT_FILTERS.atrStopFilterIdx);
  const [sectorPanelOpen, setSectorPanelOpen] = useState(false);
  const [excludeYesterdayFilter, setExcludeYesterdayFilter] = useState<ExcludeYesterdayFilter>(DEFAULT_FILTERS.excludeYesterdayFilter);
  const [requireWeeklyAlignment, setRequireWeeklyAlignment] = useState(DEFAULT_FILTERS.requireWeeklyAlignment);
  const [requireMonthlyAlignment, setRequireMonthlyAlignment] = useState(DEFAULT_FILTERS.requireMonthlyAlignment);
  const [minVolatility, setMinVolatility] = useState(DEFAULT_FILTERS.minVolatility);
  const [maxVolatility, setMaxVolatility] = useState(DEFAULT_FILTERS.maxVolatility);
  const [minFactorRegime, setMinFactorRegime] = useState(DEFAULT_FILTERS.minFactorRegime);
  const [maxFactorRegime, setMaxFactorRegime] = useState(DEFAULT_FILTERS.maxFactorRegime);
  const [minVolTiming, setMinVolTiming] = useState(DEFAULT_FILTERS.minVolTiming);
  const [maxVolTiming, setMaxVolTiming] = useState(DEFAULT_FILTERS.maxVolTiming);
  const [minMeanReversion, setMinMeanReversion] = useState(DEFAULT_FILTERS.minMeanReversion);
  const [maxMeanReversion, setMaxMeanReversion] = useState(DEFAULT_FILTERS.maxMeanReversion);
  const [minMomentum, setMinMomentum] = useState(DEFAULT_FILTERS.minMomentum);
  const [maxMomentum, setMaxMomentum] = useState(DEFAULT_FILTERS.maxMomentum);
  const [exitAtNextOpen, setExitAtNextOpen] = useState(DEFAULT_FILTERS.exitAtNextOpen);
  const [maxDaysHold, setMaxDaysHold] = useState(DEFAULT_FILTERS.maxDaysHold);
  const [baseAmount, setBaseAmount] = useState(100);
  const [pageSize, setPageSize] = useState(100);
  const [currentPage, setCurrentPage] = useState(0);
  const [visibleColumns, setVisibleColumns] = useState<Set<string>>(new Set(DEFAULT_VISIBLE_COLUMNS));
  const [columnPickerOpen, setColumnPickerOpen] = useState(false);
  const [feePerTrade, setFeePerTrade] = useState(5);

  const handleSort = (column: SortColumn) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('desc');
    }
  };

  const resetFilters = () => {
    setTickerSearch(DEFAULT_FILTERS.tickerSearch);
    setReturnFilter(DEFAULT_FILTERS.returnFilter);
    setDateRangeFilter(DEFAULT_FILTERS.dateRangeFilter);
    setSectorFilters(DEFAULT_FILTERS.sectorFilters);
    setSectorPanelOpen(false);
    setMinScoreFilter(DEFAULT_FILTERS.minScoreFilter);
    setMaxScoreFilter(DEFAULT_FILTERS.maxScoreFilter);
    setMinMultiplierFilter(DEFAULT_FILTERS.minMultiplierFilter);
    setMaxMultiplierFilter(DEFAULT_FILTERS.maxMultiplierFilter);
    setMinConvictionFilter(DEFAULT_FILTERS.minConvictionFilter);
    setMaxConvictionFilter(DEFAULT_FILTERS.maxConvictionFilter);
    setMinFundamentalFilter(DEFAULT_FILTERS.minFundamentalFilter);
    setMaxFundamentalFilter(DEFAULT_FILTERS.maxFundamentalFilter);
    setStatusFilter(DEFAULT_FILTERS.statusFilter);
    setMinExitScoreFilter(DEFAULT_FILTERS.minExitScoreFilter);
    setMaxExitScoreFilter(DEFAULT_FILTERS.maxExitScoreFilter);
    setAtrStopFilterIdx(DEFAULT_FILTERS.atrStopFilterIdx);
    setExcludeYesterdayFilter(DEFAULT_FILTERS.excludeYesterdayFilter);
    setRequireWeeklyAlignment(DEFAULT_FILTERS.requireWeeklyAlignment);
    setRequireMonthlyAlignment(DEFAULT_FILTERS.requireMonthlyAlignment);
    setMinVolatility(DEFAULT_FILTERS.minVolatility);
    setMaxVolatility(DEFAULT_FILTERS.maxVolatility);
    setMinFactorRegime(DEFAULT_FILTERS.minFactorRegime);
    setMaxFactorRegime(DEFAULT_FILTERS.maxFactorRegime);
    setMinVolTiming(DEFAULT_FILTERS.minVolTiming);
    setMaxVolTiming(DEFAULT_FILTERS.maxVolTiming);
    setMinMeanReversion(DEFAULT_FILTERS.minMeanReversion);
    setMaxMeanReversion(DEFAULT_FILTERS.maxMeanReversion);
    setMinMomentum(DEFAULT_FILTERS.minMomentum);
    setMaxMomentum(DEFAULT_FILTERS.maxMomentum);
    setExitAtNextOpen(DEFAULT_FILTERS.exitAtNextOpen);
    setMaxDaysHold(DEFAULT_FILTERS.maxDaysHold);
    setCurrentPage(0);
  };

  const toggleColumn = (columnKey: string) => {
    const newVisible = new Set(visibleColumns);
    if (newVisible.has(columnKey)) {
      newVisible.delete(columnKey);
    } else {
      newVisible.add(columnKey);
    }
    setVisibleColumns(newVisible);
  };

  const handleExportCSV = () => {
    const visibleCols = AVAILABLE_COLUMNS.filter(col => visibleColumns.has(col.key));
    const dataToExport = dataWithAdjustedAmount.map(row => {
      const exportRow: any = {};
      visibleCols.forEach(col => {
        if (col.key === 'currentValue') {
          const val = row.displayCurrentValue ?? row.currentValue;
          let pnl = val !== null && row.invested ? val - row.invested : null;
          if (pnl !== null && !row.exitOpen) {
            pnl -= feePerTrade;
          }
          exportRow[col.key] = pnl ?? '';
        } else if (col.key === 'performance') {
          exportRow[col.key] = row.displayPerformance ?? row.performance ?? '';
        } else if (col.key === 'factorRegimeScore' || col.key === 'volTimingScore' || col.key === 'meanReversionScore') {
          const val = row[col.key as keyof SignalRow];
          exportRow[col.key] = val !== null && val !== undefined ? `${((val as number) * 100).toFixed(1)}%` : '';
        } else {
          exportRow[col.key] = row[col.key as keyof SignalRow] ?? '';
        }
      });
      return exportRow;
    });
    exportTableToCSV(dataToExport, visibleCols, 'daily-signals.csv');
  };

  // Get unique sectors for filter dropdown
  const uniqueSectors = useMemo(() => Array.from(new Set(data.map(r => r.sector).filter(Boolean))).sort(), [data]);

  // Rows lacking ATR-stop data are silently no-ops when the slider is on — surface
  // that instead of leaving it invisible (see coverage warning under the slider).
  const atrStopCoverage = useMemo(() => {
    const missing = data.filter(r => r.atrStopBreachDates == null).length;
    return { missing, total: data.length };
  }, [data]);

  // All assets share the current global macro regime — shown as a badge, not a filter
  const currentRegime = useMemo(() => data.find(r => r.macroRegimeState)?.macroRegimeState || null, [data]);

  // Per-row: a signal only shows its realized sale once one of its exit triggers
  // (Exit Score gate and/or ATR trailing stop) fires — whichever fires earlier wins.
  // Below that (or with both off), it's treated as still held — buy-and-hold.
  // performance/currentValue stay untouched (always pure buy-hold, for the Buy & Hold
  // card); displayPerformance/displayCurrentValue is whichever currently applies.
  const effectiveData = useMemo(
    () => data.map(row => {
      // Use next-open exit data if toggle is enabled
      const exitRow = exitAtNextOpen && row.exitDateNextOpen ? {
        ...row,
        exitDate: row.exitDateNextOpen,
        exitReturn: row.exitReturnNextOpen,
      } : row;

      let effective = computeEffectiveExit(exitRow, minExitScoreFilter, maxExitScoreFilter, atrStopFilterIdx);

      // Close if exceeds max days hold and is negative
      if (!effective.closed && maxDaysHold > 0 && row.signalDate && row.performance !== null && row.performance < 0) {
        const signalDate = new Date(row.signalDate);
        const now = new Date();
        const daysHeld = (now.getTime() - signalDate.getTime()) / (1000 * 60 * 60 * 24);
        if (daysHeld >= maxDaysHold) {
          effective = {
            closed: true,
            return: row.performance,
            date: new Date().toISOString().split('T')[0],
            reason: 'max-days-hold',
          };
        }
      }

      const effectiveValue = effective.closed && effective.return != null
        ? (row.invested ?? 0) * (1 + effective.return / 100)
        : null;

      // Counterfactual: return from exit date to today
      let counterfactualReturn: number | null = null;
      if (effective.closed && effectiveValue && effectiveValue > 0 && row.currentValue && row.currentValue > 0) {
        counterfactualReturn = ((row.currentValue / effectiveValue) - 1) * 100;
      }

      return {
        ...row,
        exitOpen: !effective.closed,
        // Overwritten (not just displayPerformance/displayCurrentValue) so every
        // downstream consumer of these fields — sortData, soldExtra's hold-days,
        // computeMinStartingCapital's cash-flow sim — picks up whichever trigger
        // (signal or ATR-stop) actually fired first, not just the signal-only date.
        exitDate: effective.closed ? effective.date : row.exitDate,
        exitAdjustedValue: effective.closed ? effectiveValue : row.exitAdjustedValue,
        exitAdjustedPerformance: effective.closed ? effective.return : row.exitAdjustedPerformance,
        displayPerformance: effective.closed ? effective.return : row.performance,
        displayCurrentValue: effectiveValue ?? row.currentValue,
        effectiveExitReason: effective.reason,
        counterfactualReturn,
      };
    }),
    [data, minExitScoreFilter, maxExitScoreFilter, atrStopFilterIdx, exitAtNextOpen, maxDaysHold]
  );

  const filteredData = useMemo(
    () => applyFilters(
      effectiveData,
      tickerSearch,
      returnFilter,
      dateRangeFilter,
      sectorFilters,
      minScoreFilter,
      minMultiplierFilter,
      minConvictionFilter,
      minFundamentalFilter,
      statusFilter,
      excludeYesterdayFilter,
      requireWeeklyAlignment,
      requireMonthlyAlignment,
      minVolatility,
      maxVolatility,
      maxScoreFilter,
      maxMultiplierFilter,
      maxConvictionFilter,
      maxFundamentalFilter,
      minFactorRegime,
      maxFactorRegime,
      minVolTiming,
      maxVolTiming,
      minMeanReversion,
      maxMeanReversion,
      minMomentum,
      maxMomentum
    ),
    [effectiveData, tickerSearch, returnFilter, dateRangeFilter, sectorFilters, minScoreFilter, maxScoreFilter,
      minMultiplierFilter, maxMultiplierFilter, minConvictionFilter, maxConvictionFilter,
      minFundamentalFilter, maxFundamentalFilter, statusFilter,
      excludeYesterdayFilter, requireWeeklyAlignment, requireMonthlyAlignment, minVolatility, maxVolatility,
      minFactorRegime, maxFactorRegime, minVolTiming, maxVolTiming, minMeanReversion, maxMeanReversion,
      minMomentum, maxMomentum]
  );

  const toggleSector = (sector: string) => {
    setSectorFilters(prev => prev.includes(sector) ? prev.filter(s => s !== sector) : [...prev, sector]);
    setCurrentPage(0);
  };

  // Recalculate invested and currentValue based on baseAmount
  const dataWithAdjustedAmount = useMemo(() => filteredData.map(row => {
    if (row.signalMult === null) {
      return row;
    }
    const newInvested = baseAmount * row.signalMult;
    const scale = (val: number | null | undefined) => (val != null && row.invested) ? newInvested * (val / row.invested) : null;
    const newCurrentValue = scale(row.currentValue);
    const newExitAdjustedValue = scale(row.exitAdjustedValue);
    return {
      ...row,
      invested: newInvested,
      currentValue: newCurrentValue,
      exitAdjustedValue: newExitAdjustedValue,
      // displayPerformance is a %, unaffected by baseAmount — no rescale needed.
      displayCurrentValue: row.exitOpen ? newCurrentValue : newExitAdjustedValue,
    };
  }), [filteredData, baseAmount]);

  const sortedData = useMemo(() => sortData(dataWithAdjustedAmount, sortColumn, sortDirection), [dataWithAdjustedAmount, sortColumn, sortDirection]);

  // PeriodReturnsChart reads `performance` — feed it the effective (display) value,
  // not the always-buy-hold base field.
  const chartRows = useMemo(
    () => dataWithAdjustedAmount.map(r => ({ ...r, performance: r.displayPerformance ?? r.performance })),
    [dataWithAdjustedAmount]
  );

  // Two parallel views of the same filtered signals: what holding through would have
  // done (always) vs what the current Min Exit Score rule actually does.
  const buyHoldStats = useMemo(() => aggregateStats(dataWithAdjustedAmount, 'buyhold'), [dataWithAdjustedAmount]);
  const soldStats = useMemo(() => aggregateStats(dataWithAdjustedAmount, 'sold'), [dataWithAdjustedAmount]);
  const minStartingCapital = useMemo(() => computeMinStartingCapital(dataWithAdjustedAmount), [dataWithAdjustedAmount]);
  // Bought & Sold recycles capital through sells, so summing every buy's face value (soldStats.totalReturnPct)
  // wildly overstates capital deployed and understates the return. Min Starting Capital's walk-forward balance
  // already accounts for reuse, so its growth is the true, Buy & Hold-comparable return on capital actually required.
  // Apply fee adjustment: count number of closed trades and subtract their fees.
  const closedForSoldCalc = dataWithAdjustedAmount.filter(r => !r.exitOpen);
  const totalFeesClosed = closedForSoldCalc.length * feePerTrade;
  const soldReturnPct = minStartingCapital.minCapital > 0
    ? (((minStartingCapital.endingValue - totalFeesClosed) - minStartingCapital.minCapital) / minStartingCapital.minCapital) * 100
    : null;

  const avgMultiplier = useMemo(() => {
    const mults = dataWithAdjustedAmount.filter(r => r.signalMult !== null).map(r => r.signalMult as number);
    return mults.length ? mults.reduce((a, b) => a + b, 0) / mults.length : null;
  }, [dataWithAdjustedAmount]);

  // A single portfolio-level CAGR, not an average of each signal's own annualized return —
  // averaging per-signal CAGRs lets a handful of days-old signals (extrapolated to a full
  // year off a 7-day floor) dominate the mean. Weighting holding days by invested amount
  // and applying growth to the total Invested -> Current Value ties this back to the
  // total return above it: (1 + cagr)^(weightedAvgDays/365) reproduces that same growth.
  const buyHoldCagr = useMemo(() => {
    let weightedDaysSum = 0;
    let weightSum = 0;
    for (const r of dataWithAdjustedAmount) {
      const days = getHoldingDays(r);
      if (days === null || r.invested === null || r.invested <= 0) continue;
      weightedDaysSum += r.invested * days;
      weightSum += r.invested;
    }
    if (weightSum === 0 || buyHoldStats.totalInvested <= 0) return null;
    const avgDays = weightedDaysSum / weightSum;
    const growth = buyHoldStats.totalValue / buyHoldStats.totalInvested;
    return (Math.pow(growth, 365 / avgDays) - 1) * 100;
  }, [dataWithAdjustedAmount, buyHoldStats]);

  // SPY return for comparison (if SPY is in the data)
  const spyReturn = useMemo(() => {
    const spyRow = dataWithAdjustedAmount.find(r => r.ticker === 'SPY');
    return spyRow?.performance ?? null;
  }, [dataWithAdjustedAmount]);

  const bestWorst = useMemo(() => {
    const valid = dataWithAdjustedAmount.filter(r => r.performance !== null);
    if (valid.length === 0) return null;
    return {
      best: valid.reduce((a, b) => ((b.performance as number) > (a.performance as number) ? b : a)),
      worst: valid.reduce((a, b) => ((b.performance as number) < (a.performance as number) ? b : a)),
    };
  }, [dataWithAdjustedAmount]);

  const soldExtra = useMemo(() => {
    const closed = dataWithAdjustedAmount.filter(r => !r.exitOpen);
    const open = dataWithAdjustedAmount.filter(r => r.exitOpen);
    const closedWithDates = closed.filter(r => r.exitDate && r.signalDate);
    const holdDays = closedWithDates.map(r => (new Date(r.exitDate as string).getTime() - new Date(r.signalDate as string).getTime()) / (1000 * 60 * 60 * 24));
    // exitScore is meaningful only for rows that actually closed via the signal
    // exit — an ATR-stop closure may still carry a non-null exitScore from a later
    // (never-triggered) signal exit, which would misrepresent why the row closed.
    const closedWithScore = closed.filter(r => r.exitScore !== null && r.effectiveExitReason === 'signal');
    const closedByReason = {
      signal: closed.filter(r => r.effectiveExitReason === 'signal').length,
      atrstop: closed.filter(r => r.effectiveExitReason === 'atrstop').length,
    };
    const avgPerf = (rows: SignalRow[]) => {
      const perfs = rows.map(r => r.displayPerformance).filter((p): p is number => p !== null && p !== undefined);
      return perfs.length ? perfs.reduce((a, b) => a + b, 0) / perfs.length : null;
    };
    // Profit, not gross value: gross closed/open values double-count capital that gets
    // recycled through multiple buys (see Min Starting Capital), so they can't be summed
    // with it. Profit per row has no such double-count — Min Starting Capital + closed
    // realized profit + open unrealized profit reconciles exactly to Current Value.
    const profitOf = (rows: SignalRow[]) =>
      rows.reduce((sum, r) => sum + ((r.displayCurrentValue ?? r.currentValue ?? 0) - (r.invested ?? 0)), 0);
    return {
      openCount: open.length,
      closedCount: closed.length,
      closedProfit: profitOf(closed),
      openProfit: profitOf(open),
      closedAvgReturn: avgPerf(closed),
      openAvgReturn: avgPerf(open),
      avgHoldDays: holdDays.length ? holdDays.reduce((a, b) => a + b, 0) / holdDays.length : null,
      avgExitScore: closedWithScore.length ? closedWithScore.reduce((a, b) => a + (b.exitScore as number), 0) / closedWithScore.length : null,
      closedByReason,
    };
  }, [dataWithAdjustedAmount]);

  // Pagination
  const totalPages = Math.ceil(sortedData.length / pageSize);
  const paginatedData = sortedData.slice(currentPage * pageSize, (currentPage + 1) * pageSize);

  // Reset page if filters change
  useEffect(() => {
    if (currentPage >= totalPages && totalPages > 0) {
      setCurrentPage(Math.max(0, totalPages - 1));
    }
  }, [totalPages, currentPage]);

  const FilterButton = ({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) => (
    <button
      onClick={onClick}
      style={{
        padding: '8px 12px',
        background: active ? 'var(--teal)' : 'var(--surface)',
        border: '1px solid ' + (active ? 'var(--teal)' : 'var(--border)'),
        borderRadius: '8px',
        fontSize: '12px',
        fontWeight: '600',
        color: active ? '#000' : 'var(--text)',
        cursor: 'pointer',
        transition: 'all 0.15s',
      }}
      onMouseEnter={(e) => {
        if (!active) {
          e.currentTarget.style.background = 'var(--surface2)';
        }
      }}
      onMouseLeave={(e) => {
        if (!active) {
          e.currentTarget.style.background = 'var(--surface)';
        }
      }}
    >
      {label}
    </button>
  );

  const StatLine = ({ label, value, color }: { label: string; value: ReactNode; color?: string }) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', fontSize: '12px', padding: '3px 0' }}>
      <span style={{ color: 'var(--text-2)' }}>{label}</span>
      <span style={{ fontWeight: '600', color: color || 'var(--text)', fontFamily: 'DM Mono, monospace', textAlign: 'right' }}>{value}</span>
    </div>
  );

  const SortHeader = ({ column, label }: { column: SortColumn; label: string }) => {
    const isActive = sortColumn === column;
    const icon = isActive ? (sortDirection === 'asc' ? ' ↑' : ' ↓') : '';

    return (
      <th
        onClick={() => handleSort(column)}
        style={{
          padding: '12px 16px',
          textAlign: column === 'ticker' || column === 'sector' ? 'left' : 'right',
          fontWeight: '600',
          color: isActive ? 'var(--text)' : 'var(--text-2)',
          whiteSpace: 'nowrap',
          cursor: 'pointer',
          userSelect: 'none',
          transition: 'color 0.15s',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.color = 'var(--text)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.color = isActive ? 'var(--text)' : 'var(--text-2)';
        }}
      >
        {label}
        {icon}
      </th>
    );
  };

  return (
    <>
      {/* Buy-and-hold is the baseline; Min Exit Score (below, in filters) is what opts
          individual signals into being sold, one at a time, as their own exit score
          clears the bar — there's no separate on/off switch beyond that slider. */}

      {/* Filters and Summary Stats - 70/30 Split */}
      <div style={{ display: 'grid', gridTemplateColumns: '70fr 30fr', gap: '16px', marginBottom: '20px' }}>
        {/* Filters Section - 70% - Split into 2 columns */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', background: 'var(--surface-elevated)', border: '1px solid var(--border-elevated)', borderRadius: '12px', padding: '16px', boxShadow: 'var(--inset-top), var(--shadow-md)' }}>

          {/* Left Sub-Column: Search, Return, Date Range, Status, Yesterday, Alignment */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Filter Row 1: Ticker Search */}
            <div>
              <div style={{ fontSize: '11px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-2)', marginBottom: '8px' }}>
                Search
              </div>
              <input
                type="text"
                value={tickerSearch}
                onChange={(e) => setTickerSearch(e.target.value)}
                placeholder="Ticker or name..."
                style={{
                  padding: '8px 12px',
                  background: 'var(--surface2)',
                  border: '1px solid var(--border)',
                  borderRadius: '8px',
                  fontSize: '12px',
                  color: 'var(--text)',
                  fontFamily: 'inherit',
                  width: '100%',
                }}
              />
            </div>

            {/* Filter Row 2: Return Filter */}
            <div>
              <div style={{ fontSize: '11px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-2)', marginBottom: '8px' }}>
                Return Filter
              </div>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <FilterButton active={returnFilter === 'all'} onClick={() => setReturnFilter('all')} label="All Returns" />
                <FilterButton active={returnFilter === 'positive'} onClick={() => setReturnFilter('positive')} label="Positive Only" />
                <FilterButton active={returnFilter === 'negative'} onClick={() => setReturnFilter('negative')} label="Negative Only" />
              </div>
            </div>

            {/* Filter Row 3: Date Range */}
            <div>
              <div style={{ fontSize: '11px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-2)', marginBottom: '8px' }}>
                Signal Date
              </div>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <FilterButton active={dateRangeFilter === 'all'} onClick={() => setDateRangeFilter('all')} label="All (12wk)" />
                <FilterButton active={dateRangeFilter === 'lastWeek'} onClick={() => setDateRangeFilter('lastWeek')} label="Last Week" />
                <FilterButton active={dateRangeFilter === 'last2Weeks'} onClick={() => setDateRangeFilter('last2Weeks')} label="Last 2 Weeks" />
                <FilterButton active={dateRangeFilter === 'lastMonth'} onClick={() => setDateRangeFilter('lastMonth')} label="Last Month" />
              </div>
            </div>

            {/* Filter Row 4: Status */}
            <div>
              <div style={{ fontSize: '11px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-2)', marginBottom: '8px' }}>
                Status
              </div>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <FilterButton active={statusFilter === 'all'} onClick={() => setStatusFilter('all')} label="All" />
                <FilterButton active={statusFilter === 'open'} onClick={() => setStatusFilter('open')} label="Open" />
                <FilterButton active={statusFilter === 'closed'} onClick={() => setStatusFilter('closed')} label="Closed" />
              </div>
            </div>

            {/* Filter Row 5: Yesterday's Trades — daily-only, no next-day price yet */}
            <div>
              <div style={{ fontSize: '11px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-2)', marginBottom: '8px' }}>
                Yesterday's Trades
              </div>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <FilterButton active={excludeYesterdayFilter === 'exclude'} onClick={() => setExcludeYesterdayFilter('exclude')} label="Exclude" />
                <FilterButton active={excludeYesterdayFilter === 'include'} onClick={() => setExcludeYesterdayFilter('include')} label="Include" />
              </div>
            </div>

            {/* Filter Row 6: Multi-timeframe Alignment — daily-only */}
            <div>
              <div style={{ fontSize: '11px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-2)', marginBottom: '4px' }}>
                Timeframe Alignment
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-3)', marginBottom: '8px' }}>
                Weekly within 4w · Monthly within 3m
              </div>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <button
                  onClick={() => setRequireWeeklyAlignment(v => !v)}
                  style={{
                    padding: '8px 12px',
                    background: requireWeeklyAlignment ? 'rgba(72,199,142,0.15)' : 'var(--surface)',
                    border: '1px solid ' + (requireWeeklyAlignment ? 'var(--green)' : 'var(--border)'),
                    borderRadius: '8px',
                    fontSize: '12px',
                    fontWeight: '600',
                    color: requireWeeklyAlignment ? 'var(--green)' : 'var(--text)',
                    cursor: 'pointer',
                    transition: 'all 0.15s',
                  }}
                >
                  Weekly ✓
                </button>
                <button
                  onClick={() => setRequireMonthlyAlignment(v => !v)}
                  style={{
                    padding: '8px 12px',
                    background: requireMonthlyAlignment ? 'rgba(72,199,142,0.15)' : 'var(--surface)',
                    border: '1px solid ' + (requireMonthlyAlignment ? 'var(--green)' : 'var(--border)'),
                    borderRadius: '8px',
                    fontSize: '12px',
                    fontWeight: '600',
                    color: requireMonthlyAlignment ? 'var(--green)' : 'var(--text)',
                    cursor: 'pointer',
                    transition: 'all 0.15s',
                  }}
                >
                  Monthly ✓
                </button>
              </div>
              {(requireWeeklyAlignment || requireMonthlyAlignment) && (
                <div style={{ marginTop: '8px', fontSize: '11px', color: 'var(--text-3)', lineHeight: '1.5' }}>
                  {filteredData.length.toLocaleString()} signals with{requireWeeklyAlignment && requireMonthlyAlignment ? ' weekly + monthly' : requireWeeklyAlignment ? ' weekly' : ' monthly'} confirmation
                </div>
              )}
            </div>

            {/* Filter Row 7: Exit Score band — the sell on/off control itself. min=0
                stays "Off" regardless of max (buy & hold); once min > 0, only signals
                whose own exit score falls within [min, max] get sold. */}
            <div>
              <div style={{ fontSize: '11px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-2)', marginBottom: '8px' }}>
                Exit Score: {minExitScoreFilter === 0
                  ? 'Off — buy & hold'
                  : `${minExitScoreFilter.toFixed(1)}${maxExitScoreFilter >= EXIT_SCORE_SLIDER_MAX ? '+' : ` – ${maxExitScoreFilter.toFixed(1)}`}`}
              </div>
              <DualRangeSlider
                min={0}
                max={EXIT_SCORE_SLIDER_MAX}
                step={0.5}
                minValue={minExitScoreFilter}
                maxValue={maxExitScoreFilter}
                onMinChange={setMinExitScoreFilter}
                onMaxChange={setMaxExitScoreFilter}
              />
              <div style={{ fontSize: '10px', color: 'var(--text-3)', marginTop: '4px' }}>
                Off at 0, then sells signals whose own exit score falls within this band
              </div>
            </div>

            {/* Filter Row 7b: Fee Per Trade */}
            <div>
              <div style={{ fontSize: '11px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-2)', marginBottom: '8px' }}>
                Fee Per Trade: £{feePerTrade}
              </div>
              <input
                type="range"
                min="0"
                max="50"
                step="1"
                value={feePerTrade}
                onChange={(e) => setFeePerTrade(Number(e.target.value))}
                style={{ width: '100%', cursor: 'pointer' }}
              />
              <div style={{ fontSize: '10px', color: 'var(--text-3)', marginTop: '4px' }}>
                Deducted from each closed position's gain
              </div>
            </div>

            {/* Filter Row 7c: Stop-Loss (ATR trail) — a single-value slider, not a
                band: one threshold, no range to isolate. Paired with Exit Score
                above; whichever trigger fires first on a given row wins. */}
            <div>
              <div style={{ fontSize: '11px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-2)', marginBottom: '8px' }}>
                Stop-Loss: {atrStopFilterIdx === null ? 'Off — buy & hold' : `${ATR_MULTIPLIERS[atrStopFilterIdx]}× ATR(14) trail`}
              </div>
              <input
                type="range"
                min="0"
                max={ATR_MULTIPLIERS.length}
                step="1"
                value={atrStopFilterIdx === null ? 0 : atrStopFilterIdx + 1}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  setAtrStopFilterIdx(v === 0 ? null : v - 1);
                }}
                style={{ width: '100%', cursor: 'pointer' }}
              />
              <div style={{ fontSize: '10px', color: 'var(--text-3)', marginTop: '4px' }}>
                Exits when price falls k× ATR(14) below the highest close since entry — this trails
                upward as the trade gains, so it moves per-ticker with each asset's own volatility
                rather than a fixed %. Combined with Exit Score above, whichever trigger fires first wins.
              </div>
              {atrStopFilterIdx !== null && atrStopCoverage.missing > 0 && (
                <div style={{ fontSize: '10px', color: '#E24B4A', marginTop: '4px' }}>
                  {atrStopCoverage.missing} of {atrStopCoverage.total} signals don't have stop-loss data yet — rerun the enrichment pipeline to backfill.
                </div>
              )}
            </div>

            {/* Filter Row 7d: Exit at Next Open — defer exit execution to next day's open price */}
            <div>
              <div style={{ fontSize: '11px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-2)', marginBottom: '8px' }}>
                Exit Timing
              </div>
              <button
                onClick={() => setExitAtNextOpen(v => !v)}
                style={{
                  padding: '8px 12px',
                  background: exitAtNextOpen ? 'rgba(6,118,141,0.15)' : 'var(--surface)',
                  border: '1px solid ' + (exitAtNextOpen ? 'var(--cyan)' : 'var(--border)'),
                  borderRadius: '8px',
                  fontSize: '12px',
                  fontWeight: '600',
                  color: exitAtNextOpen ? 'var(--cyan)' : 'var(--text)',
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                  width: '100%',
                }}
              >
                {exitAtNextOpen ? '✓ Exit at Next Open' : 'Exit at Close (default)'}
              </button>
              <div style={{ fontSize: '10px', color: 'var(--text-3)', marginTop: '4px' }}>
                {exitAtNextOpen
                  ? 'Exit executes at the next trading day\'s open price'
                  : 'Exit executes at the signal day\'s close price'}
              </div>
            </div>

            {/* Filter Row 7e: Max Days Hold — close negative trades after X days */}
            <div>
              <div style={{ fontSize: '11px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-2)', marginBottom: '8px' }}>
                Max Days Hold (If Negative): {maxDaysHold === 0 ? 'Off' : `${maxDaysHold} day${maxDaysHold !== 1 ? 's' : ''}`}
              </div>
              <input
                type="range"
                min="0"
                max="90"
                step="1"
                value={maxDaysHold}
                onChange={(e) => setMaxDaysHold(Number(e.target.value))}
                style={{
                  width: '100%',
                  cursor: 'pointer',
                }}
              />
              <div style={{ fontSize: '10px', color: 'var(--text-3)', marginTop: '4px' }}>
                {maxDaysHold === 0
                  ? 'Off — trades stay open indefinitely'
                  : `Close trades after ${maxDaysHold} day${maxDaysHold !== 1 ? 's' : ''} if negative`}
              </div>
            </div>

            {/* Filter Row 8: Reset */}
            <div>
              <button
                onClick={resetFilters}
                className="mlln-pill"
                style={{
                  padding: '8px 12px',
                  background: 'var(--surface)',
                  border: '1px solid var(--border-elevated)',
                  borderRadius: '8px',
                  fontSize: '12px',
                  fontWeight: '600',
                  color: 'var(--text-2)',
                  cursor: 'pointer',
                  boxShadow: 'var(--shadow-xs)',
                }}
              >
                Reset Filters
              </button>
            </div>
          </div>

          {/* Middle Sub-Column: Sector, Base Amount, Scores, Volatility */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <button
                onClick={() => setSectorPanelOpen(!sectorPanelOpen)}
                className="mlln-pill"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  width: '100%',
                  padding: '8px 12px',
                  background: 'var(--surface2)',
                  border: '1px solid var(--border-elevated)',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  boxShadow: 'var(--shadow-xs)',
                }}
              >
                <span style={{ fontSize: '11px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-2)' }}>
                  Sector: {sectorFilters.length === 0 ? 'All' : sectorFilters.length === 1 ? sectorFilters[0] : `${sectorFilters.length} selected`}
                </span>
                <span style={{ fontSize: '10px', color: 'var(--text-2)', transform: sectorPanelOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }}>
                  ▼
                </span>
              </button>
              {sectorPanelOpen && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '8px' }}>
                  <FilterButton active={sectorFilters.length === 0} onClick={() => setSectorFilters([])} label="All Sectors" />
                  {uniqueSectors.map((sector) => (
                    <FilterButton
                      key={sector}
                      active={sectorFilters.includes(sector)}
                      onClick={() => toggleSector(sector)}
                      label={sector}
                    />
                  ))}
                </div>
              )}
            </div>

            <div>
              <div style={{ fontSize: '11px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-2)', marginBottom: '8px' }}>
                Base Amount: £{Math.round(baseAmount)}
              </div>
              <input
                type="range"
                min="25"
                max="1000"
                step="25"
                value={baseAmount}
                onChange={(e) => setBaseAmount(Number(e.target.value))}
                style={{
                  width: '100%',
                  cursor: 'pointer',
                }}
              />
            </div>

            {/* DCA Score, Multiplier, Conviction, and Fundamental bands — both ends
                adjustable on one bar, same pattern as Volatility below, so a range
                can be isolated, not just a floor. */}
            <div>
              <div style={{ fontSize: '11px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-2)', marginBottom: '8px' }}>
                DCA Score: {minScoreFilter === 0 && maxScoreFilter >= SCORE_SLIDER_MAX
                  ? 'None'
                  : `${minScoreFilter}${maxScoreFilter >= SCORE_SLIDER_MAX ? '+' : ` – ${maxScoreFilter}`}`}
              </div>
              <DualRangeSlider
                min={0}
                max={SCORE_SLIDER_MAX}
                minValue={minScoreFilter}
                maxValue={maxScoreFilter}
                onMinChange={setMinScoreFilter}
                onMaxChange={setMaxScoreFilter}
              />
            </div>

            <div>
              <div style={{ fontSize: '11px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-2)', marginBottom: '8px' }}>
                Multiplier: {minMultiplierFilter === 0 && maxMultiplierFilter >= MULTIPLIER_SLIDER_MAX
                  ? 'None'
                  : `${minMultiplierFilter.toFixed(1)}${maxMultiplierFilter >= MULTIPLIER_SLIDER_MAX ? '+' : ` – ${maxMultiplierFilter.toFixed(1)}`}`}
              </div>
              <DualRangeSlider
                min={0}
                max={MULTIPLIER_SLIDER_MAX}
                step={0.5}
                minValue={minMultiplierFilter}
                maxValue={maxMultiplierFilter}
                onMinChange={setMinMultiplierFilter}
                onMaxChange={setMaxMultiplierFilter}
              />
            </div>

            <div>
              <div style={{ fontSize: '11px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-2)', marginBottom: '8px' }}>
                Conviction: {minConvictionFilter === 0 && maxConvictionFilter >= SCORE_SLIDER_MAX
                  ? 'None'
                  : `${minConvictionFilter}${maxConvictionFilter >= SCORE_SLIDER_MAX ? '+' : ` – ${maxConvictionFilter}`}`}
              </div>
              <DualRangeSlider
                min={0}
                max={SCORE_SLIDER_MAX}
                minValue={minConvictionFilter}
                maxValue={maxConvictionFilter}
                onMinChange={setMinConvictionFilter}
                onMaxChange={setMaxConvictionFilter}
              />
            </div>

            <div>
              <div style={{ fontSize: '11px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-2)', marginBottom: '8px' }}>
                Fundamental: {minFundamentalFilter === 0 && maxFundamentalFilter >= SCORE_SLIDER_MAX
                  ? 'None'
                  : `${minFundamentalFilter}${maxFundamentalFilter >= SCORE_SLIDER_MAX ? '+' : ` – ${maxFundamentalFilter}`}`}
              </div>
              <DualRangeSlider
                min={0}
                max={SCORE_SLIDER_MAX}
                minValue={minFundamentalFilter}
                maxValue={maxFundamentalFilter}
                onMinChange={setMinFundamentalFilter}
                onMaxChange={setMaxFundamentalFilter}
              />
            </div>

            {/* Volatility Band — precomputed ATR-14, both ends adjustable on one bar so
                a range like 3-6% can be isolated, not just a floor. */}
            <div>
              <div style={{ fontSize: '11px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-2)', marginBottom: '8px' }}>
                Volatility: {minVolatility === 0 && maxVolatility >= VOLATILITY_SLIDER_MAX
                  ? 'Any'
                  : `${minVolatility.toFixed(1)}%${maxVolatility >= VOLATILITY_SLIDER_MAX ? '+' : ` – ${maxVolatility.toFixed(1)}%`}`}
              </div>
              <DualRangeSlider
                min={0}
                max={VOLATILITY_SLIDER_MAX}
                step={0.5}
                minValue={minVolatility}
                maxValue={maxVolatility}
                onMinChange={setMinVolatility}
                onMaxChange={setMaxVolatility}
              />
              <div style={{ fontSize: '10px', color: 'var(--text-3)', marginTop: '4px' }}>
                14-day ATR as % of price at signal date — drag either handle
              </div>
              <style jsx global>{`
                .dual-range input[type='range'] {
                  position: absolute;
                  top: 0;
                  left: 0;
                  width: 100%;
                  height: 20px;
                  margin: 0;
                  background: transparent;
                  -webkit-appearance: none;
                  appearance: none;
                  pointer-events: none;
                }
                .dual-range input[type='range']::-webkit-slider-runnable-track {
                  background: transparent;
                  -webkit-appearance: none;
                }
                .dual-range input[type='range']::-moz-range-track {
                  background: transparent;
                }
                .dual-range input[type='range']::-webkit-slider-thumb {
                  -webkit-appearance: none;
                  appearance: none;
                  pointer-events: auto;
                  cursor: pointer;
                  width: 14px;
                  height: 14px;
                  border-radius: 50%;
                  background: #06768d;
                  border: 2px solid #fff;
                }
                .dual-range input[type='range']::-moz-range-thumb {
                  pointer-events: auto;
                  cursor: pointer;
                  width: 14px;
                  height: 14px;
                  border-radius: 50%;
                  background: #06768d;
                  border: 2px solid #fff;
                }
              `}</style>
            </div>

            {/* Factor Regime — PCA statistical factor tilt (scripts/compute-factor-model.ts),
                per-asset, so a range slider rather than a single global badge. */}
            <div>
              <div style={{ fontSize: '11px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-2)', marginBottom: '8px' }}>
                Factor Regime: {minFactorRegime <= -FACTOR_REGIME_SLIDER_MAX && maxFactorRegime >= FACTOR_REGIME_SLIDER_MAX
                  ? 'Any'
                  : `${minFactorRegime}%${maxFactorRegime >= FACTOR_REGIME_SLIDER_MAX ? '+' : ` – ${maxFactorRegime}%`}`}
              </div>
              <DualRangeSlider
                min={-FACTOR_REGIME_SLIDER_MAX}
                max={FACTOR_REGIME_SLIDER_MAX}
                minValue={minFactorRegime}
                maxValue={maxFactorRegime}
                onMinChange={setMinFactorRegime}
                onMaxChange={setMaxFactorRegime}
              />
              <div style={{ fontSize: '10px', color: 'var(--text-3)', marginTop: '4px' }}>
                Asset's exposure to the current PCA factor momentum — drag either handle
              </div>
            </div>

            {/* Volatility Timing — EWMA dip-sizing bonus (scripts/compute-macro-backtest.ts),
                per-asset and independent of Factor Regime. */}
            <div>
              <div style={{ fontSize: '11px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-2)', marginBottom: '8px' }}>
                Volatility Timing: {minVolTiming <= -VOL_TIMING_SLIDER_MAX && maxVolTiming >= VOL_TIMING_SLIDER_MAX
                  ? 'Any'
                  : `${minVolTiming}%${maxVolTiming >= VOL_TIMING_SLIDER_MAX ? '+' : ` – ${maxVolTiming}%`}`}
              </div>
              <DualRangeSlider
                min={-VOL_TIMING_SLIDER_MAX}
                max={VOL_TIMING_SLIDER_MAX}
                minValue={minVolTiming}
                maxValue={maxVolTiming}
                onMinChange={setMinVolTiming}
                onMaxChange={setMaxVolTiming}
              />
              <div style={{ fontSize: '10px', color: 'var(--text-3)', marginTop: '4px' }}>
                EWMA volatility-conditioned dip bonus, as of today — drag either handle
              </div>
            </div>

            {/* Mean Reversion — Ornstein-Uhlenbeck/AR(1) dip-sizing bonus (scripts/compute-macro-backtest.ts),
                per-asset and independent of Factor Regime / Volatility Timing. */}
            <div>
              <div style={{ fontSize: '11px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-2)', marginBottom: '8px' }}>
                Mean Reversion: {minMeanReversion <= -MEAN_REVERSION_SLIDER_MAX && maxMeanReversion >= MEAN_REVERSION_SLIDER_MAX
                  ? 'Any'
                  : `${minMeanReversion}%${maxMeanReversion >= MEAN_REVERSION_SLIDER_MAX ? '+' : ` – ${maxMeanReversion}%`}`}
              </div>
              <DualRangeSlider
                min={-MEAN_REVERSION_SLIDER_MAX}
                max={MEAN_REVERSION_SLIDER_MAX}
                minValue={minMeanReversion}
                maxValue={maxMeanReversion}
                onMinChange={setMinMeanReversion}
                onMaxChange={setMaxMeanReversion}
              />
              <div style={{ fontSize: '10px', color: 'var(--text-3)', marginTop: '4px' }}>
                AR(1) mean-reversion dip bonus (half-life-weighted), as of today — drag either handle
              </div>
            </div>

            {/* 5-day Momentum — recent trend: positive = uptrend, negative = downtrend */}
            <div>
              <div style={{ fontSize: '11px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-2)', marginBottom: '8px' }}>
                5-Day Momentum: {minMomentum <= -MOMENTUM_SLIDER_MAX && maxMomentum >= MOMENTUM_SLIDER_MAX
                  ? 'Any'
                  : `${minMomentum}%${maxMomentum >= MOMENTUM_SLIDER_MAX ? '+' : ` – ${maxMomentum}%`}`}
              </div>
              <DualRangeSlider
                min={-MOMENTUM_SLIDER_MAX}
                max={MOMENTUM_SLIDER_MAX}
                minValue={minMomentum}
                maxValue={maxMomentum}
                onMinChange={setMinMomentum}
                onMaxChange={setMaxMomentum}
              />
              <div style={{ fontSize: '10px', color: 'var(--text-3)', marginTop: '4px' }}>
                Price momentum over last 5 days at signal date — positive = uptrend, negative = downtrend
              </div>
            </div>

            {currentRegime && (
              <div>
                <div style={{ fontSize: '11px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-2)', marginBottom: '8px' }}>
                  Current Macro Regime
                </div>
                <div style={{ display: 'inline-block', padding: '6px 12px', background: 'var(--teal-dim, rgba(0,196,167,0.12))', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '12px', fontWeight: '600', color: 'var(--teal)' }}>
                  {currentRegime}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Column - 30%: two comparison cards instead of a wall of single-stat tiles */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ fontSize: '11px', color: 'var(--text-2)' }}>
            {dataWithAdjustedAmount.length.toLocaleString()} signals shown · avg {avgMultiplier !== null ? avgMultiplier.toFixed(2) : '—'}× multiplier
            {bestWorst && (
              <> · best {bestWorst.best.ticker} {formatPerformance(bestWorst.best.performance)} · worst {bestWorst.worst.ticker} {formatPerformance(bestWorst.worst.performance)}</>
            )}
          </div>

          {/* Buy & Hold — always the baseline, regardless of Min Exit Score */}
          <div style={{ background: 'var(--surface-elevated)', border: '1px solid var(--border-elevated)', borderRadius: '12px', padding: '16px', boxShadow: 'var(--inset-top), var(--shadow-md)' }}>
            <div style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-2)', marginBottom: '10px' }}>
              Buy &amp; Hold
            </div>
            <div style={{ fontSize: '28px', fontWeight: '700', color: getPerformanceColor(buyHoldStats.totalReturnPct) }}>
              {buyHoldStats.totalReturnPct !== null ? formatPerformance(buyHoldStats.totalReturnPct) : '—'}
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-2)', marginBottom: '10px' }}>
              total return · every signal held to today · fixed baseline, doesn't change with Min Exit Score
            </div>
            <div style={{ borderTop: '1px solid var(--border)', paddingTop: '8px' }}>
              <StatLine label="Invested" value={formatCurrency(buyHoldStats.totalInvested)} />
              <StatLine label="Current Value" value={formatCurrency(buyHoldStats.totalValue)} />
              <StatLine label="Avg / Median Return" value={`${buyHoldStats.avgReturn !== null ? formatPerformance(buyHoldStats.avgReturn) : '—'} / ${buyHoldStats.medianReturn !== null ? formatPerformance(buyHoldStats.medianReturn) : '—'}`} />
              <StatLine label="Win Rate" value={`${buyHoldStats.winRate !== null ? buyHoldStats.winRate.toFixed(1) : '—'}% (${buyHoldStats.winCount}/${buyHoldStats.validCount})`} />
              <StatLine label="Annualized (CAGR)" value={buyHoldCagr !== null ? formatPerformance(buyHoldCagr) : '—'} />
              {spyReturn !== null && <StatLine label="vs SPY (same period)" value={formatPerformance(spyReturn)} color={spyReturn >= 0 ? 'var(--text)' : '#E24B4A'} />}
            </div>
          </div>

          {/* Bought & Sold — interactive slider-based view, shown when slider is active */}
          {(minExitScoreFilter > 0 || atrStopFilterIdx !== null) && (
            <div style={{ background: 'var(--surface-elevated)', border: '1px solid var(--teal)', borderRadius: '12px', padding: '16px', boxShadow: 'var(--inset-top), var(--shadow-md)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '10px' }}>
                <div style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--teal)' }}>
                  Bought &amp; Sold (Custom Exit Score)
                </div>
                <div style={{ fontSize: '10px', color: 'var(--text-3)' }}>
                  {minExitScoreFilter > 0 ? `score ${minExitScoreFilter.toFixed(1)}${maxExitScoreFilter >= EXIT_SCORE_SLIDER_MAX ? '+' : ` – ${maxExitScoreFilter.toFixed(1)}`}` : ''}
                  {minExitScoreFilter > 0 && atrStopFilterIdx !== null ? ' ∪ ' : ''}
                  {atrStopFilterIdx !== null ? `${ATR_MULTIPLIERS[atrStopFilterIdx]}× ATR stop` : ''}
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px', flexWrap: 'wrap' }}>
                <div style={{ fontSize: '28px', fontWeight: '700', color: getPerformanceColor(soldReturnPct) }}>
                  {soldReturnPct !== null ? formatPerformance(soldReturnPct) : '—'}
                </div>
                {soldReturnPct !== null && buyHoldStats.totalReturnPct !== null && (() => {
                  const delta = soldReturnPct - buyHoldStats.totalReturnPct!;
                  return (
                    <div style={{ fontSize: '12px', fontWeight: '600', color: getPerformanceColor(delta) }}>
                      {delta >= 0 ? '+' : ''}{delta.toFixed(1)}% vs Buy &amp; Hold
                    </div>
                  );
                })()}
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-2)', marginBottom: '10px' }}>
                return on capital actually required · selling once a signal's exit score and/or the ATR trailing stop fires
              </div>
              <div style={{ borderTop: '1px solid var(--border)', paddingTop: '8px' }}>
                <StatLine label="Current Value" value={formatCurrency(minStartingCapital.endingValue)} />
                <StatLine label="Win Rate" value={`${soldStats.winRate !== null ? soldStats.winRate.toFixed(1) : '—'}%`} />
                <StatLine label="Avg Hold Time (closed)" value={soldExtra.avgHoldDays !== null ? formatDuration(soldExtra.avgHoldDays) : '—'} />
                <StatLine label="Avg Exit Score (signal closes)" value={soldExtra.avgExitScore !== null ? soldExtra.avgExitScore.toFixed(1) : '—'} />
                <StatLine label="Closed by" value={`${soldExtra.closedByReason.signal} signal / ${soldExtra.closedByReason.atrstop} ATR-stop`} />
              </div>

              {/* Realized (sold) vs still-open — the blended stats above hide this split */}
              <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: '1px solid var(--border)' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '4px', fontSize: '11px' }}>
                  <div />
                  <div style={{ color: 'var(--text-2)', textAlign: 'right' }}>Closed</div>
                  <div style={{ color: 'var(--text-2)', textAlign: 'right' }}>Still Open</div>

                  <div style={{ color: 'var(--text-2)' }}>Signals</div>
                  <div style={{ textAlign: 'right', fontFamily: 'DM Mono, monospace' }}>{soldExtra.closedCount}</div>
                  <div style={{ textAlign: 'right', fontFamily: 'DM Mono, monospace' }}>{soldExtra.openCount}</div>

                  <div style={{ color: 'var(--text-2)' }}>Profit</div>
                  <div style={{ textAlign: 'right', fontFamily: 'DM Mono, monospace', color: getPerformanceColor(soldExtra.closedProfit) }}>{formatCurrency(soldExtra.closedProfit)}</div>
                  <div style={{ textAlign: 'right', fontFamily: 'DM Mono, monospace', color: getPerformanceColor(soldExtra.openProfit) }}>{formatCurrency(soldExtra.openProfit)}</div>

                  <div style={{ color: 'var(--text-2)' }}>Avg Return</div>
                  <div style={{ textAlign: 'right', fontWeight: '600', color: getPerformanceColor(soldExtra.closedAvgReturn) }}>
                    {soldExtra.closedAvgReturn !== null ? formatPerformance(soldExtra.closedAvgReturn) : '—'}
                  </div>
                  <div style={{ textAlign: 'right', fontWeight: '600', color: getPerformanceColor(soldExtra.openAvgReturn) }}>
                    {soldExtra.openAvgReturn !== null ? formatPerformance(soldExtra.openAvgReturn) : '—'}
                  </div>
                </div>
                <div style={{ fontSize: '10px', color: 'var(--text-3)', marginTop: '6px', lineHeight: '1.4' }}>
                  Closed = realized profit banked from sales; Still Open = unrealized gain marked-to-market at today's price, not yet past the threshold
                </div>
              </div>

              <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: '1px solid var(--border)' }}>
                <StatLine label="Min Starting Capital" value={formatCurrency(minStartingCapital.minCapital)} />
                <div style={{ fontSize: '10px', color: 'var(--text-3)', marginTop: '4px', lineHeight: '1.4' }}>
                  Smallest cash balance that could fund every buy above from that cash plus earlier sale proceeds — never going negative. Min Starting Capital + Closed Profit + Open Profit = Current Value ({formatCurrency(minStartingCapital.minCapital)} + {formatCurrency(soldExtra.closedProfit)} + {formatCurrency(soldExtra.openProfit)} = {formatCurrency(minStartingCapital.endingValue)}).
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Chart */}
      <PeriodReturnsChart filteredData={chartRows} frequency="daily" />

      {/* Table Controls */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '16px', alignItems: 'center' }}>
        <div style={{ position: 'relative' }}>
          <button
            onClick={() => setColumnPickerOpen(!columnPickerOpen)}
            className="mlln-pill"
            style={{
              padding: '8px 12px',
              background: 'var(--surface)',
              border: '1px solid var(--border-elevated)',
              borderRadius: '8px',
              fontSize: '12px',
              fontWeight: '600',
              color: 'var(--text)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              boxShadow: 'var(--shadow-xs)',
            }}
          >
            ⚙️ Columns
          </button>
          {columnPickerOpen && (
            <div style={{
              position: 'absolute',
              top: '100%',
              left: 0,
              marginTop: '8px',
              background: 'var(--surface2-elevated)',
              border: '1px solid var(--border-elevated)',
              borderRadius: '8px',
              padding: '12px',
              minWidth: '200px',
              maxHeight: '300px',
              overflowY: 'auto',
              zIndex: 1000,
              boxShadow: 'var(--inset-top), var(--shadow-lg)',
            }}>
              {AVAILABLE_COLUMNS.map(col => (
                <label key={col.key} style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '8px 0',
                  cursor: 'pointer',
                  fontSize: '12px',
                }}>
                  <input
                    type="checkbox"
                    checked={visibleColumns.has(col.key)}
                    onChange={() => toggleColumn(col.key)}
                    style={{ cursor: 'pointer' }}
                  />
                  {col.label}
                </label>
              ))}
            </div>
          )}
        </div>
        <button
          onClick={handleExportCSV}
          className="mlln-pill"
          style={{
            padding: '8px 12px',
            background: 'var(--surface)',
            border: '1px solid var(--border-elevated)',
            borderRadius: '8px',
            fontSize: '12px',
            fontWeight: '600',
            color: 'var(--text)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            boxShadow: 'var(--shadow-xs)',
          }}
        >
          📥 Export CSV
        </button>
      </div>

      {/* Table */}
      <div style={{ overflowX: 'auto', border: '1px solid var(--border-elevated)', borderRadius: '12px', background: 'var(--surface-elevated)', boxShadow: 'var(--inset-top), var(--shadow-md)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border)', background: 'var(--surface2)' }}>
              {visibleColumns.has('ticker') && <SortHeader column="ticker" label="Asset" />}
              {visibleColumns.has('sector') && <SortHeader column="sector" label="Sector" />}
              {visibleColumns.has('signalDate') && <SortHeader column="signalDate" label="Signal Date" />}
              {visibleColumns.has('signalMult') && <SortHeader column="signalMult" label="Multiplier" />}
              {visibleColumns.has('invested') && <SortHeader column="invested" label="Invested" />}
              {visibleColumns.has('currentValue') && <SortHeader column="currentValue" label="Current Value" />}
              {visibleColumns.has('performance') && <SortHeader column="performance" label="Return" />}
              {visibleColumns.has('status') && (minExitScoreFilter > 0 || atrStopFilterIdx !== null) && <SortHeader column="status" label="Status" />}
              {visibleColumns.has('exitDate') && (minExitScoreFilter > 0 || atrStopFilterIdx !== null) && <SortHeader column="exitDate" label="Exit Date" />}
              {visibleColumns.has('exitScore') && (minExitScoreFilter > 0 || atrStopFilterIdx !== null) && <SortHeader column="exitScore" label="Exit Score" />}
              {visibleColumns.has('counterfactualReturn') && (minExitScoreFilter > 0 || atrStopFilterIdx !== null) && <SortHeader column="counterfactualReturn" label="Return Since Exit" />}
              {visibleColumns.has('dcaSuitabilityScore') && <SortHeader column="dcaSuitabilityScore" label="DCA Score" />}
              {visibleColumns.has('finalConvictionScore') && <SortHeader column="finalConvictionScore" label="Conviction" />}
              {visibleColumns.has('fundamentalQualityScore') && <SortHeader column="fundamentalQualityScore" label="Fundamental" />}
              {visibleColumns.has('factorRegimeScore') && <SortHeader column="factorRegimeScore" label="Factor Regime" />}
              {visibleColumns.has('volTimingScore') && <SortHeader column="volTimingScore" label="Vol Timing" />}
              {visibleColumns.has('meanReversionScore') && <SortHeader column="meanReversionScore" label="Mean Reversion" />}
            </tr>
          </thead>
          <tbody>
            {paginatedData.map((row, idx) => (
              <tr
                key={`${row.ticker}-${row.signalDate}-${idx}`}
                style={{
                  borderBottom: idx < paginatedData.length - 1 ? '1px solid var(--border)' : 'none',
                  background: idx % 2 === 0 ? 'transparent' : 'rgba(255, 255, 255, 0.02)',
                }}
              >
                {visibleColumns.has('ticker') && (
                  <td style={{ padding: '12px 16px', fontWeight: '600', color: 'var(--text)' }}>
                    <Link href={`/asset/${row.ticker.toLowerCase()}`} style={{ color: 'var(--teal)', textDecoration: 'none', cursor: 'pointer' }} className="hover:underline">
                      {row.ticker}
                    </Link>
                    <div style={{ fontSize: '11px', color: 'var(--text-2)', marginTop: '2px' }}>{row.name}</div>
                  </td>
                )}
                {visibleColumns.has('sector') && <td style={{ padding: '12px 16px', color: 'var(--text-2)', whiteSpace: 'nowrap' }}>{row.sector}</td>}
                {visibleColumns.has('signalDate') && (
                  <td style={{ padding: '12px 16px', color: 'var(--text-2)', whiteSpace: 'nowrap' }}>
                    {formatDate(row.signalDate)}
                  </td>
                )}
                {visibleColumns.has('signalMult') && (
                  <td style={{ padding: '12px 16px', textAlign: 'right', color: 'var(--text-2)', whiteSpace: 'nowrap' }}>
                    {row.signalMult !== null ? `${row.signalMult.toFixed(2)}×` : '—'}
                  </td>
                )}
                {visibleColumns.has('invested') && (
                  <td style={{ padding: '12px 16px', textAlign: 'right', color: 'var(--text-2)', whiteSpace: 'nowrap', fontFamily: 'DM Mono, monospace' }}>
                    {formatCurrency(row.invested)}
                  </td>
                )}
                {visibleColumns.has('currentValue') && (() => {
                  const val = row.displayCurrentValue ?? row.currentValue;
                  let pnl = val !== null && row.invested ? val - row.invested : null;
                  if (pnl !== null && !row.exitOpen) pnl -= feePerTrade;
                  return (
                    <td style={{ padding: '12px 16px', textAlign: 'right', color: pnl !== null ? getPerformanceColor(pnl * 100 / (row.invested || 1)) : 'var(--text-2)', whiteSpace: 'nowrap', fontFamily: 'DM Mono, monospace', fontWeight: '600' }}>
                      {formatCurrency(pnl)}
                    </td>
                  );
                })()}
                {visibleColumns.has('performance') && (
                  <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: '600', whiteSpace: 'nowrap', color: getPerformanceColor(row.displayPerformance ?? row.performance) }}>
                    {formatPerformance(row.displayPerformance ?? row.performance)}
                  </td>
                )}
                {visibleColumns.has('status') && (minExitScoreFilter > 0 || atrStopFilterIdx !== null) && (
                  <td style={{ padding: '12px 16px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                    <span style={{
                      display: 'inline-block',
                      padding: '2px 8px',
                      borderRadius: '12px',
                      fontSize: '11px',
                      fontWeight: '700',
                      letterSpacing: '0.04em',
                      background: row.exitOpen ? 'rgba(72, 199, 142, 0.15)' : 'rgba(255, 255, 255, 0.07)',
                      color: row.exitOpen ? 'var(--green)' : 'var(--text-2)',
                      border: `1px solid ${row.exitOpen ? 'var(--green)' : 'var(--border)'}`,
                    }}>
                      {row.exitOpen ? 'Open' : 'Closed'}
                    </span>
                  </td>
                )}
                {visibleColumns.has('exitDate') && (minExitScoreFilter > 0 || atrStopFilterIdx !== null) && (
                  <td style={{ padding: '12px 16px', textAlign: 'right', color: 'var(--text-2)', whiteSpace: 'nowrap' }}>
                    {row.exitOpen ? '—' : formatDate(row.exitDate)}
                  </td>
                )}
                {visibleColumns.has('exitScore') && (minExitScoreFilter > 0 || atrStopFilterIdx !== null) && (
                  <td style={{ padding: '12px 16px', textAlign: 'right', color: 'var(--text-2)', whiteSpace: 'nowrap' }}>
                    {row.effectiveExitReason === 'signal' && row.exitScore !== null ? row.exitScore.toFixed(1) : '—'}
                  </td>
                )}
                {visibleColumns.has('counterfactualReturn') && (minExitScoreFilter > 0 || atrStopFilterIdx !== null) && (
                  <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: '600', whiteSpace: 'nowrap', color: getPerformanceColor(row.counterfactualReturn ?? null) }}>
                    {row.counterfactualReturn !== null && row.counterfactualReturn !== undefined ? formatPerformance(row.counterfactualReturn) : '—'}
                  </td>
                )}
                {visibleColumns.has('dcaSuitabilityScore') && (
                  <td style={{ padding: '12px 16px', textAlign: 'right', color: 'var(--text-2)', whiteSpace: 'nowrap' }}>
                    {row.dcaSuitabilityScore !== null ? `${Math.round(row.dcaSuitabilityScore)}` : '—'}
                  </td>
                )}
                {visibleColumns.has('finalConvictionScore') && (
                  <td style={{ padding: '12px 16px', textAlign: 'right', color: 'var(--text-2)', whiteSpace: 'nowrap' }}>
                    {row.finalConvictionScore !== null ? `${Math.round(row.finalConvictionScore)}` : '—'}
                  </td>
                )}
                {visibleColumns.has('fundamentalQualityScore') && (
                  <td style={{ padding: '12px 16px', textAlign: 'right', color: 'var(--text-2)', whiteSpace: 'nowrap' }}>
                    {row.fundamentalQualityScore !== null ? `${Math.round(row.fundamentalQualityScore)}` : '—'}
                  </td>
                )}
                {visibleColumns.has('factorRegimeScore') && (
                  <td style={{ padding: '12px 16px', textAlign: 'right', whiteSpace: 'nowrap', color: row.factorRegimeScore === null ? 'var(--text-2)' : getPerformanceColor(row.factorRegimeScore) }} title={row.factorRegimeLabel ?? undefined}>
                    {row.factorRegimeScore !== null ? `${row.factorRegimeScore >= 0 ? '+' : ''}${(row.factorRegimeScore * 100).toFixed(1)}%` : '—'}
                  </td>
                )}
                {visibleColumns.has('volTimingScore') && (
                  <td style={{ padding: '12px 16px', textAlign: 'right', whiteSpace: 'nowrap', color: row.volTimingScore === null ? 'var(--text-2)' : getPerformanceColor(row.volTimingScore) }} title={row.volTimingLabel ?? undefined}>
                    {row.volTimingScore !== null ? `${row.volTimingScore >= 0 ? '+' : ''}${(row.volTimingScore * 100).toFixed(1)}%` : '—'}
                  </td>
                )}
                {visibleColumns.has('meanReversionScore') && (
                  <td style={{ padding: '12px 16px', textAlign: 'right', whiteSpace: 'nowrap', color: row.meanReversionScore === null ? 'var(--text-2)' : getPerformanceColor(row.meanReversionScore) }} title={row.meanReversionLabel ?? undefined}>
                    {row.meanReversionScore !== null ? `${row.meanReversionScore >= 0 ? '+' : ''}${(row.meanReversionScore * 100).toFixed(1)}%` : '—'}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>

        {/* Pagination Controls */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 0', borderTop: '1px solid var(--border)' }}>
          <div style={{ fontSize: '12px', color: 'var(--text-2)' }}>
            Showing {sortedData.length === 0 ? 0 : currentPage * pageSize + 1}–{Math.min((currentPage + 1) * pageSize, sortedData.length)} of {sortedData.length.toLocaleString()} signals
          </div>

          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setCurrentPage(0);
              }}
              className="mlln-pill"
              style={{
                padding: '6px 8px',
                background: 'var(--surface)',
                border: '1px solid var(--border-elevated)',
                borderRadius: '6px',
                color: 'var(--text)',
                fontSize: '12px',
                cursor: 'pointer',
                boxShadow: 'var(--shadow-xs)',
              }}
            >
              <option value={50}>50 per page</option>
              <option value={100}>100 per page</option>
              <option value={250}>250 per page</option>
              <option value={500}>500 per page</option>
            </select>

            <button
              onClick={() => setCurrentPage(Math.max(0, currentPage - 1))}
              disabled={currentPage === 0}
              style={{
                padding: '6px 12px',
                background: currentPage === 0 ? 'var(--surface2)' : 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: '6px',
                color: currentPage === 0 ? 'var(--text-3)' : 'var(--text)',
                fontSize: '12px',
                cursor: currentPage === 0 ? 'not-allowed' : 'pointer',
              }}
            >
              ← Prev
            </button>

            <div style={{ fontSize: '12px', color: 'var(--text-2)', minWidth: '100px', textAlign: 'center' }}>
              Page {totalPages === 0 ? 0 : currentPage + 1} of {totalPages}
            </div>

            <button
              onClick={() => setCurrentPage(Math.min(totalPages - 1, currentPage + 1))}
              disabled={currentPage >= totalPages - 1}
              style={{
                padding: '6px 12px',
                background: currentPage >= totalPages - 1 ? 'var(--surface2)' : 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: '6px',
                color: currentPage >= totalPages - 1 ? 'var(--text-3)' : 'var(--text)',
                fontSize: '12px',
                cursor: currentPage >= totalPages - 1 ? 'not-allowed' : 'pointer',
              }}
            >
              Next →
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
