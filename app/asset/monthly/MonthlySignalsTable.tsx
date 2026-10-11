'use client';

import { useState, useEffect, useMemo, type ReactNode } from 'react';
import Link from 'next/link';
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
  tickerAlpha5y: number | null;
  cohortPeriod: string;
  // Derived at display time (dataWithAdjustedAmount): whichever of performance/
  // currentValue vs exitAdjustedPerformance/exitAdjustedValue applies given the
  // current effective (threshold-gated) open/closed state.
  displayPerformance?: number | null;
  displayCurrentValue?: number | null;
  // Counterfactual: for closed trades, what % would have been made if held from exit to today
  counterfactualReturn?: number | null;
}

type SortColumn = 'ticker' | 'sector' | 'signalDate' | 'signalMult' | 'invested' | 'currentValue' | 'performance' | 'dcaSuitabilityScore' | 'finalConvictionScore' | 'fundamentalQualityScore' | 'factorRegimeScore' | 'volTimingScore' | 'meanReversionScore' | 'status' | 'exitDate' | 'exitScore' | 'counterfactualReturn';
type SortDirection = 'asc' | 'desc';
type ReturnFilter = 'all' | 'positive' | 'negative';
type DateRangeFilter = 'all' | 'lastMonth' | 'last3Months' | 'last6Months' | 'lastYear';
type StatusFilter = 'all' | 'open' | 'closed';
type HistoricalYear = 'none' | '2025' | '2024' | '2023' | '2022' | '2021';

const MAJOR_BUY_THRESHOLD = 5.0;
const SCORE_SLIDER_MAX = 100;
const MULTIPLIER_SLIDER_MAX = 6;
const EXIT_SCORE_SLIDER_MAX = 9;
// Matches MODIFIER_CLAMP in scripts/compute-macro-backtest.ts - the PCA factor model's tilt is clamped to +/-40%.
const FACTOR_REGIME_SLIDER_MAX = 40;
// Matches VOL_BONUS_CLAMP in scripts/compute-macro-backtest.ts - the EWMA vol-timing bonus is clamped to +/-30%.
const VOL_TIMING_SLIDER_MAX = 30;
// Matches MR_BONUS_CLAMP in scripts/compute-macro-backtest.ts - the mean-reversion bonus is clamped to +/-30%.
const MEAN_REVERSION_SLIDER_MAX = 30;

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

  const totalInvested = rows.reduce((sum, r) => sum + (r.invested ?? 0), 0);
  const totalValue = rows.reduce((sum, r) => sum + (valueOf(r) ?? 0), 0);
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

  const openValue = rows.filter(r => r.exitOpen).reduce((sum, r) => sum + (r.currentValue ?? 0), 0);
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

function getHistoricalYearDateRange(year: HistoricalYear): { start: Date; end: Date } | null {
  if (year === 'none') return null;
  const yearNum = parseInt(year);
  const start = new Date(yearNum, 0, 1);
  const end = new Date(yearNum, 11, 31);
  return { start, end };
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
  historicalYear: HistoricalYear = 'none'
): SignalRow[] {
  const search = tickerSearch.trim().toUpperCase();

  return data.filter((row) => {
    // Filter by ticker/name search
    if (search && !row.ticker.toUpperCase().includes(search) && !row.name.toUpperCase().includes(search)) return false;

    // Filter by returns (whichever is currently on display: buy-hold or realized)
    const perf = row.displayPerformance;
    if (returnFilter === 'positive' && (perf === null || perf === undefined || perf < 0)) return false;
    if (returnFilter === 'negative' && (perf === null || perf === undefined || perf >= 0)) return false;

    // Filter by date range (current period)
    if (dateRangeFilter !== 'all' && row.signalDate) {
      const signalDate = new Date(row.signalDate);
      const daysAgo = getDaysAgo(signalDate);

      switch (dateRangeFilter) {
        case 'lastMonth':
          if (daysAgo > 30) return false;
          break;
        case 'last3Months':
          if (daysAgo > 90) return false;
          break;
        case 'last6Months':
          if (daysAgo > 180) return false;
          break;
        case 'lastYear':
          if (daysAgo > 365) return false;
          break;
      }
    }

    // Filter by historical year (comparison period)
    if (historicalYear !== 'none' && row.signalDate) {
      const yearRange = getHistoricalYearDateRange(historicalYear);
      if (yearRange) {
        const signalDate = new Date(row.signalDate);
        if (signalDate < yearRange.start || signalDate > yearRange.end) {
          return false;
        }
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

    return true;
  });
}

interface PeriodReturn {
  period: string;
  return: number;
  signalCount: number;
}

interface FilterState {
  tickerSearch: string;
  setTickerSearch: (value: string) => void;
  returnFilter: ReturnFilter;
  setReturnFilter: (value: ReturnFilter) => void;
  dateRangeFilter: DateRangeFilter;
  setDateRangeFilter: (value: DateRangeFilter) => void;
  sectorFilters: string[];
  setSectorFilters: (value: string[]) => void;
  minScoreFilter: number;
  setMinScoreFilter: (value: number) => void;
  maxScoreFilter: number;
  setMaxScoreFilter: (value: number) => void;
  minMultiplierFilter: number;
  setMinMultiplierFilter: (value: number) => void;
  maxMultiplierFilter: number;
  setMaxMultiplierFilter: (value: number) => void;
  minConvictionFilter: number;
  setMinConvictionFilter: (value: number) => void;
  maxConvictionFilter: number;
  setMaxConvictionFilter: (value: number) => void;
  minFundamentalFilter: number;
  setMinFundamentalFilter: (value: number) => void;
  maxFundamentalFilter: number;
  setMaxFundamentalFilter: (value: number) => void;
  statusFilter: StatusFilter;
  setStatusFilter: (value: StatusFilter) => void;
  minExitScoreFilter: number;
  setMinExitScoreFilter: (value: number) => void;
  maxExitScoreFilter: number;
  setMaxExitScoreFilter: (value: number) => void;
  minFactorRegime: number;
  setMinFactorRegime: (value: number) => void;
  maxFactorRegime: number;
  setMaxFactorRegime: (value: number) => void;
  minVolTiming: number;
  setMinVolTiming: (value: number) => void;
  maxVolTiming: number;
  setMaxVolTiming: (value: number) => void;
  minMeanReversion: number;
  setMinMeanReversion: (value: number) => void;
  maxMeanReversion: number;
  setMaxMeanReversion: (value: number) => void;
  exitAtNextOpen: boolean;
  setExitAtNextOpen: (value: boolean) => void;
  maxMonthsHold: number;
  setMaxMonthsHold: (value: number) => void;
  historicalYear: HistoricalYear;
  setHistoricalYear: (value: HistoricalYear) => void;
  baseAmount: number;
  setBaseAmount: (value: number) => void;
}

interface MonthlySignalsTableProps extends FilterState {
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
  minFactorRegime: -FACTOR_REGIME_SLIDER_MAX,
  maxFactorRegime: FACTOR_REGIME_SLIDER_MAX,
  minVolTiming: -VOL_TIMING_SLIDER_MAX,
  maxVolTiming: VOL_TIMING_SLIDER_MAX,
  minMeanReversion: -MEAN_REVERSION_SLIDER_MAX,
  maxMeanReversion: MEAN_REVERSION_SLIDER_MAX,
  exitAtNextOpen: false,
  maxMonthsHold: 0,
  historicalYear: 'none' as HistoricalYear,
};

export function MonthlySignalsTable({
  data,
  chartData,
  chartLoading,
  tickerSearch,
  setTickerSearch,
  returnFilter,
  setReturnFilter,
  dateRangeFilter,
  setDateRangeFilter,
  sectorFilters,
  setSectorFilters,
  minScoreFilter,
  setMinScoreFilter,
  maxScoreFilter,
  setMaxScoreFilter,
  minMultiplierFilter,
  setMinMultiplierFilter,
  maxMultiplierFilter,
  setMaxMultiplierFilter,
  minConvictionFilter,
  setMinConvictionFilter,
  maxConvictionFilter,
  setMaxConvictionFilter,
  minFundamentalFilter,
  setMinFundamentalFilter,
  maxFundamentalFilter,
  setMaxFundamentalFilter,
  statusFilter,
  setStatusFilter,
  minExitScoreFilter,
  setMinExitScoreFilter,
  maxExitScoreFilter,
  setMaxExitScoreFilter,
  minFactorRegime,
  setMinFactorRegime,
  maxFactorRegime,
  setMaxFactorRegime,
  minVolTiming,
  setMinVolTiming,
  maxVolTiming,
  setMaxVolTiming,
  minMeanReversion,
  setMinMeanReversion,
  maxMeanReversion,
  setMaxMeanReversion,
  exitAtNextOpen,
  setExitAtNextOpen,
  maxMonthsHold,
  setMaxMonthsHold,
  historicalYear,
  setHistoricalYear,
  baseAmount,
  setBaseAmount,
}: MonthlySignalsTableProps) {
  const [sortColumn, setSortColumn] = useState<SortColumn>('signalDate');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [sectorPanelOpen, setSectorPanelOpen] = useState(false);
  const [pageSize, setPageSize] = useState(100);
  const [currentPage, setCurrentPage] = useState(0);
  const [visibleColumns, setVisibleColumns] = useState<Set<string>>(new Set(DEFAULT_VISIBLE_COLUMNS));
  const [columnPickerOpen, setColumnPickerOpen] = useState(false);

  const handleSort = (column: SortColumn) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('desc');
    }
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
          const pnl = val !== null && row.invested ? val - row.invested : null;
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
    exportTableToCSV(dataToExport, visibleCols, 'monthly-signals.csv');
  };

  // Get unique sectors for filter dropdown
  const uniqueSectors = useMemo(() => Array.from(new Set(data.map(r => r.sector).filter(Boolean))).sort(), [data]);

  // All assets share the current global macro regime — shown as a badge, not a filter
  const currentRegime = useMemo(() => data.find(r => r.macroRegimeState)?.macroRegimeState || null, [data]);

  // Per-row: a signal only shows its realized sale once its own exit score clears the
  // threshold. Below that (or at 0, always), it's treated as still held — buy-and-hold.
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

      let closed = isEffectivelyClosed(exitRow, minExitScoreFilter, maxExitScoreFilter);

      // Close if exceeds max months hold and is negative
      if (!closed && maxMonthsHold > 0 && row.signalDate && row.performance !== null && row.performance < 0) {
        const signalDate = new Date(row.signalDate);
        const now = new Date();
        const monthsHeld = (now.getFullYear() - signalDate.getFullYear()) * 12 + (now.getMonth() - signalDate.getMonth());
        if (monthsHeld >= maxMonthsHold) {
          closed = true;
        }
      }

      const exitReturn = exitAtNextOpen && row.exitReturnNextOpen && closed ? row.exitReturnNextOpen : row.exitAdjustedPerformance;
      const exitValue = row.invested && exitReturn ? row.invested * (1 + exitReturn / 100) : row.exitAdjustedValue;

      // Counterfactual: return from exit date to today
      let counterfactualReturn: number | null = null;
      if (closed && exitValue && exitValue > 0 && row.currentValue && row.currentValue > 0) {
        counterfactualReturn = ((row.currentValue / exitValue) - 1) * 100;
      }

      return {
        ...row,
        exitOpen: !closed,
        displayPerformance: closed ? exitReturn : row.performance,
        displayCurrentValue: closed ? exitValue : row.currentValue,
        counterfactualReturn,
      };
    }),
    [data, minExitScoreFilter, maxExitScoreFilter, exitAtNextOpen, maxMonthsHold]
  );

  const filteredData = useMemo(
    () => applyFilters(
      effectiveData, tickerSearch, returnFilter, dateRangeFilter, sectorFilters,
      minScoreFilter, minMultiplierFilter, minConvictionFilter, minFundamentalFilter, statusFilter,
      maxScoreFilter, maxMultiplierFilter, maxConvictionFilter, maxFundamentalFilter,
      minFactorRegime, maxFactorRegime, minVolTiming, maxVolTiming, minMeanReversion, maxMeanReversion,
      historicalYear
    ),
    [effectiveData, tickerSearch, returnFilter, dateRangeFilter, sectorFilters,
      minScoreFilter, maxScoreFilter, minMultiplierFilter, maxMultiplierFilter,
      minConvictionFilter, maxConvictionFilter, minFundamentalFilter, maxFundamentalFilter, statusFilter,
      minFactorRegime, maxFactorRegime, minVolTiming, maxVolTiming, minMeanReversion, maxMeanReversion,
      historicalYear]
  );

  const toggleSector = (sector: string) => {
    setSectorFilters(sectorFilters.includes(sector) ? sectorFilters.filter(s => s !== sector) : [...sectorFilters, sector]);
    setCurrentPage(0);
  };

  // Recalculate invested and currentValue based on baseAmount
  const dataWithAdjustedAmount = useMemo(() => filteredData.map(row => {
    if (row.signalMult === null) {
      return row;
    }
    const newInvested = baseAmount * row.signalMult;
    // Scale values: if original invested is 0/null, can't scale so preserve original
    const scale = (val: number | null | undefined) => {
      if (val == null) return null;
      if (row.invested === null || row.invested === undefined || row.invested === 0) {
        return val;
      }
      return newInvested * (val / row.invested);
    };
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

  // Historical period comparison: filter data for the selected historical year only
  const historicalData = useMemo(() => {
    if (historicalYear === 'none') return [];
    return applyFilters(
      effectiveData, tickerSearch, returnFilter, 'all', sectorFilters,
      minScoreFilter, minMultiplierFilter, minConvictionFilter, minFundamentalFilter, statusFilter,
      maxScoreFilter, maxMultiplierFilter, maxConvictionFilter, maxFundamentalFilter,
      minFactorRegime, maxFactorRegime, minVolTiming, maxVolTiming, minMeanReversion, maxMeanReversion,
      historicalYear
    ).map(row => {
      if (row.signalMult === null) return row;
      const newInvested = baseAmount * row.signalMult;
      // Scale values: if original invested is 0/null, can't scale so preserve original
      const scale = (val: number | null | undefined) => {
        if (val == null) return null;
        if (row.invested === null || row.invested === undefined || row.invested === 0) {
          return val;
        }
        return newInvested * (val / row.invested);
      };
      return {
        ...row,
        invested: newInvested,
        currentValue: scale(row.currentValue),
        exitAdjustedValue: scale(row.exitAdjustedValue),
        displayCurrentValue: row.exitOpen ? scale(row.currentValue) : scale(row.exitAdjustedValue),
      };
    });
  }, [effectiveData, historicalYear, tickerSearch, returnFilter, sectorFilters, minScoreFilter, minMultiplierFilter, minConvictionFilter, minFundamentalFilter, statusFilter, maxScoreFilter, maxMultiplierFilter, maxConvictionFilter, maxFundamentalFilter, minFactorRegime, maxFactorRegime, minVolTiming, maxVolTiming, minMeanReversion, maxMeanReversion, baseAmount]);

  // Use historical data if a period is selected, otherwise use current filtered data
  const statsData = useMemo(() => (historicalYear !== 'none' && historicalData.length > 0) ? historicalData : dataWithAdjustedAmount, [historicalYear, historicalData, dataWithAdjustedAmount]);

  // Two parallel views of the same filtered signals: what holding through would have
  // done (always) vs what the current Min Exit Score rule actually does.
  const buyHoldStats = useMemo(() => aggregateStats(statsData, 'buyhold'), [statsData]);
  const soldStats = useMemo(() => aggregateStats(statsData, 'sold'), [statsData]);
  const minStartingCapital = useMemo(() => computeMinStartingCapital(statsData), [statsData]);
  // Bought & Sold recycles capital through sells, so summing every buy's face value (soldStats.totalReturnPct)
  // wildly overstates capital deployed and understates the return. Min Starting Capital's walk-forward balance
  // already accounts for reuse, so its growth is the true, Buy & Hold-comparable return on capital actually required.
  const soldReturnPct = minStartingCapital.minCapital > 0
    ? ((minStartingCapital.endingValue - minStartingCapital.minCapital) / minStartingCapital.minCapital) * 100
    : null;

  const avgMultiplier = useMemo(() => {
    const mults = statsData.filter(r => r.signalMult !== null).map(r => r.signalMult as number);
    return mults.length ? mults.reduce((a, b) => a + b, 0) / mults.length : null;
  }, [statsData]);

  const avgAlpha = useMemo(() => {
    const uniqueAlphas = Array.from(new Map(statsData.map(r => [r.ticker, r.tickerAlpha5y])).values())
      .filter((v): v is number => v !== null);
    return uniqueAlphas.length ? uniqueAlphas.reduce((a, b) => a + b, 0) / uniqueAlphas.length : null;
  }, [statsData]);

  // A single portfolio-level CAGR, not an average of each signal's own annualized return —
  // averaging per-signal CAGRs lets a handful of days-old signals (extrapolated to a full
  // year off a 7-day floor) dominate the mean. Weighting holding days by invested amount
  // and applying growth to the total Invested -> Current Value ties this back to the
  // total return above it: (1 + cagr)^(weightedAvgDays/365) reproduces that same growth.
  const buyHoldCagr = useMemo(() => {
    let weightedDaysSum = 0;
    let weightSum = 0;
    for (const r of statsData) {
      const days = getHoldingDays(r);
      if (days === null || r.invested === null || r.invested <= 0) continue;
      weightedDaysSum += r.invested * days;
      weightSum += r.invested;
    }
    if (weightSum === 0 || buyHoldStats.totalInvested <= 0) return null;
    const avgDays = weightedDaysSum / weightSum;
    const growth = buyHoldStats.totalValue / buyHoldStats.totalInvested;
    return (Math.pow(growth, 365 / avgDays) - 1) * 100;
  }, [statsData, buyHoldStats]);

  const bestWorst = useMemo(() => {
    const valid = statsData.filter(r => r.performance !== null);
    if (valid.length === 0) return null;
    return {
      best: valid.reduce((a, b) => ((b.performance as number) > (a.performance as number) ? b : a)),
      worst: valid.reduce((a, b) => ((b.performance as number) < (a.performance as number) ? b : a)),
    };
  }, [statsData]);

  const soldExtra = useMemo(() => {
    const closed = statsData.filter(r => !r.exitOpen);
    const open = statsData.filter(r => r.exitOpen);
    const closedWithDates = closed.filter(r => r.exitDate && r.signalDate);
    const holdDays = closedWithDates.map(r => (new Date(r.exitDate as string).getTime() - new Date(r.signalDate as string).getTime()) / (1000 * 60 * 60 * 24));
    const closedWithScore = closed.filter(r => r.exitScore !== null);
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
    };
  }, [statsData]);

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
      {/* Summary Stats Cards Section */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '20px' }}>
        <div style={{ fontSize: '11px', color: 'var(--text-2)' }}>
          {dataWithAdjustedAmount.length.toLocaleString()} signals shown · avg {avgMultiplier !== null ? avgMultiplier.toFixed(2) : '—'}× multiplier
          {bestWorst && (
            <> · best {bestWorst.best.ticker} {formatPerformance(bestWorst.best.performance)} · worst {bestWorst.worst.ticker} {formatPerformance(bestWorst.worst.performance)}</>
          )}
        </div>

      </div>

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
              {visibleColumns.has('currentValue') && <SortHeader column="currentValue" label="P&L" />}
              {visibleColumns.has('performance') && <SortHeader column="performance" label="Return" />}
              {visibleColumns.has('status') && minExitScoreFilter > 0 && <SortHeader column="status" label="Status" />}
              {visibleColumns.has('exitDate') && minExitScoreFilter > 0 && <SortHeader column="exitDate" label="Exit Date" />}
              {visibleColumns.has('exitScore') && minExitScoreFilter > 0 && <SortHeader column="exitScore" label="Exit Score" />}
              {visibleColumns.has('counterfactualReturn') && minExitScoreFilter > 0 && <SortHeader column="counterfactualReturn" label="Return Since Exit" />}
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
                  if (pnl !== null && !row.exitOpen) {
                    const feePerTrade = 5;
                    pnl -= feePerTrade;
                  }
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
                {visibleColumns.has('status') && minExitScoreFilter > 0 && (
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
                {visibleColumns.has('exitDate') && minExitScoreFilter > 0 && (
                  <td style={{ padding: '12px 16px', textAlign: 'right', color: 'var(--text-2)', whiteSpace: 'nowrap' }}>
                    {row.exitOpen ? '—' : formatDate(row.exitDate)}
                  </td>
                )}
                {visibleColumns.has('exitScore') && minExitScoreFilter > 0 && (
                  <td style={{ padding: '12px 16px', textAlign: 'right', color: 'var(--text-2)', whiteSpace: 'nowrap' }}>
                    {row.exitScore !== null ? row.exitScore.toFixed(1) : '—'}
                  </td>
                )}
                {visibleColumns.has('counterfactualReturn') && minExitScoreFilter > 0 && (
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
