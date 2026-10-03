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
  tickerAlpha5y: number | null;
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
type HistoricalQuarter = 'none' | 'Q1-2025' | 'Q2-2025' | 'Q3-2024' | 'Q4-2024' | 'Q1-2024' | 'Q2-2024';

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

function getHistoricalQuarterDateRange(quarter: HistoricalQuarter): { start: Date; end: Date } | null {
  if (quarter === 'none') return null;

  const [q, year] = quarter.split('-');
  const yearNum = parseInt(year);
  const quarterNum = parseInt(q.replace('Q', ''));
  const startMonth = (quarterNum - 1) * 3;
  const start = new Date(yearNum, startMonth, 1);
  const end = new Date(yearNum, startMonth + 3, 0); // Last day of quarter
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
  historicalQuarter: HistoricalQuarter = 'none'
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

    // Filter by historical quarter (comparison period)
    if (historicalQuarter !== 'none' && row.signalDate) {
      const quarterRange = getHistoricalQuarterDateRange(historicalQuarter);
      if (quarterRange) {
        const signalDate = new Date(row.signalDate);
        if (signalDate < quarterRange.start || signalDate > quarterRange.end) {
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

interface WeeklySignalsTableProps {
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
  maxWeeksHold: 0,
  historicalQuarter: 'none' as HistoricalQuarter,
};

export function WeeklySignalsTable({ data, chartData, chartLoading }: WeeklySignalsTableProps) {
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
  const [minFactorRegime, setMinFactorRegime] = useState(DEFAULT_FILTERS.minFactorRegime);
  const [maxFactorRegime, setMaxFactorRegime] = useState(DEFAULT_FILTERS.maxFactorRegime);
  const [minVolTiming, setMinVolTiming] = useState(DEFAULT_FILTERS.minVolTiming);
  const [maxVolTiming, setMaxVolTiming] = useState(DEFAULT_FILTERS.maxVolTiming);
  const [minMeanReversion, setMinMeanReversion] = useState(DEFAULT_FILTERS.minMeanReversion);
  const [maxMeanReversion, setMaxMeanReversion] = useState(DEFAULT_FILTERS.maxMeanReversion);
  const [exitAtNextOpen, setExitAtNextOpen] = useState(DEFAULT_FILTERS.exitAtNextOpen);
  const [maxWeeksHold, setMaxWeeksHold] = useState(DEFAULT_FILTERS.maxWeeksHold);
  const [historicalQuarter, setHistoricalQuarter] = useState<HistoricalQuarter>(DEFAULT_FILTERS.historicalQuarter);
  const [sectorPanelOpen, setSectorPanelOpen] = useState(false);
  const [baseAmount, setBaseAmount] = useState(100);
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
    setMinFactorRegime(DEFAULT_FILTERS.minFactorRegime);
    setMaxFactorRegime(DEFAULT_FILTERS.maxFactorRegime);
    setMinVolTiming(DEFAULT_FILTERS.minVolTiming);
    setMaxVolTiming(DEFAULT_FILTERS.maxVolTiming);
    setMinMeanReversion(DEFAULT_FILTERS.minMeanReversion);
    setMaxMeanReversion(DEFAULT_FILTERS.maxMeanReversion);
    setExitAtNextOpen(DEFAULT_FILTERS.exitAtNextOpen);
    setMaxWeeksHold(DEFAULT_FILTERS.maxWeeksHold);
    setHistoricalQuarter(DEFAULT_FILTERS.historicalQuarter);
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
    exportTableToCSV(dataToExport, visibleCols, 'weekly-signals.csv');
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
      let forceClosedByMaxWeeksHold = false;

      // Close if exceeds max weeks hold and is negative
      if (!closed && maxWeeksHold > 0 && row.signalDate && row.performance !== null && row.performance < 0) {
        const signalDate = new Date(row.signalDate);
        const now = new Date();
        const daysHeld = (now.getTime() - signalDate.getTime()) / (1000 * 60 * 60 * 24);
        const weeksHeld = daysHeld / 7;
        if (weeksHeld >= maxWeeksHold) {
          closed = true;
          forceClosedByMaxWeeksHold = true;
        }
      }

      const exitReturn = exitAtNextOpen && row.exitReturnNextOpen && closed ? row.exitReturnNextOpen : row.exitAdjustedPerformance;
      const exitValue = row.invested && exitReturn != null ? row.invested * (1 + exitReturn / 100) : row.exitAdjustedValue;

      // Counterfactual: return from exit date to today
      let counterfactualReturn: number | null = null;
      if (closed && exitValue && exitValue > 0 && row.currentValue && row.currentValue > 0) {
        // Only show counterfactual for real exits with an actual exitDate. For force-closed
        // positions (via maxWeeksHold), the "exit value" is hypothetical (today's performance),
        // so counterfactual would incorrectly show 0.
        if (!forceClosedByMaxWeeksHold && exitRow.exitDate) {
          counterfactualReturn = ((row.currentValue / exitValue) - 1) * 100;
        }
      }

      return {
        ...row,
        exitOpen: !closed,
        displayPerformance: closed ? exitReturn : row.performance,
        displayCurrentValue: closed ? exitValue : row.currentValue,
        counterfactualReturn,
      };
    }),
    [data, minExitScoreFilter, maxExitScoreFilter, exitAtNextOpen, maxWeeksHold]
  );

  const filteredData = useMemo(
    () => applyFilters(
      effectiveData, tickerSearch, returnFilter, dateRangeFilter, sectorFilters,
      minScoreFilter, minMultiplierFilter, minConvictionFilter, minFundamentalFilter, statusFilter,
      maxScoreFilter, maxMultiplierFilter, maxConvictionFilter, maxFundamentalFilter,
      minFactorRegime, maxFactorRegime, minVolTiming, maxVolTiming, minMeanReversion, maxMeanReversion,
      historicalQuarter
    ),
    [effectiveData, tickerSearch, returnFilter, dateRangeFilter, sectorFilters,
      minScoreFilter, maxScoreFilter, minMultiplierFilter, maxMultiplierFilter,
      minConvictionFilter, maxConvictionFilter, minFundamentalFilter, maxFundamentalFilter, statusFilter,
      minFactorRegime, maxFactorRegime, minVolTiming, maxVolTiming, minMeanReversion, maxMeanReversion,
      historicalQuarter]
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

  // Historical period comparison: filter data for the selected historical quarter only
  const historicalData = useMemo(() => {
    if (historicalQuarter === 'none') return [];
    return applyFilters(
      effectiveData, tickerSearch, returnFilter, 'all', sectorFilters,
      minScoreFilter, minMultiplierFilter, minConvictionFilter, minFundamentalFilter, statusFilter,
      maxScoreFilter, maxMultiplierFilter, maxConvictionFilter, maxFundamentalFilter,
      minFactorRegime, maxFactorRegime, minVolTiming, maxVolTiming, minMeanReversion, maxMeanReversion,
      historicalQuarter
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
  }, [effectiveData, historicalQuarter, tickerSearch, returnFilter, sectorFilters, minScoreFilter, minMultiplierFilter, minConvictionFilter, minFundamentalFilter, statusFilter, maxScoreFilter, maxMultiplierFilter, maxConvictionFilter, maxFundamentalFilter, minFactorRegime, maxFactorRegime, minVolTiming, maxVolTiming, minMeanReversion, maxMeanReversion, baseAmount]);

  // Use historical data if a period is selected, otherwise use current filtered data
  const statsData = useMemo(() => (historicalQuarter !== 'none' && historicalData.length > 0) ? historicalData : dataWithAdjustedAmount, [historicalQuarter, historicalData, dataWithAdjustedAmount]);

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
      {/* Buy-and-hold is the baseline; Min Exit Score (below, in filters) is what opts
          individual signals into being sold, one at a time, as their own exit score
          clears the bar — there's no separate on/off switch beyond that slider. */}

      {/* Filters and Summary Stats - 70/30 Split */}
      <div style={{ display: 'grid', gridTemplateColumns: '70fr 30fr', gap: '16px', marginBottom: '20px' }}>
        {/* Filters Section - 70% - Split into 2 columns */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', background: 'var(--surface-elevated)', border: '1px solid var(--border-elevated)', borderRadius: '12px', padding: '16px', boxShadow: 'var(--inset-top), var(--shadow-md)' }}>

          {/* Left Sub-Column: Search, Return, Date Range */}
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
                <FilterButton active={dateRangeFilter === 'all'} onClick={() => setDateRangeFilter('all')} label="All Time" />
                <FilterButton active={dateRangeFilter === 'lastMonth'} onClick={() => setDateRangeFilter('lastMonth')} label="Last Month" />
                <FilterButton active={dateRangeFilter === 'last3Months'} onClick={() => setDateRangeFilter('last3Months')} label="Last 3M" />
                <FilterButton active={dateRangeFilter === 'last6Months'} onClick={() => setDateRangeFilter('last6Months')} label="Last 6M" />
                <FilterButton active={dateRangeFilter === 'lastYear'} onClick={() => setDateRangeFilter('lastYear')} label="Last Year" />
              </div>
            </div>

            {/* Filter Row 3b: Historical Period Comparison */}
            <div>
              <div style={{ fontSize: '11px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-2)', marginBottom: '8px' }}>
                Historical Period (Out-of-Sample)
              </div>
              <select
                value={historicalQuarter}
                onChange={(e) => setHistoricalQuarter(e.target.value as HistoricalQuarter)}
                className="mlln-pill"
                style={{
                  padding: '8px 12px',
                  background: 'var(--surface2)',
                  border: '1px solid var(--border-elevated)',
                  borderRadius: '8px',
                  fontSize: '12px',
                  color: 'var(--text)',
                  fontFamily: 'inherit',
                  minWidth: '200px',
                  cursor: 'pointer',
                  boxShadow: 'var(--shadow-xs)',
                }}
              >
                <option value="none">No Comparison</option>
                <option value="Q1-2025">Q1 2025</option>
                <option value="Q2-2025">Q2 2025</option>
                <option value="Q3-2024">Q3 2024</option>
                <option value="Q4-2024">Q4 2024</option>
                <option value="Q1-2024">Q1 2024</option>
                <option value="Q2-2024">Q2 2024</option>
              </select>
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

            {/* Filter Row 5: Exit Score band — the sell on/off control itself. min=0
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

            {/* Filter Row 5b: Exit at Next Open — defer exit execution to next day's open price */}
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

            {/* Filter Row 5c: Max Weeks Hold — close negative trades after X weeks */}
            <div>
              <div style={{ fontSize: '11px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-2)', marginBottom: '8px' }}>
                Max Weeks Hold (If Negative): {maxWeeksHold === 0 ? 'Off' : `${maxWeeksHold} week${maxWeeksHold !== 1 ? 's' : ''}`}
              </div>
              <input
                type="range"
                min="0"
                max="104"
                step="1"
                value={maxWeeksHold}
                onChange={(e) => setMaxWeeksHold(Number(e.target.value))}
                style={{
                  width: '100%',
                  cursor: 'pointer',
                }}
              />
              <div style={{ fontSize: '10px', color: 'var(--text-3)', marginTop: '4px' }}>
                {maxWeeksHold === 0
                  ? 'Off — trades stay open indefinitely'
                  : `Close trades after ${maxWeeksHold} week${maxWeeksHold !== 1 ? 's' : ''} if negative`}
              </div>
            </div>

            {/* Filter Row 6: Reset */}
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

          {/* Middle Sub-Column: Sector, Base Amount, DCA Score */}
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
                adjustable on one bar, same dual-range pattern as Exit Score above. */}
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
              <StatLine
                label="vs Standard DCA (5Y)"
                value={avgAlpha !== null ? formatPerformance(avgAlpha) : '—'}
                color={avgAlpha !== null ? getPerformanceColor(avgAlpha) : undefined}
              />
              <div style={{ fontSize: '10px', color: 'var(--text-3)', marginTop: '4px', lineHeight: '1.4' }}>
                Fixed per-ticker benchmark from each ticker's own 5-year backtest — not weighted by Invested and not tied to these signals' actual dates, so it won't reconcile arithmetically with the figures above.
              </div>
            </div>
          </div>

          {/* Bought & Sold — only appears once Min Exit Score > 0 actually sells something */}
          {minExitScoreFilter > 0 && (
            <div style={{ background: 'var(--surface-elevated)', border: '1px solid var(--teal)', borderRadius: '12px', padding: '16px', boxShadow: 'var(--inset-top), var(--shadow-md)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '10px' }}>
                <div style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--teal)' }}>
                  Bought &amp; Sold
                </div>
                <div style={{ fontSize: '10px', color: 'var(--text-3)' }}>
                  score {minExitScoreFilter.toFixed(1)}{maxExitScoreFilter >= EXIT_SCORE_SLIDER_MAX ? '+' : ` – ${maxExitScoreFilter.toFixed(1)}`}
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
                return on capital actually required · selling once a signal's own exit score clears the bar
              </div>
              <div style={{ borderTop: '1px solid var(--border)', paddingTop: '8px' }}>
                <StatLine label="Current Value" value={formatCurrency(minStartingCapital.endingValue)} />
                <StatLine label="Win Rate" value={`${soldStats.winRate !== null ? soldStats.winRate.toFixed(1) : '—'}%`} />
                <StatLine label="Avg Hold Time (closed)" value={soldExtra.avgHoldDays !== null ? formatDuration(soldExtra.avgHoldDays) : '—'} />
                <StatLine label="Avg Exit Score (closed)" value={soldExtra.avgExitScore !== null ? soldExtra.avgExitScore.toFixed(1) : '—'} />
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
      <PeriodReturnsChart filteredData={chartRows} frequency="weekly" />

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
