'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { PeriodReturnsChart } from '@/components/ticker/PeriodReturnsChart';

interface SignalRow {
  ticker: string;
  name: string;
  sector: string;
  signalDate: string | null;
  signalMult: number | null;
  invested: number | null;
  performance: number | null;
  currentValue: number | null;
  dcaSuitabilityScore: number | null;
  exitDate: string | null;
  exitReturn: number | null;
  exitScore: number | null;
  exitOpen: boolean;
  weeklyAlignmentDays: number | null;
  monthlyAlignmentDays: number | null;
}

interface SignalMetrics {
  ticker: string;
  signalDate: string;
  trendStrength: number;
  fiveDayMomentum: number;
  volatility: number;
  avgDailyMove: number;
}

type SortColumn = 'ticker' | 'sector' | 'signalDate' | 'signalMult' | 'invested' | 'currentValue' | 'performance' | 'dcaSuitabilityScore' | 'exitDate' | 'status' | 'exitScore';
type SortDirection = 'asc' | 'desc';
type ReturnFilter = 'all' | 'positive' | 'negative';
type DateRangeFilter = 'all' | 'lastMonth' | 'last3Months' | 'last6Months' | 'lastYear';
type StatusFilter = 'all' | 'open' | 'closed';
type ExcludeYesterdayFilter = 'include' | 'exclude';

const MAJOR_BUY_THRESHOLD = 5.0;

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

function compareValues(a: any, b: any, ascending: boolean): number {
  if (a === null && b === null) return 0;
  if (a === null) return ascending ? 1 : -1;
  if (b === null) return ascending ? -1 : 1;

  if (typeof a === 'string') {
    return ascending ? a.localeCompare(b) : b.localeCompare(a);
  }

  return ascending ? a - b : b - a;
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
        aVal = a.currentValue;
        bVal = b.currentValue;
        break;
      case 'performance':
        aVal = a.performance;
        bVal = b.performance;
        break;
      case 'dcaSuitabilityScore':
        aVal = a.dcaSuitabilityScore;
        bVal = b.dcaSuitabilityScore;
        break;
      case 'exitDate':
        aVal = a.exitDate ? new Date(a.exitDate).getTime() : null;
        bVal = b.exitDate ? new Date(b.exitDate).getTime() : null;
        break;
      case 'exitScore':
        aVal = a.exitScore;
        bVal = b.exitScore;
        break;
      case 'status':
        // Open trades sort after closed trades when ascending
        aVal = a.exitOpen ? 1 : 0;
        bVal = b.exitOpen ? 1 : 0;
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

function applyFilters(
  data: SignalRow[],
  onlyWithSignals: boolean,
  returnFilter: ReturnFilter,
  dateRangeFilter: DateRangeFilter,
  sectorFilter: string,
  minScoreFilter: number,
  minMultiplierFilter: number,
  statusFilter: StatusFilter,
  minExitScoreFilter: number,
  excludeYesterdayFilter: ExcludeYesterdayFilter,
  requireWeeklyAlignment: boolean,
  requireMonthlyAlignment: boolean,
  metricsMap?: Map<string, SignalMetrics>,
  minTrendStrength?: number,
  maxFiveDayMomentum?: number,
  minVolatility?: number,
  maxVolatility?: number
): SignalRow[] {
  return data.filter((row) => {
    // Filter by signal existence
    if (onlyWithSignals && row.signalDate === null) return false;

    // Filter by returns
    if (returnFilter === 'positive' && (row.performance === null || row.performance < 0)) return false;
    if (returnFilter === 'negative' && (row.performance === null || row.performance >= 0)) return false;

    // Filter by date range
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

    // Filter by sector
    if (sectorFilter && row.sector !== sectorFilter) return false;

    // Filter by DCA suitability score
    if (minScoreFilter > 0 && (row.dcaSuitabilityScore === null || row.dcaSuitabilityScore < minScoreFilter)) return false;

    // Filter by signal multiplier
    if (minMultiplierFilter > 0 && (row.signalMult === null || row.signalMult < minMultiplierFilter)) return false;

    // Filter by status
    if (statusFilter === 'open' && !row.exitOpen) return false;
    if (statusFilter === 'closed' && row.exitOpen) return false;

    // Exit Score filter controls closed trade visibility:
    // 0 = only show open trades (no closed trades)
    // > 0 = show open + closed trades with exitScore >= threshold
    if (!row.exitOpen) {
      if (minExitScoreFilter === 0) return false;
      if (row.exitScore === null || row.exitScore < minExitScoreFilter) return false;
    }

    // Filter out yesterday's trades (no next-day data yet)
    if (excludeYesterdayFilter === 'exclude' && row.signalDate) {
      const signalDate = new Date(row.signalDate);
      const daysAgo = getDaysAgo(signalDate);
      if (daysAgo === 0 || daysAgo === 1) return false;
    }

    // Multi-timeframe alignment filters
    if (requireWeeklyAlignment && row.weeklyAlignmentDays === null) return false;
    if (requireMonthlyAlignment && row.monthlyAlignmentDays === null) return false;

    // Apply advanced filters if metrics are available
    if (metricsMap && metricsMap.size > 0 && row.signalDate) {
      const key = `${row.ticker}-${row.signalDate}`;
      const metrics = metricsMap.get(key);

      if (metrics) {
        if (minTrendStrength !== undefined && metrics.trendStrength < minTrendStrength) {
          return false;
        }
        if (maxFiveDayMomentum !== undefined && metrics.fiveDayMomentum > maxFiveDayMomentum) {
          return false;
        }
        if (minVolatility !== undefined && metrics.volatility < minVolatility) {
          return false;
        }
        if (maxVolatility !== undefined && metrics.volatility > maxVolatility) {
          return false;
        }
      }
    }

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

export function DailySignalsTable({ data, chartData, chartLoading }: DailySignalsTableProps) {
  const [sortColumn, setSortColumn] = useState<SortColumn>('performance');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [showOnlyWithSignals, setShowOnlyWithSignals] = useState(false);
  const [returnFilter, setReturnFilter] = useState<ReturnFilter>('all');
  const [dateRangeFilter, setDateRangeFilter] = useState<DateRangeFilter>('all');
  const [sectorFilter, setSectorFilter] = useState('');
  const [minScoreFilter, setMinScoreFilter] = useState(0);
  const [minMultiplierFilter, setMinMultiplierFilter] = useState(0);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [minExitScoreFilter, setMinExitScoreFilter] = useState(0);
  const [excludeYesterdayFilter, setExcludeYesterdayFilter] = useState<ExcludeYesterdayFilter>('exclude');
  const [baseAmount, setBaseAmount] = useState(100);
  const [pageSize, setPageSize] = useState(100);
  const [currentPage, setCurrentPage] = useState(0);

  // Advanced filter states
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [minTrendStrength, setMinTrendStrength] = useState(0); // 0 = no filter
  const [maxFiveDayMomentum, setMaxFiveDayMomentum] = useState(100); // 100 = no filter
  const [minVolatility, setMinVolatility] = useState(0); // 0 = no filter
  const [maxVolatility, setMaxVolatility] = useState(100); // 100 = no filter
  const [metricsMap, setMetricsMap] = useState<Map<string, SignalMetrics>>(new Map());
  const [metricsLoading, setMetricsLoading] = useState(false);

  // Multi-timeframe alignment filters
  const [requireWeeklyAlignment, setRequireWeeklyAlignment] = useState(false);
  const [requireMonthlyAlignment, setRequireMonthlyAlignment] = useState(false);

  const handleSort = (column: SortColumn) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('desc');
    }
  };

  // Fetch metrics for signals
  useEffect(() => {
    const fetchMetrics = async () => {
      if (data.length === 0) {
        console.log('No data to fetch metrics for');
        return;
      }

      console.log('Starting metrics fetch for', data.length, 'signals');
      setMetricsLoading(true);
      try {
        const signalsToAnalyze = data
          .filter(d => d.signalDate !== null)
          .slice(0, 100); // Limit to avoid timeout

        console.log('Sending', signalsToAnalyze.length, 'signals to API');

        const response = await fetch('/api/daily-signal-metrics', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ signals: signalsToAnalyze }),
          signal: AbortSignal.timeout(45000), // 45 second timeout
        });

        console.log('API Response status:', response.status);

        if (response.ok) {
          const metrics: SignalMetrics[] = await response.json();
          console.log('Received metrics:', metrics.length);
          if (metrics.length > 0) {
            console.log('Sample metric:', metrics[0]);
          }
          const map = new Map(metrics.map(m => [`${m.ticker}-${m.signalDate}`, m]));
          setMetricsMap(map);
          console.log('MetricsMap size:', map.size);
        } else {
          const error = await response.text();
          console.warn('Metrics API error:', response.status, error);
        }
      } catch (err) {
        console.error('Error fetching metrics:', err);
      } finally {
        setMetricsLoading(false);
      }
    };

    fetchMetrics();
  }, [data.length]);

  // Get unique sectors for filter dropdown
  const uniqueSectors = Array.from(new Set(data.map(r => r.sector).filter(Boolean))).sort();

  const filteredData = useMemo(() => applyFilters(
    data,
    showOnlyWithSignals,
    returnFilter,
    dateRangeFilter,
    sectorFilter,
    minScoreFilter,
    minMultiplierFilter,
    statusFilter,
    minExitScoreFilter,
    excludeYesterdayFilter,
    requireWeeklyAlignment,
    requireMonthlyAlignment,
    metricsMap,
    minTrendStrength,
    maxFiveDayMomentum,
    minVolatility,
    maxVolatility
  ), [data, showOnlyWithSignals, returnFilter, dateRangeFilter, sectorFilter,
      minScoreFilter, minMultiplierFilter, statusFilter, minExitScoreFilter,
      excludeYesterdayFilter, requireWeeklyAlignment, requireMonthlyAlignment,
      metricsMap, minTrendStrength, maxFiveDayMomentum, minVolatility, maxVolatility]);

  // Debug logging
  if (minExitScoreFilter === 0 && filteredData.length > 0 && filteredData.some(d => !d.exitOpen)) {
    console.warn('Exit Score Filter = 0 but found', filteredData.filter(d => !d.exitOpen).length, 'closed trades. This should be 0.');
  }

  // Recalculate invested and currentValue based on baseAmount
  const dataWithAdjustedAmount = filteredData.map(row => {
    if (row.signalMult === null) {
      return row;
    }
    const newInvested = baseAmount * row.signalMult;
    const newCurrentValue = row.currentValue && row.invested ? newInvested * (row.currentValue / row.invested) : null;
    return {
      ...row,
      invested: newInvested,
      currentValue: newCurrentValue,
    };
  });

  const sortedData = sortData(dataWithAdjustedAmount, sortColumn, sortDirection);

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
      {/* Filters and Summary Stats - 70/30 Split */}
      <div style={{ display: 'grid', gridTemplateColumns: '70fr 30fr', gap: '16px', marginBottom: '20px' }}>
        {/* Filters Section - 70% - Split into 2 columns */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', background: 'var(--surface-elevated)', border: '1px solid var(--border-elevated)', borderRadius: '12px', padding: '16px', boxShadow: 'var(--inset-top), var(--shadow-md)' }}>

          {/* Left Sub-Column: Return, Status, Yesterday */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Filter Row 1: Return Filter */}
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

            {/* Filter Row 2: Status */}
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

            {/* Filter Row 3: Exclude Yesterday */}
            <div>
              <div style={{ fontSize: '11px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-2)', marginBottom: '8px' }}>
                Yesterday's Trades
              </div>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <FilterButton active={excludeYesterdayFilter === 'exclude'} onClick={() => setExcludeYesterdayFilter('exclude')} label="Exclude" />
                <FilterButton active={excludeYesterdayFilter === 'include'} onClick={() => setExcludeYesterdayFilter('include')} label="Include" />
              </div>
            </div>

            {/* Filter Row 4: Multi-timeframe Alignment */}
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

          </div>

          {/* Middle Sub-Column: Sector, Base Amount, DCA Score */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <div style={{ fontSize: '11px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-2)', marginBottom: '8px' }}>
                Sector
              </div>
              <select
                value={sectorFilter}
                onChange={(e) => setSectorFilter(e.target.value)}
                className="mlln-pill"
                style={{
                  padding: '8px 12px',
                  background: 'var(--surface2)',
                  border: '1px solid var(--border-elevated)',
                  borderRadius: '8px',
                  fontSize: '12px',
                  color: 'var(--text)',
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  width: '100%',
                  boxShadow: 'var(--shadow-xs)',
                }}
              >
                <option value="">All Sectors</option>
                {uniqueSectors.map((sector) => (
                  <option key={sector} value={sector}>
                    {sector}
                  </option>
                ))}
              </select>
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

            <div>
              <div style={{ fontSize: '11px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-2)', marginBottom: '8px' }}>
                Min DCA Score: {minScoreFilter > 0 ? minScoreFilter : 'None'}
              </div>
              <input
                type="range"
                min="0"
                max="100"
                value={minScoreFilter}
                onChange={(e) => setMinScoreFilter(Number(e.target.value))}
                style={{
                  width: '100%',
                  cursor: 'pointer',
                }}
              />
            </div>

            <div>
              <div style={{ fontSize: '11px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-2)', marginBottom: '8px' }}>
                Min Multiplier: {minMultiplierFilter > 0 ? minMultiplierFilter.toFixed(1) : 'None'}
              </div>
              <input
                type="range"
                min="0"
                max="6"
                step="0.5"
                value={minMultiplierFilter}
                onChange={(e) => setMinMultiplierFilter(Number(e.target.value))}
                style={{
                  width: '100%',
                  cursor: 'pointer',
                }}
              />
            </div>

            <div>
              <div style={{ fontSize: '11px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-2)', marginBottom: '8px' }}>
                Min Exit Score: {minExitScoreFilter > 0 ? minExitScoreFilter.toFixed(1) : 'None'}
              </div>
              <input
                type="range"
                min="0"
                max="9"
                step="0.5"
                value={minExitScoreFilter}
                onChange={(e) => setMinExitScoreFilter(Number(e.target.value))}
                style={{
                  width: '100%',
                  cursor: 'pointer',
                }}
              />
            </div>
          </div>
        </div>

        {/* Right Column - 30% with Summary and Stats - 2 Columns x 3 Rows */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          {/* Row 1 */}
          <div style={{ background: 'var(--surface-elevated)', border: '1px solid var(--border-elevated)', borderRadius: '12px', padding: '16px', boxShadow: 'var(--inset-top), var(--shadow-md)' }}>
            <div style={{ fontSize: '11px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-2)', marginBottom: '6px' }}>
              Win Rate
            </div>
            <div style={{ fontSize: '24px', fontWeight: '700', color: 'var(--green)' }}>
              {(() => {
                const validSignals = dataWithAdjustedAmount.filter(r => r.performance !== null);
                if (validSignals.length === 0) return '—';
                const winCount = validSignals.filter(r => (r.performance as number) >= 0).length;
                const winRate = (winCount / validSignals.length) * 100;
                return `${winRate.toFixed(1)}%`;
              })()}
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-2)', marginTop: '4px' }}>
              {(() => {
                const validSignals = dataWithAdjustedAmount.filter(r => r.performance !== null);
                if (validSignals.length === 0) return '0/0';
                const winCount = validSignals.filter(r => (r.performance as number) >= 0).length;
                return `${winCount}/${validSignals.length}`;
              })()}
            </div>
          </div>

          <div style={{ background: 'var(--surface-elevated)', border: '1px solid var(--border-elevated)', borderRadius: '12px', padding: '16px', boxShadow: 'var(--inset-top), var(--shadow-md)' }}>
            <div style={{ fontSize: '11px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-2)', marginBottom: '6px' }}>
              Total Invested
            </div>
            <div style={{ fontSize: '24px', fontWeight: '700', color: 'var(--text)', fontFamily: 'DM Mono, monospace' }}>
              {(() => {
                const total = dataWithAdjustedAmount.reduce((sum, r) => sum + (r.invested || 0), 0);
                return formatCurrency(total);
              })()}
            </div>
          </div>

          {/* Row 2 */}
          <div style={{ background: 'var(--surface-elevated)', border: '1px solid var(--border-elevated)', borderRadius: '12px', padding: '16px', boxShadow: 'var(--inset-top), var(--shadow-md)' }}>
            <div style={{ fontSize: '11px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-2)', marginBottom: '6px' }}>
              Current Value
            </div>
            <div style={{ fontSize: '24px', fontWeight: '700', color: 'var(--text)', fontFamily: 'DM Mono, monospace', marginBottom: '8px' }}>
              {(() => {
                const closedTrades = dataWithAdjustedAmount.filter(r => !r.exitOpen && r.exitReturn !== null);
                const openTrades = dataWithAdjustedAmount.filter(r => r.exitOpen);
                const closedValue = closedTrades.reduce((sum, r) => sum + (r.currentValue || 0), 0);
                const openValue = openTrades.reduce((sum, r) => sum + (r.currentValue || 0), 0);
                const total = closedValue + openValue;
                return formatCurrency(total);
              })()}
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-2)', lineHeight: '1.5' }}>
              {(() => {
                const closedTrades = dataWithAdjustedAmount.filter(r => !r.exitOpen && r.exitReturn !== null);
                const openTrades = dataWithAdjustedAmount.filter(r => r.exitOpen);
                const closedValue = closedTrades.reduce((sum, r) => sum + (r.currentValue || 0), 0);
                const openValue = openTrades.reduce((sum, r) => sum + (r.currentValue || 0), 0);
                return (
                  <div>
                    <div>Realized: {formatCurrency(closedValue)}</div>
                    <div>Unrealized: {formatCurrency(openValue)}</div>
                  </div>
                );
              })()}
            </div>
          </div>

          <div style={{ background: 'var(--surface-elevated)', border: '1px solid var(--border-elevated)', borderRadius: '12px', padding: '16px', boxShadow: 'var(--inset-top), var(--shadow-md)' }}>
            <div style={{ fontSize: '11px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-2)', marginBottom: '6px' }}>
              Avg Return
            </div>
            <div style={{ fontSize: '24px', fontWeight: '700', color: 'var(--text)' }}>
              {(() => {
                const validSignals = dataWithAdjustedAmount.filter(r => r.performance !== null);
                if (validSignals.length === 0) return '—';
                const avg = validSignals.reduce((a, b) => a + ((b.performance as number) || 0), 0) / validSignals.length;
                return `${avg >= 0 ? '+' : ''}${avg.toFixed(1)}%`;
              })()}
            </div>
          </div>

          {/* Row 3 */}
          <div style={{ background: 'var(--surface-elevated)', border: '1px solid var(--border-elevated)', borderRadius: '12px', padding: '16px', boxShadow: 'var(--inset-top), var(--shadow-md)' }}>
            <div style={{ fontSize: '11px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-2)', marginBottom: '6px' }}>
              Realized Return
            </div>
            <div style={{ fontSize: '24px', fontWeight: '700', color: 'var(--text)' }}>
              {(() => {
                const closedTrades = dataWithAdjustedAmount.filter(r => !r.exitOpen && r.exitReturn !== null);
                const closedAvg = closedTrades.length > 0 ? closedTrades.reduce((a, b) => a + ((b.exitReturn as number)), 0) / closedTrades.length : null;
                return closedAvg !== null ? `${closedAvg >= 0 ? '+' : ''}${closedAvg.toFixed(1)}%` : '—';
              })()}
            </div>
          </div>

          <div style={{ background: 'var(--surface-elevated)', border: '1px solid var(--border-elevated)', borderRadius: '12px', padding: '16px', boxShadow: 'var(--inset-top), var(--shadow-md)' }}>
            <div style={{ fontSize: '11px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-2)', marginBottom: '6px' }}>
              Unrealized Return
            </div>
            <div style={{ fontSize: '24px', fontWeight: '700', color: 'var(--text)' }}>
              {(() => {
                const openTrades = dataWithAdjustedAmount.filter(r => r.exitOpen && r.performance !== null);
                const openAvg = openTrades.length > 0 ? openTrades.reduce((a, b) => a + ((b.performance as number)), 0) / openTrades.length : null;
                return openAvg !== null ? `${openAvg >= 0 ? '+' : ''}${openAvg.toFixed(1)}%` : '—';
              })()}
            </div>
          </div>
        </div>
      </div>

      {/* Chart */}
      <PeriodReturnsChart filteredData={dataWithAdjustedAmount} frequency="daily" />

      {/* Table */}
      <div style={{ overflowX: 'auto', border: '1px solid var(--border-elevated)', borderRadius: '12px', background: 'var(--surface-elevated)', boxShadow: 'var(--inset-top), var(--shadow-md)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border)', background: 'var(--surface2)' }}>
              <SortHeader column="ticker" label="Asset" />
              <SortHeader column="sector" label="Sector" />
              <SortHeader column="signalDate" label="Signal Date" />
              <SortHeader column="signalMult" label="Multiplier" />
              <SortHeader column="invested" label="Invested" />
              <SortHeader column="currentValue" label="P&L" />
              <SortHeader column="performance" label="Return" />
              <SortHeader column="status" label="Status" />
              <SortHeader column="exitDate" label="Exit Date" />
              <SortHeader column="dcaSuitabilityScore" label="DCA Score" />
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
                <td style={{ padding: '12px 16px', fontWeight: '600', color: 'var(--text)' }}>
                  <Link href={`/asset/${row.ticker.toLowerCase()}`} style={{ color: 'var(--teal)', textDecoration: 'none', cursor: 'pointer' }} className="hover:underline">
                    {row.ticker}
                  </Link>
                  <div style={{ fontSize: '11px', color: 'var(--text-2)', marginTop: '2px' }}>{row.name}</div>
                </td>
                <td style={{ padding: '12px 16px', color: 'var(--text-2)', whiteSpace: 'nowrap' }}>{row.sector}</td>
                <td style={{ padding: '12px 16px', color: 'var(--text-2)', whiteSpace: 'nowrap' }}>
                  {formatDate(row.signalDate)}
                </td>
                <td style={{ padding: '12px 16px', textAlign: 'right', color: 'var(--text-2)', whiteSpace: 'nowrap' }}>
                  {row.signalMult !== null ? `${row.signalMult.toFixed(2)}×` : '—'}
                </td>
                <td style={{ padding: '12px 16px', textAlign: 'right', color: 'var(--text-2)', whiteSpace: 'nowrap', fontFamily: 'DM Mono, monospace' }}>
                  {formatCurrency(row.invested)}
                </td>
                <td style={{ padding: '12px 16px', textAlign: 'right', color: row.invested && row.currentValue ? getPerformanceColor((row.currentValue - row.invested) * 100 / row.invested) : 'var(--text-2)', whiteSpace: 'nowrap', fontFamily: 'DM Mono, monospace', fontWeight: '600' }}>
                  {formatCurrency(row.invested && row.currentValue ? row.currentValue - row.invested : null)}
                </td>
                <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: '600', whiteSpace: 'nowrap', color: getPerformanceColor(row.performance) }}>
                  {formatPerformance(row.performance)}
                </td>
                <td style={{ padding: '12px 16px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                  {row.signalDate !== null && (
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
                  )}
                </td>
                <td style={{ padding: '12px 16px', textAlign: 'right', color: 'var(--text-2)', whiteSpace: 'nowrap' }}>
                  {row.exitOpen ? '—' : formatDate(row.exitDate)}
                </td>
                <td style={{ padding: '12px 16px', textAlign: 'right', color: 'var(--text-2)', whiteSpace: 'nowrap' }}>
                  {row.dcaSuitabilityScore !== null ? `${Math.round(row.dcaSuitabilityScore)}` : '—'}
                </td>
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
