'use client';

import { useState } from 'react';
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
}

type SortColumn = 'ticker' | 'sector' | 'signalDate' | 'signalMult' | 'invested' | 'currentValue' | 'performance' | 'dcaSuitabilityScore';
type SortDirection = 'asc' | 'desc';
type ReturnFilter = 'all' | 'positive' | 'negative';
type DateRangeFilter = 'all' | 'lastMonth' | 'last3Months' | 'last6Months' | 'lastYear';

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
  minMultiplierFilter: number
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

    return true;
  });
}

interface PeriodReturn {
  period: string;
  return: number;
  signalCount: number;
}

interface MonthlySignalsTableProps {
  data: SignalRow[];
  chartData?: PeriodReturn[];
  chartLoading?: boolean;
}

export function MonthlySignalsTable({ data, chartData, chartLoading }: MonthlySignalsTableProps) {
  const [sortColumn, setSortColumn] = useState<SortColumn>('performance');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [showOnlyWithSignals, setShowOnlyWithSignals] = useState(true);
  const [returnFilter, setReturnFilter] = useState<ReturnFilter>('all');
  const [dateRangeFilter, setDateRangeFilter] = useState<DateRangeFilter>('all');
  const [sectorFilter, setSectorFilter] = useState('');
  const [minScoreFilter, setMinScoreFilter] = useState(0);
  const [minMultiplierFilter, setMinMultiplierFilter] = useState(0);
  const [baseAmount, setBaseAmount] = useState(433);

  const handleSort = (column: SortColumn) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('desc');
    }
  };

  // Get unique sectors for filter dropdown
  const uniqueSectors = Array.from(new Set(data.map(r => r.sector).filter(Boolean))).sort();

  const filteredData = applyFilters(data, showOnlyWithSignals, returnFilter, dateRangeFilter, sectorFilter, minScoreFilter, minMultiplierFilter);

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

  return (
    <>
      {/* Filters and Summary Stats - 70/30 Split */}
      <div style={{ display: 'grid', gridTemplateColumns: '70fr 30fr', gap: '16px', marginBottom: '20px' }}>
        {/* Filters Section - 70% - Split into 2 columns */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', background: 'var(--surface-elevated)', border: '1px solid var(--border-elevated)', borderRadius: '12px', padding: '16px', boxShadow: 'var(--inset-top), var(--shadow-md)' }}>

          {/* Left Sub-Column: Signal, Return, Date Range */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Filter Row 1: Signal Filter */}
            <div>
              <div style={{ fontSize: '11px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-2)', marginBottom: '8px' }}>
                Signal Filter
              </div>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <FilterButton
                  active={showOnlyWithSignals}
                  onClick={() => setShowOnlyWithSignals(!showOnlyWithSignals)}
                  label={showOnlyWithSignals ? '✓ With Signals Only' : 'Show All Assets'}
                />
              </div>
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
                min="50"
                max="2000"
                step="50"
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
          </div>
        </div>

        {/* Right Column - 30% with Summary and Stats */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {/* Summary Stats - 2 Columns x 3 Rows */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div style={{ background: 'var(--surface-elevated)', border: '1px solid var(--border-elevated)', borderRadius: '12px', padding: '16px', boxShadow: 'var(--inset-top), var(--shadow-md)' }}>
              <div style={{ fontSize: '11px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-2)', marginBottom: '6px' }}>
                Displayed
              </div>
              <div style={{ fontSize: '24px', fontWeight: '700', color: 'var(--text)' }}>
                {dataWithAdjustedAmount.length}
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

            <div style={{ background: 'var(--surface-elevated)', border: '1px solid var(--border-elevated)', borderRadius: '12px', padding: '16px', boxShadow: 'var(--inset-top), var(--shadow-md)' }}>
              <div style={{ fontSize: '11px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-2)', marginBottom: '6px' }}>
                Avg Return
              </div>
              <div style={{ fontSize: '24px', fontWeight: '700', color: 'var(--text)' }}>
                {(() => {
                  const validPerfs = dataWithAdjustedAmount.filter(r => r.performance !== null).map(r => r.performance as number);
                  if (validPerfs.length === 0) return '—';
                  const avg = validPerfs.reduce((a, b) => a + b, 0) / validPerfs.length;
                  return `${avg >= 0 ? '+' : ''}${avg.toFixed(1)}%`;
                })()}
              </div>
            </div>

            <div style={{ background: 'var(--surface-elevated)', border: '1px solid var(--border-elevated)', borderRadius: '12px', padding: '16px', boxShadow: 'var(--inset-top), var(--shadow-md)' }}>
              <div style={{ fontSize: '11px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-2)', marginBottom: '6px' }}>
                Current Value
              </div>
              <div style={{ fontSize: '24px', fontWeight: '700', color: 'var(--text)', fontFamily: 'DM Mono, monospace' }}>
                {(() => {
                  const total = dataWithAdjustedAmount.reduce((sum, r) => sum + (r.currentValue || 0), 0);
                  return formatCurrency(total);
                })()}
              </div>
            </div>

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
                Total Return
              </div>
              <div style={{ fontSize: '24px', fontWeight: '700', color: 'var(--text)' }}>
                {(() => {
                  const totalInvested = dataWithAdjustedAmount.reduce((sum, r) => sum + (r.invested || 0), 0);
                  const totalValue = dataWithAdjustedAmount.reduce((sum, r) => sum + (r.currentValue || 0), 0);
                  if (totalInvested === 0) return '—';
                  const returnPct = ((totalValue - totalInvested) / totalInvested) * 100;
                  const color = returnPct >= 0 ? 'var(--green)' : '#E24B4A';
                  return (
                    <div style={{ color }}>
                      {returnPct >= 0 ? '+' : ''}{returnPct.toFixed(1)}%
                    </div>
                  );
                })()}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Chart */}
      <PeriodReturnsChart filteredData={dataWithAdjustedAmount} frequency="monthly" />

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
              <SortHeader column="dcaSuitabilityScore" label="DCA Score" />
            </tr>
          </thead>
          <tbody>
            {sortedData.map((row, idx) => (
              <tr
                key={row.ticker}
                style={{
                  borderBottom: idx < sortedData.length - 1 ? '1px solid var(--border)' : 'none',
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
                <td style={{ padding: '12px 16px', textAlign: 'right', color: 'var(--text-2)', whiteSpace: 'nowrap' }}>
                  {row.dcaSuitabilityScore !== null ? `${Math.round(row.dcaSuitabilityScore)}` : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

    </>
  );
}
